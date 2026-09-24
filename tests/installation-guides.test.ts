import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '../src/types';
import { installationGuideForOrder } from '../src/data/installationGuides';

const order = (patch: Partial<Order> = {}): Order => ({
  orderId: 'HKT-GUIDE-1',
  cartId: 'CART-1',
  orderDate: '2026-09-24T00:00:00.000Z',
  lastUpdated: '2026-09-24T00:00:00.000Z',
  customerName: 'Customer',
  phone: '0550000000',
  email: 'buyer@example.com',
  productId: 'PLS',
  productName: 'SmartPLS',
  variantId: 'PLS-4118-MAC',
  versionOrPlan: '4.1.1.8',
  deliveryOs: 'macOS',
  amountPesewas: 20000,
  paymentStatus: 'paid',
  fulfilmentStatus: 'ready',
  ...patch
});

test('installation steps are available only after payment and match the selected OS', () => {
  assert.equal(installationGuideForOrder(order({ paymentStatus: 'pending' })), null);
  assert.equal(installationGuideForOrder(order({ deliveryOs: 'Mac via Parallels', macViaParallels: true })), null);
  assert.equal(installationGuideForOrder(order())?.id, 'smartpls-mac');
  assert.equal(installationGuideForOrder(order({ deliveryOs: 'Windows' }))?.id, 'smartpls-windows');
  assert.equal(installationGuideForOrder(order({ productId: 'NV', productName: 'NVivo 15' }))?.id, 'nvivo-mac');
});

test('SmartPLS macOS download command follows the purchased version', () => {
  assert.equal(installationGuideForOrder(order({ versionOrPlan: '4.1.1.6' }))?.command, 'curl smartpls.app/4116 | bash');
  assert.equal(installationGuideForOrder(order({ versionOrPlan: '4.1.1.8' }))?.command, 'curl smartpls.app | bash');
});

test('SPSS guides include one shared-order Lock Code submission step', () => {
  for (const os of ['Windows', 'macOS']) {
    const guide = installationGuideForOrder(order({ productId: 'SPSS', productName: 'SPSS Statistics', deliveryOs: os }));
    assert.ok(guide);
    assert.equal(guide.steps[0].kind, 'download');
    assert.equal(guide.steps.filter((step) => step.kind === 'customer-input').length, 1);
    assert.ok(guide.steps.findIndex((step) => step.kind === 'licence') > guide.steps.findIndex((step) => step.kind === 'customer-input'));
  }
});

test('AMOS uses the Windows Lock Code workflow and does not show a Mac guide', () => {
  const amos = order({ productId: 'AMOS', productName: 'AMOS', deliveryOs: 'Windows' });
  const guide = installationGuideForOrder(amos);
  assert.equal(guide?.id, 'amos-windows');
  assert.equal(guide?.steps.filter((step) => step.kind === 'customer-input').length, 1);
  assert.equal(installationGuideForOrder({ ...amos, deliveryOs: 'macOS' }), null);
});
