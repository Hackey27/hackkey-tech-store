import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order, Product } from '../src/types';
import { defaultInstallationGuideForProduct, installationGuideForOrder } from '../src/data/installationGuides';
import { cleanProductInstallationSettings } from '../src/utils/installationGuideConfig';
import { guideMarkerPosition, guideScreenshotUrl } from '../src/utils/guideImages';

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

test('Mplus uses the Windows Hardware ID workflow and does not show a Mac guide', () => {
  const mplus = order({ productId: 'MPLUS', productName: 'Mplus', deliveryOs: 'Windows' });
  const guide = installationGuideForOrder(mplus);
  assert.equal(guide?.id, 'mplus-windows');
  assert.equal(guide?.steps[0].kind, 'download');
  assert.equal(guide?.steps.filter((step) => step.kind === 'customer-input').length, 1);
  assert.ok(guide!.steps.findIndex((step) => step.kind === 'licence') > guide!.steps.findIndex((step) => step.kind === 'customer-input'));
  assert.equal(installationGuideForOrder({ ...mplus, deliveryOs: 'macOS' }), null);
});

test('product-level editable steps override the bundled guide for the matching OS only', () => {
  const custom = {
    installationGuides: {
      windows: { title: 'Custom Windows guide', caption: 'Use this computer.', steps: [{ title: 'Open setup', body: 'Start here.', actionLabel: 'Open support', actionUrl: 'https://example.com/support' }] }
    }
  };
  const windows = installationGuideForOrder(order({ deliveryOs: 'Windows' }), custom);
  assert.equal(windows?.title, 'Custom Windows guide');
  assert.equal(windows?.caption, 'Use this computer.');
  assert.equal(windows?.steps[0].actionLabel, 'Open support');
  assert.equal(installationGuideForOrder(order(), custom)?.id, 'smartpls-mac');
  assert.equal(installationGuideForOrder(order({ productId: 'NEW', productName: 'New software', deliveryOs: 'Windows' }), custom)?.steps[0].title, 'Open setup');
});

test('admin starts with the existing OS guide and rejects incomplete or unsafe step links', () => {
  const product = { productId: 'SPSS', productName: 'SPSS Statistics', variants: [] } as unknown as Product;
  assert.equal(defaultInstallationGuideForProduct(product, 'windows')?.steps[0].kind, 'download');
  assert.equal(defaultInstallationGuideForProduct(product, 'macos')?.steps[0].kind, 'download');
  const guide = { title: 'Install SPSS', steps: [{ title: 'Start', body: 'Read this.', actionLabel: 'Open', actionUrl: 'javascript:alert(1)' }] };
  assert.throws(() => cleanProductInstallationSettings({ ...product, installationGuides: { windows: guide } }), /HTTPS URL/);
  assert.throws(() => cleanProductInstallationSettings({ ...product, installationGuides: { windows: { ...guide, steps: [{ title: 'Start', body: 'Read this.', actionLabel: 'Open' }] } } }), /both a button label and link/);
  const settings = cleanProductInstallationSettings({ ...product, installationButtonLabel: '  Begin setup  ', installationGuides: { windows: { ...guide, steps: [{ title: 'Start', body: 'Read this.', actionLabel: 'Open', actionUrl: 'https://example.com/setup' }] } } });
  assert.equal(settings.installationButtonLabel, 'Begin setup');
  assert.equal(settings.showInstallationGuideFallback, false);
  assert.equal(settings.installationGuides?.windows?.steps[0].actionUrl, 'https://example.com/setup');
});

test('step screenshots are product-scoped and amber marker coordinates stay on the image', () => {
  const product = { productId: 'SPSS', productName: 'SPSS Statistics', variants: [] } as unknown as Product;
  const image = { src: 'catalogue/SPSS/guide/123.webp', alt: 'SPSS licence window', markers: [{ x: 34.5, y: 72, label: 'Click Add' }] };
  const guide = { title: 'Install SPSS', steps: [{ title: 'Activate', body: 'Click Add.', images: [image] }] };
  assert.equal(cleanProductInstallationSettings({ ...product, installationGuides: { windows: guide } }).installationGuides?.windows?.steps[0].images?.[0].markers?.[0].label, 'Click Add');
  assert.throws(() => cleanProductInstallationSettings({ ...product, installationGuides: { windows: { ...guide, steps: [{ ...guide.steps[0], images: [{ ...image, src: 'catalogue/AMOS/guide/123.webp' }] }] } } }), /screenshot 1 is invalid/);
  assert.throws(() => cleanProductInstallationSettings({ ...product, installationGuides: { windows: { ...guide, steps: [{ ...guide.steps[0], images: [{ ...image, markers: [{ x: 101, y: 20, label: 'Bad' }] }] }] } } }), /invalid amber marker/);
  assert.equal(guideScreenshotUrl(image.src), '/api/catalog/images?path=catalogue%2FSPSS%2Fguide%2F123.webp');
  assert.deepEqual(guideMarkerPosition(150, 100, { left: 50, top: 50, width: 200, height: 100 }), { x: 50, y: 50 });
  assert.deepEqual(guideMarkerPosition(1000, -20, { left: 50, top: 50, width: 200, height: 100 }), { x: 100, y: 0 });
});
