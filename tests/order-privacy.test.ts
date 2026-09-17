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
  documentPath: 'orders/private.docx', offlinePaymentReason: 'private',
  internalNotes: [{ text: 'private', actorUid: 'admin', createdAt: '2026-09-17T00:00:00Z' }]
};

test('the public order boundary never exposes an internal sales code', () => {
  const visible = publicOrder(order);
  assert.equal(visible.salesCode, undefined);
  assert.equal(visible.documentPath, undefined);
  assert.equal(visible.internalNotes, undefined);
  assert.equal(visible.activationCodeOrKey, 'CUSTOMER-LICENCE');
});
