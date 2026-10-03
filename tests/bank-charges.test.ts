import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from '@google-cloud/firestore';
import type { RmbPricingSettings } from '../shared/types';
import { bankChargeBreakEvenPesewas, defaultBankChargeSettings, percentageBankChargePesewas, validateBankChargeSettings } from '../shared/bankCharges';
import { calculateRmbPrice, defaultRmbTransactionFee, emptyRmbPricingSettings, normalizeRmbPricingSettings, validateRmbPricingSettings } from '../shared/rmbPricing';
import { getRmbPricingSettings, RMB_SETTINGS_ID, saveRmbPricingSettings } from '../server/rmbPricingSettings';
import { submitPreorder } from '../server/preorderOrders';

const config = (): RmbPricingSettings => ({ ...emptyRmbPricingSettings(), exchangeRate: 1.75, profitMargins: [{ minimum: 0, maximum: null, percent: 20 }] });
const source = { rawCostRmb: 1000, shippingExpressGhs: 0, shippingTwoMonthsGhs: 0 };

test('8.5% with a 7.47 minimum matches all supplied bank statement examples', () => {
  for (const [basePesewas, chargePesewas] of [[131717n, 11196n], [24730n, 2102n], [2531n, 747n], [2546n, 747n], [8788n, 747n], [10000n, 850n], [0n, 0n]]) {
    assert.equal(percentageBankChargePesewas(basePesewas, config()), chargePesewas);
  }
  assert.equal(percentageBankChargePesewas(-1n, config()), 0n);
  assert.equal(bankChargeBreakEvenPesewas(config()), 8788n);
});

test('maximum caps the rounded percentage after the minimum is applied', () => {
  assert.equal(percentageBankChargePesewas(100000n, { ...config(), bankChargeMaximumGhs: 50 }), 5000n);
  assert.equal(percentageBankChargePesewas(100000n, config()), 8500n);
  assert.equal(percentageBankChargePesewas(0n, { ...config(), bankChargeMaximumGhs: 50 }), 0n);
});

test('half-up rounding uses integer arithmetic for both debited base and bank percentage', () => {
  const settings = { ...config(), bankChargeRateBps: 5000, bankChargeMinimumGhs: 0 };
  assert.equal(percentageBankChargePesewas(1n, settings), 1n);
  assert.equal(percentageBankChargePesewas(3n, settings), 2n);
  const price = calculateRmbPrice({ ...source, rawCostRmb: 1.01 }, 'express', { ...settings, exchangeRate: 0.5, bankChargeRateBps: 10000 });
  assert.equal(price.convertedCostGhs, 0.505);
  assert.equal(price.bankChargeBaseGhs, 0.51);
  assert.equal(price.bankChargeGhs, 0.51);
  const tiny = calculateRmbPrice({ ...source, rawCostRmb: 0.01 }, 'express', { ...config(), exchangeRate: 0.49 });
  assert.equal(tiny.bankChargeBaseGhs, 0);
  assert.equal(tiny.bankChargeGhs, 0);
});

test('shared pricing engine includes the existing RMB transaction fee in the bank base', () => {
  const before = config(), copy = structuredClone(before);
  const price = calculateRmbPrice(source, 'express', before);
  assert.equal(price.transactionFeeRmb, 30);
  assert.equal(price.transactionFeeGhs, 52.5);
  assert.equal(price.bankChargeBaseGhs, 1802.5);
  assert.equal(price.bankChargeGhs, 153.21);
  assert.equal(price.landedCostGhs, 1955.71);
  assert.equal(price.pricePesewas, 234700);
  assert.deepEqual(before, copy);
  const ship = calculateRmbPrice({ ...source, shippingExpressGhs: 100 }, 'express', before);
  assert.equal(ship.bankChargeGhs, price.bankChargeGhs);
  assert.equal(ship.bankChargeBaseGhs, price.bankChargeBaseGhs);
});

test('fee-free raw RMB costs use cost alone and preserve the existing inclusive ¥200 cutoff', () => {
  for (const rawCostRmb of [100, 199.99, 200]) {
    const price = calculateRmbPrice({ ...source, rawCostRmb }, 'express', config());
    assert.equal(price.transactionFeeRmb, 0);
    assert.equal(price.transactionFeeGhs, 0);
  }
  const price = calculateRmbPrice({ ...source, rawCostRmb: 100 }, 'express', config());
  assert.equal(price.bankChargeBaseGhs, 175);
  assert.equal(price.bankChargeGhs, 14.88);
});

test('fixed ranges use the original pre-fee converted base with unchanged exact price results', () => {
  const settings = { ...config(), exchangeRate: 2.1, bankChargeMode: 'ranges' as const, bankCharges: [{ minimum: 0, maximum: 1050, charge: 15 }, { minimum: 1050.01, maximum: null, charge: 999 }] };
  const price = calculateRmbPrice({ rawCostRmb: 500, shippingExpressGhs: 80 }, 'express', settings);
  assert.equal(price.bankChargeBaseGhs, 1050);
  assert.equal(price.transactionFeeRmb, 15);
  assert.equal(price.bankChargeGhs, 15);
  assert.equal(price.pricePesewas, 141200);
  assert.throws(() => validateRmbPricingSettings({ ...settings, bankCharges: [] }), /Bank charges/);
  assert.doesNotThrow(() => validateRmbPricingSettings(config()));
});

test('bank settings reject invalid rates, amounts and modes using shared validation', () => {
  for (const fields of [{ bankChargeRateBps: 10001 }, { bankChargeRateBps: -1 }, { bankChargeRateBps: 850.5 }, { bankChargeRateBps: NaN }, { bankChargeMinimumGhs: -0.01 }, { bankChargeMinimumGhs: 7.471 }, { bankChargeMinimumGhs: NaN }, { bankChargeMaximumGhs: 7.46 }, { bankChargeMaximumGhs: -1 }, { bankChargeMaximumGhs: Infinity }, { bankChargeMode: 'unknown' }]) {
    assert.throws(() => validateRmbPricingSettings({ ...config(), ...fields } as RmbPricingSettings));
  }
  assert.doesNotThrow(() => validateBankChargeSettings({ ...config(), bankChargeRateBps: 0 }));
  assert.doesNotThrow(() => validateBankChargeSettings({ ...config(), bankChargeRateBps: 10000 }));
  assert.doesNotThrow(() => validateBankChargeSettings({ ...config(), bankChargeMaximumGhs: 7.47 }));
  assert.equal(bankChargeBreakEvenPesewas({ ...config(), bankChargeRateBps: 0 }), null);
  assert.equal(percentageBankChargePesewas(100n, { ...config(), bankChargeRateBps: 0 }), 747n);
});

test('new settings default to percentage/minimum; legacy ranges migrate without changing fee settings or data', () => {
  assert.deepEqual(validateBankChargeSettings(emptyRmbPricingSettings()), defaultBankChargeSettings());
  const legacy = { exchangeRate: 2.1, bankCharges: [{ minimum: 0, maximum: null, charge: 15 }], transactionFee: defaultRmbTransactionFee(), profitMargins: [{ minimum: 0, maximum: null, percent: 20 }] };
  const copy = structuredClone(legacy), upgraded = normalizeRmbPricingSettings(legacy);
  assert.equal(upgraded.bankChargeMode, 'ranges');
  assert.deepEqual(upgraded.bankCharges, legacy.bankCharges);
  assert.deepEqual(upgraded.transactionFee, legacy.transactionFee);
  assert.deepEqual(legacy, copy);
  const percentage = validateRmbPricingSettings({ ...upgraded, bankChargeMode: 'percentage_min' });
  const ranges = validateRmbPricingSettings({ ...percentage, bankChargeMode: 'ranges' });
  assert.deepEqual(ranges.bankCharges, legacy.bankCharges);
  assert.deepEqual(ranges.transactionFee, legacy.transactionFee);
});

function database() {
  const rows = new Map<string, any>([[`settings/${RMB_SETTINGS_ID}`, config()], ['preorderProducts/test', { productId: 'test', name: 'Test', active: true, pricingMode: 'rmb', variantAxes: [], deliveryOptions: ['express'], combinations: [{ combinationId: 'default', selections: {}, sourceCost: source }] }]]);
  const doc = (name: string, id: string) => ({ key: `${name}/${id}`, get: async () => ({ exists: rows.has(`${name}/${id}`), data: () => structuredClone(rows.get(`${name}/${id}`)) }) });
  const db = { collection: (name: string) => ({ doc: (id: string) => doc(name, id) }), batch: () => {
    const writes: (() => void)[] = []; return { set: (ref: any, value: any) => writes.push(() => rows.set(ref.key, structuredClone(value))), commit: async () => writes.forEach(write => write()) };
  }, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = []; const result = await fn({ get: (ref: any) => ref.get(), create: (ref: any, value: any) => writes.push(() => rows.set(ref.key, structuredClone(value))) }); writes.forEach(write => write()); return result;
  } } as unknown as Firestore;
  return { db, rows };
}

test('audited settings saves retain hidden ranges and transaction settings across bank modes', async () => {
  const { db, rows } = database();
  const settings = { ...config(), bankCharges: [{ minimum: 0, maximum: null, charge: 15 }] };
  await saveRmbPricingSettings(settings, { uid: 'test-admin' }, db);
  const loaded = await getRmbPricingSettings(db);
  assert.equal(loaded.bankChargeMode, 'percentage_min');
  assert.equal(loaded.bankChargeRateBps, 850);
  assert.equal(loaded.bankChargeMinimumGhs, 7.47);
  assert.equal(loaded.bankChargeMaximumGhs, null);
  assert.deepEqual(loaded.bankCharges, settings.bankCharges);
  assert.deepEqual(loaded.transactionFee, settings.transactionFee);
  await saveRmbPricingSettings({ ...loaded, bankChargeMode: 'ranges' }, { uid: 'test-admin' }, db);
  assert.deepEqual((await getRmbPricingSettings(db)).bankCharges, settings.bankCharges);
  assert.equal([...rows.keys()].filter(key => key.startsWith('admin_audit/')).length, 2);
});

test('bank-setting edits affect new checkout prices but never modify past order totals', async () => {
  const { db, rows } = database();
  const submission = { customer: { name: 'Test', phone: '0241234567', email: 'test@example.com', location: 'Test' }, items: [{ productId: 'test', combinationId: 'default', delivery: 'express' as const, quantity: 1, expectedPricePesewas: 234700 }] };
  const first = await submitPreorder(submission, { db, notify: async () => {} });
  const snapshot = structuredClone(rows.get(`preorders/${first.preorderId}`));
  await saveRmbPricingSettings({ ...config(), bankChargeRateBps: 1000 }, { uid: 'test-admin' }, db);
  await assert.rejects(submitPreorder(submission, { db, notify: async () => {} }), /Prices have changed/);
  const second = await submitPreorder({ ...submission, items: [{ ...submission.items[0], expectedPricePesewas: undefined }] }, { db, notify: async () => {} });
  assert.notEqual(second.items[0].pricePesewas, first.items[0].pricePesewas);
  assert.deepEqual(rows.get(`preorders/${first.preorderId}`), snapshot);
});
