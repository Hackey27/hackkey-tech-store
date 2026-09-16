import { Order } from '../src/types';
import { COLLECTIONS, getFirestore } from './firestore';
import { verifyTransaction } from './paystack';
import { fulfilPaidOrder, FulfilmentOutcome } from './orders';
import { sendCustomerReceipt, sendSellerAlert } from './email';

/**
 * Applying a verified payment — the only code in the system that may set
 * `paymentStatus: 'paid'`.
 *
 * The return handler and the webhook both call this. Neither has its own copy
 * of the logic, because two copies drift and one of them ends up missing the
 * amount check.
 */

export type ApplyOutcome =
  | { result: 'not-successful'; reference: string }
  | { result: 'unknown-order'; reference: string }
  | { result: 'already-paid'; order: Order }
  | { result: 'mismatch'; order: Order; reason: string }
  | { result: 'paid'; order: Order; licenceIssued: boolean };

async function findOrderByReference(reference: string): Promise<Order | null> {
  const db = getFirestore();

  // The reference is the order id, so this is normally a direct read. The
  // query is the fallback for any reference that was ever derived differently.
  const direct = await db.collection(COLLECTIONS.orders).doc(reference).get();
  if (direct.exists) return direct.data() as Order;

  const byRef = await db
    .collection(COLLECTIONS.orders)
    .where('paystackReference', '==', reference)
    .limit(1)
    .get();

  return byRef.empty ? null : (byRef.docs[0].data() as Order);
}

/**
 * Verify a reference against Paystack and, if it genuinely succeeded for the
 * right amount, mark the order paid and fulfil it.
 *
 * Idempotency is required, not nice to have: the webhook retries and the
 * customer's return fires at roughly the same moment. The paid-check lives
 * inside the Firestore transaction in fulfilPaidOrder, so one payment can never
 * issue two licences.
 */
export async function applyVerifiedPayment(reference: string): Promise<ApplyOutcome> {
  const verified = await verifyTransaction(reference);

  if (!verified || verified.status !== 'success') {
    return { result: 'not-successful', reference };
  }

  const order = await findOrderByReference(reference);
  if (!order) {
    console.error(`[payments] Verified transaction ${reference} matches no order.`);
    await sendSellerAlert({
      subject: `Payment for an unknown order (${reference})`,
      lines: [
        `Paystack reports a successful payment for reference ${reference},`,
        'but no order in Firestore matches it. This needs a human.'
      ]
    }).catch(() => undefined);
    return { result: 'unknown-order', reference };
  }

  if (order.paymentStatus === 'paid') {
    return { result: 'already-paid', order };
  }

  // The anti-tamper control. Without it, a customer who manipulates the
  // initialise call pays GHS 1 for a GHS 500 licence and every signature check
  // still passes. Both amounts are integer pesewas, so this is an exact
  // comparison — which is the reason money is not stored in cedis.
  if (verified.amountPesewas !== order.amountPesewas) {
    const reason =
      `Paystack reports ${verified.amountPesewas} pesewas but the order is ` +
      `${order.amountPesewas} pesewas.`;
    await flagMismatch(order, reason);
    return { result: 'mismatch', order, reason };
  }

  if (verified.currency !== 'GHS') {
    const reason = `Paystack reports currency ${verified.currency}, expected GHS.`;
    await flagMismatch(order, reason);
    return { result: 'mismatch', order, reason };
  }

  const outcome = await fulfilPaidOrder(order.orderId, {
    paystackReference: verified.reference,
    paidAt: verified.paidAt
  });

  if (!outcome) {
    return { result: 'unknown-order', reference };
  }

  // Already paid by the time the transaction ran — the other of the webhook and
  // the return got there first. Not an error, and no second email.
  if (outcome.alreadyPaid) {
    return { result: 'already-paid', order: outcome.order };
  }

  // Emails are sent after the transaction commits, and only on the call that
  // actually moved the order, so retries do not re-send.
  await notify(outcome).catch((err) => {
    console.error('[payments] Notification failed after a successful payment:', err);
  });

  return { result: 'paid', order: outcome.order, licenceIssued: outcome.licenceIssued };
}

/**
 * An amount or currency mismatch blocks fulfilment and alerts the seller. It is
 * never an automatic refusal to the customer: the money may well have arrived,
 * and only a human can decide what to do.
 */
async function flagMismatch(order: Order, reason: string): Promise<void> {
  const db = getFirestore();
  console.error(`[payments] MISMATCH on ${order.orderId}: ${reason}`);

  await db.collection(COLLECTIONS.orders).doc(order.orderId).update({
    paymentMismatchNote: reason,
    lastUpdated: new Date().toISOString()
  });

  await sendSellerAlert({
    subject: `Payment mismatch on ${order.orderId} — NOT fulfilled`,
    lines: [
      `Order ${order.orderId} (${order.customerName}, ${order.phone})`,
      reason,
      '',
      'The order has NOT been marked paid and nothing has been fulfilled.',
      'Check the transaction in the Paystack dashboard before acting.'
    ]
  }).catch(() => undefined);
}

/** What the seller must now do — an alert that does not say gets ignored. */
function sellerAction(order: Order, licenceIssued: boolean): string {
  switch (order.fulfilmentStatus) {
    case 'ready':
      return licenceIssued
        ? 'Nothing to do — a licence was issued automatically.'
        : 'Nothing to do.';
    case 'awaiting-licence':
      return 'ISSUE A LICENCE: the pool had no key for this variant.';
    case 'awaiting-customer-input':
      return 'Wait for the customer to send their lock code or hardware ID.';
    case 'awaiting-document':
      return 'Wait for the customer to send their document.';
    case 'awaiting-seller-activation':
      return 'ACTIVATE MANUALLY and send the customer their details.';
    default:
      return 'Review this order.';
  }
}

async function notify(outcome: FulfilmentOutcome): Promise<void> {
  const { order, licenceIssued } = outcome;
  const db = getFirestore();

  const results = await Promise.allSettled([
    sendSellerAlert({
      subject: `Paid: ${order.orderId} — ${order.productName}`,
      lines: [
        `Order      ${order.orderId}`,
        `Customer   ${order.customerName}`,
        `Phone      ${order.phone}`,
        `Email      ${order.email}`,
        `Item       ${order.productName} — ${order.versionOrPlan}` +
          (order.quantity && order.quantity > 1 ? ` x${order.quantity}` : ''),
        `Amount     ${(order.amountPesewas / 100).toFixed(2)} GHS`,
        '',
        `ACTION:    ${sellerAction(order, licenceIssued)}`
      ]
    }),
    sendCustomerReceipt(order)
  ]);

  const failures = results
    .map((r, i) => (r.status === 'rejected' ? `${i === 0 ? 'seller alert' : 'receipt'}: ${r.reason}` : null))
    .filter(Boolean);

  // Email failure must never fail the payment. The money arrived; that is what
  // matters. Record what happened on the order and move on.
  await db.collection(COLLECTIONS.orders).doc(order.orderId).update({
    receiptSent: results[1].status === 'fulfilled',
    emailStatus: failures.length ? `failed — ${failures.join('; ')}` : 'sent',
    lastUpdated: new Date().toISOString()
  });

  if (failures.length) {
    console.error(`[payments] Email failure on ${order.orderId}:`, failures.join('; '));
  }

  // An empty pool at fulfilment time is its own alert: it is the seller's
  // cue to issue a key for an order that is already paid for.
  if (order.fulfilmentStatus === 'awaiting-licence') {
    await sendSellerAlert({
      subject: `Licence pool empty — ${order.orderId} is paid and owed a key`,
      lines: [
        `Order ${order.orderId} is paid but no licence was available for`,
        `variant ${order.variantId}. The customer is waiting.`
      ]
    }).catch(() => undefined);
  }
}
