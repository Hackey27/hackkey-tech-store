import { Order } from '../src/types';
import { AdminActor } from './adminAuth';
import { sendSellerPaymentReminder } from './email';
import { COLLECTIONS, getFirestore } from './firestore';

function nowIso(): string {
  return new Date().toISOString();
}

export function ghanaDate(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function validReminderDate(value: unknown): value is string {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function paymentReminderIsDue(order: Order, today = ghanaDate()): boolean {
  return order.paymentStatus !== 'paid' &&
    order.paymentArrangement === 'pay-later' &&
    order.paymentReminderPrimary === true &&
    Boolean(order.paymentReminderDate && order.paymentReminderDate <= today) &&
    !order.paymentReminderSentAt;
}

/** Mark every row in the cart as pay-later, while scheduling at most one seller
 * reminder for the selected row so bundles never produce duplicate emails. */
export async function setPaymentLater(orderId: string, reminderDate: string | undefined, actor: AdminActor): Promise<Order> {
  if (reminderDate && !validReminderDate(reminderDate)) throw new Error('Choose a valid reminder date.');
  const db = getFirestore();
  const selectedRef = db.collection(COLLECTIONS.orders).doc(orderId);
  const selectedSnap = await selectedRef.get();
  if (!selectedSnap.exists) throw new Error('Order not found.');
  const selected = selectedSnap.data() as Order;
  if (selected.paymentStatus === 'paid') throw new Error('This order is already paid.');
  const cartSnap = await db.collection(COLLECTIONS.orders).where('cartId', '==', selected.cartId).get();
  const rows = cartSnap.empty ? [selectedSnap] : cartSnap.docs;
  if (rows.some((row) => (row.data() as Order).paymentStatus === 'paid')) throw new Error('Part of this checkout is already paid.');

  const scheduledAt = nowIso();
  const batch = db.batch();
  for (const row of rows) {
    const patch: Record<string, unknown> = {
      paymentArrangement: 'pay-later',
      paymentReminderPrimary: row.id === orderId,
      paymentReminderDate: row.id === orderId ? reminderDate || null : null,
      paymentReminderScheduledAt: scheduledAt,
      paymentReminderScheduledBy: actor.email || actor.uid,
      paymentReminderSentAt: null,
      paymentReminderProcessingAt: null,
      lastUpdated: scheduledAt
    };
    batch.update(row.ref, patch);
  }
  await batch.commit();
  return {
    ...selected,
    paymentArrangement: 'pay-later',
    paymentReminderPrimary: true,
    paymentReminderDate: reminderDate,
    paymentReminderScheduledAt: scheduledAt,
    paymentReminderScheduledBy: actor.email || actor.uid,
    paymentReminderSentAt: undefined,
    lastUpdated: scheduledAt
  };
}

export async function sendDuePaymentReminders(value: Date = new Date()): Promise<{ due: number; sent: number; failed: number }> {
  const db = getFirestore();
  const today = ghanaDate(value);
  const snapshot = await db.collection(COLLECTIONS.orders).where('paymentStatus', '==', 'pending').get();
  const due = snapshot.docs.map((doc) => doc.data() as Order).filter((order) => paymentReminderIsDue(order, today));
  let sent = 0;
  let failed = 0;

  for (const order of due) {
    const ref = db.collection(COLLECTIONS.orders).doc(order.orderId);
    try {
      const claimed = await db.runTransaction(async (transaction) => {
        const currentSnap = await transaction.get(ref);
        if (!currentSnap.exists || !paymentReminderIsDue(currentSnap.data() as Order, today)) return false;
        const current = currentSnap.data() as Order;
        if (current.paymentReminderProcessingAt) {
          const age = value.getTime() - new Date(current.paymentReminderProcessingAt).getTime();
          if (Number.isFinite(age) && age < 30 * 60_000) return false;
        }
        transaction.update(ref, { paymentReminderProcessingAt: value.toISOString(), lastUpdated: value.toISOString() });
        return true;
      });
      if (!claimed) continue;
      await sendSellerPaymentReminder(order);
      await ref.update({ paymentReminderSentAt: nowIso(), paymentReminderProcessingAt: null, lastUpdated: nowIso() });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[reminders] Failed for ${order.orderId}:`, error);
      await ref.update({ paymentReminderProcessingAt: null, lastUpdated: nowIso() }).catch(() => undefined);
    }
  }
  return { due: due.length, sent, failed };
}
