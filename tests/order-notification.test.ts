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

test('Turnitin document received notification confirms processing and omits the order reference', () => {
  const current = order({
    productId: 'TURNITIN', variantId: 'TURNITIN', productName: 'Turnitin Plagiarism & AI Check',
    versionOrPlan: 'Plagiarism + AI Check', paymentStatus: 'paid',
    fulfilmentStatus: 'awaiting-seller-activation', documentReceivedAt: '2026-09-23T10:10:00.000Z'
  });
  assert.equal(notificationPurposeForOrder(current), 'turnitin-document-received');
  assert.equal(validateNotificationPurpose(current, 'turnitin-document-received'), null);
  const content = buildOrderNotification(current, 'turnitin-document-received', 'https://store.example/order/token');
  assert.match(content.message, /Your document has been received and is being processed\. Your report will be ready in 30 to 40 minutes\./);
  assert.doesNotMatch(content.subject + content.message, /HKT-TEST|Plagiarism \+ AI Check/);
  assert.match(content.message, /https:\/\/store\.example\/order\/token/);
});

test('Turnitin references stay in details and payment messages, but not report-ready messages', () => {
  const current = order({ productId: 'TURNITIN', variantId: 'TURNITIN', productName: 'Turnitin Plagiarism & AI Check', versionOrPlan: 'Plagiarism Only' });
  const url = 'https://store.example/order/token';
  for (const purpose of ['payment-reminder', 'turnitin-document'] as const) {
    const content = buildOrderNotification(current, purpose, url);
    assert.match(content.message, /HKT-TEST — Turnitin Plagiarism & AI Check Plagiarism Only/);
  }
  const ready = buildOrderNotification(current, 'turnitin-report', url);
  assert.doesNotMatch(ready.subject + ready.message, /HKT-TEST|Plagiarism Only/);
  for (const purpose of ['complete', 'status-update'] as const) {
    const later = buildOrderNotification({ ...current, paymentStatus: 'paid' }, purpose, url);
    assert.doesNotMatch(later.subject + later.message, /HKT-TEST|Plagiarism Only/);
  }
  assert.equal(notificationPurposeForOrder(order({ paymentStatus: 'paid', fulfilmentStatus: 'awaiting-seller-activation', documentReceivedAt: '2026-09-23T10:10:00.000Z' })), 'status-update');
});

test('non-Turnitin status templates keep their order reference and product details', () => {
  const current = order({ paymentStatus: 'paid', fulfilmentStatus: 'ready' });
  for (const purpose of ['complete', 'status-update'] as const) {
    const content = buildOrderNotification(current, purpose, 'https://store.example/order/token');
    assert.match(content.subject + content.message, /HKT-TEST/);
    assert.match(content.message, /Order: HKT-TEST — SPSS 31\./);
  }
});
