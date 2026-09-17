import { Order } from '../src/types';
import { formatPesewas } from '../src/utils/money';
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

/**
 * Every order row the reference paid for, primary first.
 *
 * One checkout is one Paystack transaction, and a cart can be several rows — a
 * bundle becomes one row per included item, and a multi-item cart is several
 * lines. Paystack is charged the CART TOTAL, so verification has to compare
 * against the same total and fulfil every row. Comparing one row's amount
 * against the cart total is a guaranteed false mismatch.
 */
async function findOrdersByReference(reference: string): Promise<Order[]> {
  const db = getFirestore();

  // The reference is the order id, so this is normally a direct read.
  const direct = await db.collection(COLLECTIONS.orders).doc(reference).get();
  const primary = direct.exists ? (direct.data() as Order) : null;

  if (primary) {
    const siblings = await db
      .collection(COLLECTIONS.orders)
      .where('cartId', '==', primary.cartId)
      .get();

    const rows = siblings.docs.map((d) => d.data() as Order);
    // Primary first, so the receipt and the reference agree.
    return [
      primary,
      ...rows.filter((o) => o.orderId !== primary.orderId)
    ];
  }

  const byRef = await db
    .collection(COLLECTIONS.orders)
    .where('paystackReference', '==', reference)
    .get();

  return byRef.docs.map((d) => d.data() as Order);
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

  const cart = await findOrdersByReference(reference);
  const order = cart[0];
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

  if (cart.every((o) => o.paymentStatus === 'paid')) {
    return { result: 'already-paid', order };
  }

  // The anti-tamper control. Without it, a customer who manipulates the
  // initialise call pays GHS 1 for a GHS 500 licence and every signature check
  // still passes. Both amounts are integer pesewas, so this is an exact
  // comparison — which is the reason money is not stored in cedis.
  // Compared against the CART total, which is what Paystack was asked for.
  const cartTotalPesewas = cart.reduce((sum, o) => sum + o.amountPesewas, 0);
  if (verified.amountPesewas !== cartTotalPesewas) {
    const reason =
      `Paystack reports ${verified.amountPesewas} pesewas but the cart is ` +
      `${cartTotalPesewas} pesewas` +
      (cart.length > 1 ? ` across ${cart.length} rows` : '') +
      '.';
    await flagMismatch(order, reason);
    return { result: 'mismatch', order, reason };
  }

  if (verified.currency !== 'GHS') {
    const reason = `Paystack reports currency ${verified.currency}, expected GHS.`;
    await flagMismatch(order, reason);
    return { result: 'mismatch', order, reason };
  }

  // Every row in the cart is fulfilled on its own terms: a bundle's rows can
  // each need a different thing, and one may take a licence while another
  // waits for the seller.
  const outcomes: FulfilmentOutcome[] = [];
  for (const row of cart) {
    const outcome = await fulfilPaidOrder(row.orderId, {
      paystackReference: verified.reference,
      paidAt: verified.paidAt
    });
    if (outcome) outcomes.push(outcome);
  }

  if (!outcomes.length) {
    return { result: 'unknown-order', reference };
  }

  // Already paid by the time the transaction ran — the other of the webhook and
  // the return got there first. Not an error, and no second email.
  if (outcomes.every((o) => o.alreadyPaid)) {
    return { result: 'already-paid', order: outcomes[0].order };
  }

  // Emails are sent after the transaction commits, and only on the call that
  // actually moved the order, so retries do not re-send.
  await notify(outcomes, cartTotalPesewas).catch((err) => {
    console.error('[payments] Notification failed after a successful payment:', err);
  });

  return {
    result: 'paid',
    order: outcomes[0].order,
    licenceIssued: outcomes.some((o) => o.licenceIssued)
  };
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

/** One alert and one receipt per cart, however many rows it became. */
async function notify(outcomes: FulfilmentOutcome[], cartTotalPesewas: number): Promise<void> {
  const order = outcomes[0].order;
  const db = getFirestore();

  const itemLines = outcomes.map(({ order: row, licenceIssued }) => {
    const quantity = row.quantity && row.quantity > 1 ? ` x${row.quantity}` : '';
    return (
      `  ${row.productName} — ${row.versionOrPlan}${quantity}   ` +
      `${formatPesewas(row.amountPesewas)}\n` +
      `      ACTION: ${sellerAction(row, licenceIssued)}`
    );
  });

  const results = await Promise.allSettled([
    sendSellerAlert({
      subject: `Paid: ${order.orderId} — ${order.productName}`,
      lines: [
        `Order      ${order.orderId}`,
        `Customer   ${order.customerName}`,
        `Phone      ${order.phone}`,
        `Email      ${order.email}`,
        `Total      ${formatPesewas(cartTotalPesewas)}` +
          (outcomes.length > 1 ? ` across ${outcomes.length} rows` : ''),
        '',
        ...itemLines
      ]
    }),
    sendCustomerReceipt(order, outcomes.map((o) => o.order), cartTotalPesewas)
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
  if (outcomes.some((o) => o.order.fulfilmentStatus === 'awaiting-licence')) {
    await sendSellerAlert({
      subject: `Licence pool empty — ${order.orderId} is paid and owed a key`,
      lines: [
        `Order ${order.orderId} is paid but no licence was available for`,
        `variant ${order.variantId}. The customer is waiting.`
      ]
    }).catch(() => undefined);
  }
}
