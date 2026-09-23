import assert from 'node:assert/strict';
import test from 'node:test';
import { publicOrder } from '../server/publicOrder';
import type { Order } from '../src/types';

const order: Order = {
  orderId: 'HK-1', cartId: 'CART-1', orderDate: '2026-09-17T00:00:00Z',
  lastUpdated: '2026-09-17T00:00:00Z', customerName: 'Customer', phone: '0550000000',
  email: 'customer@example.com', variantId: 'AMOS01', productName: 'AMOS',
  versionOrPlan: '31', deliveryOs: 'Windows', amountPesewas: 22000,
  paymentStatus: 'paid', fulfilmentStatus: 'awaiting-seller-activation',
  salesCode: 'SELLER-ONLY', activationCodeOrKey: 'CUSTOMER-LICENCE',
  sellerSubmissionAlertStatus: 'failed',
  sellerSubmissionAlertProviderId: 'provider-message-id',
  sellerSubmissionAlertError: 'private provider error',
  sellerSubmissionAlertAttempts: 3,
  customerAccessTokenHashes: ['private-bearer-token-hash'],
  documentPath: 'orders/private.docx', offlinePaymentReason: 'private',
  reportDocuments: [{ reportId: 'REP-1', label: 'Similarity report', originalName: 'report.pdf', storagePath: 'orders/HK-1/reports/private.pdf', uploadedAt: '2026-09-17T01:00:00Z' }],
  internalNotes: [{ text: 'private', actorUid: 'admin', createdAt: '2026-09-17T00:00:00Z' }]
};

test('the public order boundary never exposes an internal sales code', () => {
  const visible = publicOrder(order);
  assert.equal(visible.salesCode, undefined);
  assert.equal(visible.documentPath, undefined);
  assert.equal(visible.reportDocuments?.[0].storagePath, undefined);
  assert.equal(visible.reportDocuments?.[0].label, 'Similarity report');
  assert.equal(visible.internalNotes, undefined);
  assert.equal(visible.customerAccessTokenHashes, undefined);
  assert.equal(visible.sellerSubmissionAlertStatus, undefined);
  assert.equal(visible.sellerSubmissionAlertProviderId, undefined);
  assert.equal(visible.sellerSubmissionAlertError, undefined);
  assert.equal(visible.sellerSubmissionAlertAttempts, undefined);
  assert.equal(visible.activationCodeOrKey, 'CUSTOMER-LICENCE');
});
