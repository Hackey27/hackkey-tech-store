import assert from 'node:assert/strict';
import test from 'node:test';
import { getStepsForMachineCodeType } from '../src/components/OrderProgressBar';
import { turnitinOrderStep } from '../src/utils/orderProgress';
import { Order } from '../src/types';

const turnitinOrder: Order = {
  orderId: 'HK-123456',
  cartId: 'CART-1',
  orderDate: '',
  lastUpdated: '',
  customerName: 'Ama',
  phone: '0541234567',
  email: 'ama@example.com',
  variantId: 'TURNITIN',
  productId: 'TURNITIN',
  productName: 'Turnitin',
  versionOrPlan: 'Plagiarism + AI',
  deliveryOs: '',
  amountPesewas: 5000,
  paymentStatus: 'pending',
  fulfilmentStatus: 'awaiting-payment',
};

test('order progress preserves the full customer-facing labels', () => {
  assert.deepEqual(
    getStepsForMachineCodeType('lock-code').map((step) => step.label),
    ['Your Selection', 'Your Details', 'Payment', 'Submit Lock Code', 'Licence Delivery'],
  );
  assert.deepEqual(
    getStepsForMachineCodeType('hardware-id').map((step) => step.label),
    ['Your Selection', 'Your Details', 'Payment', 'Submit Hardware ID', 'Licence Delivery'],
  );
  assert.deepEqual(
    getStepsForMachineCodeType('service').map((step) => step.label),
    ['Your Selection', 'Your Details', 'Payment', 'Delivery'],
  );
  assert.deepEqual(
    getStepsForMachineCodeType('turnitin').map((step) => step.label),
    ['Your Selection', 'Your Details', 'Payment', 'Upload Document', 'Report Processing', 'Report Ready'],
  );
});

test('Turnitin progress advances from payment through report delivery', () => {
  assert.equal(turnitinOrderStep(turnitinOrder), 3);
  assert.equal(turnitinOrderStep({ ...turnitinOrder, paymentStatus: 'paid' }), 4);
  assert.equal(turnitinOrderStep({
    ...turnitinOrder,
    paymentStatus: 'paid',
    documentUploadStatus: 'uploaded',
  }), 5);
  assert.equal(turnitinOrderStep({
    ...turnitinOrder,
    paymentStatus: 'paid',
    documentUploadStatus: 'uploaded',
    fulfilmentStatus: 'ready',
  }), 6);
});
