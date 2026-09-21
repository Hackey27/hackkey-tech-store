import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_MOMO_DETAILS,
  normalisePaymentSettings,
  paymentModeUsesPaystack,
  publicPaymentOptions,
  validatePaymentSettings
} from '../server/paymentSettings';

for (const mode of ['paystack', 'momo', 'both'] as const) {
  test(`${mode} is returned as a valid public payment mode`, () => {
    const settings = normalisePaymentSettings({ mode, momo: DEFAULT_MOMO_DETAILS, updatedBy: 'admin', updatedAt: '2026-09-21T10:00:00.000Z' });
    const visible = publicPaymentOptions(settings);
    assert.equal(visible.mode, mode);
    assert.deepEqual(visible.momo, DEFAULT_MOMO_DETAILS);
    assert.equal('updatedBy' in visible, false);
  });
}

test('missing and invalid payment settings fail closed to Paystack', () => {
  assert.equal(normalisePaymentSettings(undefined).mode, 'paystack');
  assert.equal(normalisePaymentSettings({ mode: 'free', momo: DEFAULT_MOMO_DETAILS }).mode, 'paystack');
});

test('MoMo-only checkout never initialises Paystack', () => {
  assert.equal(paymentModeUsesPaystack('momo'), false);
  assert.equal(paymentModeUsesPaystack('paystack'), true);
  assert.equal(paymentModeUsesPaystack('both'), true);
});

test('MoMo settings reject empty or malformed customer-facing details', () => {
  assert.throws(() => validatePaymentSettings({ mode: 'momo', momo: { ...DEFAULT_MOMO_DETAILS, merchantName: '' } }), /merchant name/i);
  assert.throws(() => validatePaymentSettings({ mode: 'momo', momo: { ...DEFAULT_MOMO_DETAILS, transferNumber: '055-930-6223' } }), /digits only/i);
  assert.throws(() => validatePaymentSettings({ mode: 'both', momo: { ...DEFAULT_MOMO_DETAILS, whatsappNumber: '123' } }), /valid Ghana WhatsApp/i);
});
