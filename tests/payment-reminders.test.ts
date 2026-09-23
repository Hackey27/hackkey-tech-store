import assert from 'node:assert/strict';
import test from 'node:test';
import { ghanaDate, paymentReminderIsDue, validReminderDate } from '../server/paymentReminders';
import { Order } from '../src/types';

const order = (patch: Partial<Order> = {}): Order => ({
  orderId: 'HKT-REMINDER', cartId: 'CART-1', orderDate: '2026-09-20T10:00:00.000Z', lastUpdated: '2026-09-20T10:00:00.000Z',
  customerName: 'Reminder Buyer', phone: '0550000000', email: 'buyer@example.com', variantId: 'SPSS-31', productName: 'SPSS',
  versionOrPlan: '31', deliveryOs: 'Windows', amountPesewas: 30000, paymentStatus: 'pending', fulfilmentStatus: 'pending-payment',
  paymentArrangement: 'pay-later', paymentReminderPrimary: true, paymentReminderDate: '2026-09-23', ...patch
});

test('Ghana reminder dates are stable UTC calendar dates', () => {
  assert.equal(ghanaDate(new Date('2026-09-23T23:30:00.000Z')), '2026-09-23');
  assert.equal(validReminderDate('2026-02-29'), false);
  assert.equal(validReminderDate('2028-02-29'), true);
});

test('only an unpaid primary pay-later row with an unsent due date is due', () => {
  assert.equal(paymentReminderIsDue(order(), '2026-09-23'), true);
  assert.equal(paymentReminderIsDue(order(), '2026-09-22'), false);
  assert.equal(paymentReminderIsDue(order({ paymentStatus: 'paid' }), '2026-09-23'), false);
  assert.equal(paymentReminderIsDue(order({ paymentReminderPrimary: false }), '2026-09-23'), false);
  assert.equal(paymentReminderIsDue(order({ paymentReminderSentAt: '2026-09-23T08:00:00.000Z' }), '2026-09-23'), false);
});
