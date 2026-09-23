import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOrderNotification, notificationPurposeForOrder, validateNotificationPurpose } from '../src/utils/orderNotification';
import { Order } from '../src/types';

const order = (patch: Partial<Order> = {}): Order => ({
  orderId: 'HKT-TEST', cartId: 'CART-1', orderDate: '2026-09-23T10:00:00.000Z', lastUpdated: '2026-09-23T10:00:00.000Z',
  customerName: 'Ama Buyer', phone: '0550000000', email: 'ama@example.com', variantId: 'SPSS-31', productId: 'SPSS',
  productName: 'SPSS', versionOrPlan: '31', deliveryOs: 'Windows', amountPesewas: 30000, paymentStatus: 'pending',
  fulfilmentStatus: 'pending-payment', ...patch
});

test('unpaid orders receive a payment reminder containing the secure order link and exact amount', () => {
  const current = order();
  assert.equal(notificationPurposeForOrder(current), 'payment-reminder');
  const content = buildOrderNotification(current, 'payment-reminder', 'https://store.example/order/token');
  assert.match(content.message, /GHS 300\.00/);
  assert.match(content.message, /https:\/\/store\.example\/order\/token/);
});

test('paid machine-code orders receive download and submission instructions', () => {
  const current = order({ paymentStatus: 'paid', fulfilmentStatus: 'awaiting-customer-input', customerInputType: 'Hardware ID' });
  assert.equal(notificationPurposeForOrder(current), 'customer-input');
  const content = buildOrderNotification(current, 'customer-input', 'https://store.example/order/token');
  assert.match(content.message, /download the software/i);
  assert.match(content.message, /Hardware ID/);
});

test('notification validation prevents misleading state-specific messages', () => {
  assert.match(validateNotificationPurpose(order(), 'complete') || '', /Complete the order/i);
  assert.match(validateNotificationPurpose(order(), 'customer-input') || '', /paid order/i);
  assert.equal(validateNotificationPurpose(order(), 'status-update'), null);
});
