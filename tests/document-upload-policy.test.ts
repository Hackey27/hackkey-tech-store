import assert from 'node:assert/strict';
import test from 'node:test';
import { turnitinDocumentUploadPolicy } from '../server/documentUploadPolicy';
import { Order } from '../src/types';

const paidTurnitin: Order = {
  orderId: 'HK-123456', cartId: 'CART-1', orderDate: '', lastUpdated: '', customerName: 'Ama',
  phone: '0541234567', email: 'ama@example.com', variantId: 'TURNITIN', productId: 'TURNITIN',
  productName: 'Turnitin', versionOrPlan: 'Plagiarism + AI', deliveryOs: '', amountPesewas: 5000,
  paymentStatus: 'paid', fulfilmentStatus: 'awaiting-document'
};

test('an unpaid Turnitin order cannot authorize a document upload', () => {
  assert.equal(turnitinDocumentUploadPolicy({ ...paidTurnitin, paymentStatus: 'pending' }, paidTurnitin.phone).ok, false);
});

test('a paid Turnitin order with its matching phone can upload', () => {
  assert.equal(turnitinDocumentUploadPolicy(paidTurnitin, '+233541234567').ok, true);
});

test('non-Turnitin, wrong-phone and already-received uploads are rejected', () => {
  assert.equal(turnitinDocumentUploadPolicy({ ...paidTurnitin, productId: 'SPSS', variantId: 'SPSS01' }, paidTurnitin.phone).ok, false);
  assert.equal(turnitinDocumentUploadPolicy(paidTurnitin, '0550000000').ok, false);
  assert.equal(turnitinDocumentUploadPolicy({ ...paidTurnitin, documentUploadStatus: 'uploaded' }, paidTurnitin.phone, true).status, 409);
});
