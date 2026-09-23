import { CustomerRequest, Order } from '../src/types';
import { sendSellerOrderSubmittedAlert, sendSellerRequestAlert } from './email';
import { COLLECTIONS, getFirestore } from './firestore';
import { getOrdersByCartId, recordOrderSubmissionAlert } from './orders';

/** Retry only sends that the provider rejected or that failed before a response.
 * Resend's idempotency keys make an accepted-but-disconnected response safe to
 * retry without sending the seller a duplicate. */
export async function retryFailedSubmissionAlerts(): Promise<{ due: number; sent: number; failed: number }> {
  const db = getFirestore();
  const [orderSnaps, requestSnaps] = await Promise.all([
    db.collection(COLLECTIONS.orders).where('sellerSubmissionAlertStatus', 'in', ['pending', 'failed']).limit(50).get(),
    db.collection(COLLECTIONS.requests).where('sellerSubmissionAlertStatus', 'in', ['pending', 'failed']).limit(50).get()
  ]);
  let sent = 0;
  let failed = 0;

  for (const doc of orderSnaps.docs) {
    const order = doc.data() as Order;
    try {
      const cart = await getOrdersByCartId(order.cartId);
      const rows = cart.length ? [order, ...cart.filter((row) => row.orderId !== order.orderId)] : [order];
      const receipt = await sendSellerOrderSubmittedAlert(
        rows,
        rows.reduce((sum, row) => sum + row.amountPesewas, 0)
      );
      await recordOrderSubmissionAlert(order.orderId, {
        status: 'sent', providerId: receipt.providerId, incrementAttempt: true
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await recordOrderSubmissionAlert(order.orderId, {
        status: 'failed', error: error instanceof Error ? error.message : String(error), incrementAttempt: true
      }).catch(() => undefined);
    }
  }

  for (const doc of requestSnaps.docs) {
    const request = doc.data() as CustomerRequest;
    try {
      const receipt = await sendSellerRequestAlert(request);
      await doc.ref.update({
        sellerSubmissionAlertStatus: 'sent',
        sellerSubmissionAlertSentAt: new Date().toISOString(),
        sellerSubmissionAlertProviderId: receipt.providerId || null,
        sellerSubmissionAlertError: null,
        sellerSubmissionAlertAttempts: (request.sellerSubmissionAlertAttempts || 0) + 1
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await doc.ref.update({
        sellerSubmissionAlertStatus: 'failed',
        sellerSubmissionAlertError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        sellerSubmissionAlertAttempts: (request.sellerSubmissionAlertAttempts || 0) + 1
      }).catch(() => undefined);
    }
  }

  return { due: orderSnaps.size + requestSnaps.size, sent, failed };
}
