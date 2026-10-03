import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Firestore } from '@google-cloud/firestore';
import type { Laptop, PreorderProduct, RmbPricingSettings } from '../shared/types';
import { calculateRmbPrice, defaultRmbTransactionFee, emptyRmbPricingSettings, priceRmbLaptop, priceRmbProduct, publicRmbLaptop, publicRmbProduct, validateRmbPricingSettings } from '../shared/rmbPricing';
import { laptopToCatalogueItem } from '../server/catalogue';
import { DEFAULT_PRICING_CONFIG } from '../server/pricingConfig';
import { refreshPreorderLines, preorderCartTotalPesewas, setPreorderLineDelivery } from '../src/utils/usePreorderCart';
import { buildSingleCombinationAddition } from '../src/utils/preorderAdd';
import { addPreorderLine } from '../src/utils/usePreorderCart';
import { submitPreorder } from '../server/preorderOrders';
import { createAdminRouter } from '../server/adminRoutes';
import { RMB_SETTINGS_ID, getRmbPricingSettings, saveRmbPricingSettings, storedRmbSettings } from '../server/rmbPricingSettings';

const settings = (): RmbPricingSettings => ({ exchangeRate: 2.1, bankCharges: [{ minimum: 0, maximum: null, charge: 15 }], transactionFee: defaultRmbTransactionFee(), profitMargins: [{ minimum: 0, maximum: null, percent: 20 }] });
const source = { rawCostRmb: 500, shippingExpressGhs: 80, shippingTwoMonthsGhs: 150 };
const product = (): PreorderProduct => ({ productId: 'test', name: 'Test product', categoryId: 'tech', description: '', details: [], galleryImagePaths: [], variantAxes: [], combinations: [{ combinationId: 'default', selections: {}, sourceCost: structuredClone(source), priceExpressPesewas: 1 }], imageAssignments: [], deliveryOptions: ['express', 'two-months'], active: true, pricingMode: 'rmb' });
const laptop = (availability = 'Pre-order'): Laptop => ({ laptopId: 'laptop', title: 'Test laptop', priceGhs: 777, categoryId: 'laptops', brand: 'Test', model: 'Model', processor: '', ram: '', storage: '', screen: '', colour: '', graphics: '', ports: '', operatingSystem: '', picturesUrl: [], availability, active: true, sortOrder: 1, preorderCost: structuredClone(source) });

test('the percentage fee produces exact breakdowns and whole-cedi ceilings for both deliveries', () => {
  const first = calculateRmbPrice(source, 'express', settings());
  assert.equal(first.convertedCostGhs, 1050);
  assert.equal(first.bankChargeGhs, 15);
  assert.equal(first.transactionFeeGhs, 31.5);
  assert.equal(first.landedCostGhs, 1176.5);
  assert.equal(first.profitGhs, 235.3);
  assert.equal(first.sellingPriceGhs, 1411.8);
  assert.equal(first.pricePesewas, 141200);
  const second = calculateRmbPrice(source, 'two-months', settings());
  assert.equal(second.landedCostGhs, 1246.5);
  assert.equal(second.profitGhs, 249.3);
  assert.equal(second.pricePesewas, 149600);
});

test('bank bands use converted product cost; percentage fees use raw RMB; margin bands use each landed cost', () => {
  const config = settings();
  config.bankCharges = [{ minimum: 0, maximum: 1050, charge: 15 }, { minimum: 1050.01, maximum: null, charge: 999 }];
  config.profitMargins = [{ minimum: 0, maximum: 1200, percent: 20 }, { minimum: 1200.01, maximum: null, percent: 10 }];
  const first = calculateRmbPrice(source, 'express', config), second = calculateRmbPrice(source, 'two-months', config);
  assert.equal(first.bankChargeGhs, 15);
  assert.equal(first.transactionFeeRmb, 15);
  assert.equal(first.marginPercent, 20);
  assert.equal(second.marginPercent, 10);
  assert.equal(second.pricePesewas, 137200);
});

test('payments up to and including ¥200 are free; above the cutoff, 3% applies to the full amount', () => {
  for (const [rawCostRmb, fee] of [[199.99, 0], [200, 0], [200.01, 6.0003], [500, 15], [6000, 180]]) {
    const price = calculateRmbPrice({ ...source, rawCostRmb }, 'express', settings());
    assert.equal(price.transactionFeeRmb, fee);
    assert.equal(price.transactionFeePercent, rawCostRmb <= 200 ? 0 : 3);
    if (!fee) assert.equal(price.transactionFeeGhs, 0);
  }
});

test('decimal ceiling preserves exact whole cedis and never loses a sub-pesewa charge', () => {
  const config = { ...settings(), exchangeRate: 1, bankCharges: [{ minimum: 0, maximum: null, charge: 0 }], transactionFee: { ...defaultRmbTransactionFee(), percent: 0 }, profitMargins: [{ minimum: 0, maximum: null, percent: 0 }] };
  for (const [rawCostRmb, expected] of [[1389, 138900], [1389.01, 139000], [1389.12, 139000], [1389.99, 139000]]) assert.equal(calculateRmbPrice({ rawCostRmb, shippingExpressGhs: 0 }, 'express', config).pricePesewas, expected);
  assert.equal(calculateRmbPrice({ rawCostRmb: 0.1, shippingExpressGhs: 0 }, 'express', { ...config, exchangeRate: 10 }).pricePesewas, 100);
  assert.equal(calculateRmbPrice({ rawCostRmb: 0.01, shippingExpressGhs: 0 }, 'express', { ...config, exchangeRate: 0.000001 }).pricePesewas, 100);
  // Rounding ¥6.0003 to ¥6.00 early would incorrectly publish 207 cedis.
  const percentage = calculateRmbPrice({ rawCostRmb: 200.01, shippingExpressGhs: 0.99 }, 'express', { ...config, transactionFee: defaultRmbTransactionFee() });
  assert.equal(percentage.landedCostGhs, 207.0003);
  assert.equal(percentage.pricePesewas, 20800);
});

test('percentage policy validates amounts and precision rather than accepting an invalid fee', () => {
  for (const policy of [null, {}, { ...defaultRmbTransactionFee(), percent: -1 }, { ...defaultRmbTransactionFee(), percent: 101 }, { ...defaultRmbTransactionFee(), percent: 3.00001 }, { ...defaultRmbTransactionFee(), percent: NaN }, { ...defaultRmbTransactionFee(), freeUpToRmb: -1 }, { ...defaultRmbTransactionFee(), freeUpToRmb: 200.001 }, { ...defaultRmbTransactionFee(), maximumPaymentRmb: 0 }, { ...defaultRmbTransactionFee(), maximumPaymentRmb: 200 }, { ...defaultRmbTransactionFee(), maximumPaymentRmb: Infinity }]) {
    assert.throws(() => validateRmbPricingSettings({ ...settings(), transactionFee: policy } as RmbPricingSettings));
  }
});

test('fee percentage, cutoff and payment limit are central settings that recalculate prices', () => {
  const config = settings();
  assert.equal(calculateRmbPrice(source, 'express', { ...config, transactionFee: { ...config.transactionFee, freeUpToRmb: 500 } }).transactionFeeRmb, 0);
  assert.equal(calculateRmbPrice(source, 'express', { ...config, transactionFee: { ...config.transactionFee, percent: 4 } }).transactionFeeRmb, 20);
  const highCost = { ...source, rawCostRmb: 6000.01 };
  assert.throws(() => calculateRmbPrice(highCost, 'express', config), /per-payment limit.*Admin review/);
  assert.equal(calculateRmbPrice(highCost, 'express', { ...config, transactionFee: { ...config.transactionFee, maximumPaymentRmb: 7000 } }).transactionFeeRmb, 180.0003);
});

test('over-limit automatic preorders and laptops withhold prices; checkout cannot charge a stale price', async () => {
  const overLimit = product(); overLimit.combinations[0].sourceCost!.rawCostRmb = 6000.01;
  const priced = priceRmbProduct(overLimit, settings());
  assert.equal(priced.product.combinations[0].priceExpressPesewas, undefined);
  assert.equal(priced.product.combinations[0].priceTwoMonthsPesewas, undefined);
  assert.ok(priced.errors.every(error => error.includes('Admin review')));
  const preorderLaptop = laptop(); preorderLaptop.preorderCost!.rawCostRmb = 6000.01;
  assert.deepEqual(priceRmbLaptop(preorderLaptop, settings()).prices, {});
  const { db, rows } = database(); rows.set('preorderProducts/test', overLimit);
  await assert.rejects(submitPreorder({ customer: { name: 'Test', phone: '0241234567', email: 'test@example.com', location: 'Test' }, items: [{ productId: 'test', combinationId: 'default', delivery: 'express', quantity: 1, expectedPricePesewas: 141200 }] }, { db, notify: async () => {} }));
  assert.equal([...rows.keys()].filter(key => key.startsWith('preorders/')).length, 0);
});

test('legacy fixed-fee documents use the percentage rule on read without modifying bank bands or stored data', async () => {
  const { transactionFee: _policy, ...previous } = settings();
  const legacy = { ...previous, transactionFees: [{ minimum: 101, maximum: 500, fee: 6 }] };
  const original = structuredClone(legacy);
  const { db, rows } = database(); rows.set(`settings/${RMB_SETTINGS_ID}`, legacy);
  const upgraded = await getRmbPricingSettings(db);
  assert.deepEqual(upgraded.bankCharges, legacy.bankCharges);
  assert.deepEqual(upgraded.profitMargins, legacy.profitMargins);
  assert.deepEqual(upgraded.transactionFee, defaultRmbTransactionFee());
  assert.equal(calculateRmbPrice(source, 'express', upgraded).transactionFeeRmb, 15);
  assert.equal('transactionFees' in upgraded, false);
  assert.deepEqual(rows.get(`settings/${RMB_SETTINGS_ID}`), original);
  assert.throws(() => calculateRmbPrice(source, 'express', storedRmbSettings({ ...legacy, transactionFee: null })), /percentage/);
  await saveRmbPricingSettings(upgraded, { uid: 'test-admin' }, db);
  assert.deepEqual(rows.get(`settings/${RMB_SETTINGS_ID}`).bankCharges, legacy.bankCharges);
  assert.equal('transactionFees' in rows.get(`settings/${RMB_SETTINGS_ID}`), false);
});

test('range validation rejects negative values, inversions, shared endpoints and overlaps', () => {
  for (const key of ['bankCharges', 'profitMargins'] as const) {
    const field = key === 'bankCharges' ? 'charge' : 'percent';
    const invalidRows = [[{ minimum: -1, maximum: 5, [field]: 1 }], [{ minimum: 5, maximum: 4, [field]: 1 }], [{ minimum: 0, maximum: 100, [field]: 1 }, { minimum: 100, maximum: null, [field]: 1 }], [{ minimum: 0, maximum: null, [field]: 1 }, { minimum: 1, maximum: 2, [field]: 1 }], [{ minimum: 0, maximum: null, [field]: -1 }]];
    for (const rows of invalidRows) assert.throws(() => validateRmbPricingSettings({ ...settings(), [key]: rows }));
  }
  assert.throws(() => validateRmbPricingSettings({ ...settings(), exchangeRate: 0 }));
  assert.throws(() => validateRmbPricingSettings({ ...settings(), exchangeRate: -1 }));
  assert.equal(validateRmbPricingSettings(settings()).bankCharges[0].maximum, null);
});

test('profit-margin tables save and price both deliveries beyond the fifth band without a count limit', async () => {
  const profitMargins = Array.from({ length: 25 }, (_, i) => ({ minimum: i * 100, maximum: i === 24 ? null : (i + 1) * 100 - 0.01, percent: 10 + i }));
  const config = { ...settings(), exchangeRate: 1, bankCharges: [{ minimum: 0, maximum: null, charge: 0 }], profitMargins };
  const { db, rows } = database();
  await saveRmbPricingSettings(config, { uid: 'test-admin' }, db);
  const saved = await getRmbPricingSettings(db);
  assert.deepEqual(saved.profitMargins, profitMargins);
  assert.equal(rows.get(`settings/${RMB_SETTINGS_ID}`).profitMargins.length, 25);
  const cost = { rawCostRmb: 120, shippingExpressGhs: 500, shippingTwoMonthsGhs: 1100 };
  const express = calculateRmbPrice(cost, 'express', saved);
  const slow = calculateRmbPrice(cost, 'two-months', saved);
  assert.equal(express.marginPercent, 16);
  assert.equal(express.pricePesewas, 72000);
  assert.equal(slow.marginPercent, 22);
  assert.equal(slow.pricePesewas, 148900);
  assert.throws(() => validateRmbPricingSettings({ ...config, profitMargins: [] }), /at least one range/);
  assert.throws(() => validateRmbPricingSettings({ ...config, profitMargins: [...profitMargins, { minimum: 2500, maximum: null, percent: 1 }] }), /overlap/);
});

test('fixed bank-charge ranges retain their five-band limit', () => {
  const bankCharges = Array.from({ length: 6 }, (_, i) => ({ minimum: i * 100, maximum: i * 100 + 99.99, charge: 1 }));
  assert.throws(() => validateRmbPricingSettings({ ...settings(), bankCharges }), /Bank charges: configure one to five ranges/);
});

test('missing mandatory bands or source costs withhold automatic prices instead of using a stale manual value', () => {
  for (const config of [emptyRmbPricingSettings(), { ...settings(), bankCharges: [{ minimum: 2000, maximum: null, charge: 0 }] }, { ...settings(), profitMargins: [{ minimum: 5000, maximum: null, percent: 20 }] }]) {
    const result = priceRmbProduct(product(), config);
    assert.ok(result.errors.length);
    assert.equal(result.product.combinations[0].priceExpressPesewas, undefined);
  }
  assert.throws(() => calculateRmbPrice(undefined, 'express', settings()), /raw product cost/);
  assert.throws(() => calculateRmbPrice({ ...source, shippingExpressGhs: -1 }, 'express', settings()), /non-negative/);
});

test('all pricing inputs recalculate without overwriting source costs; manual legacy items remain unchanged', () => {
  const original = product(), before = structuredClone(original);
  const price = (config: RmbPricingSettings) => priceRmbProduct(original, config).product.combinations[0].priceExpressPesewas;
  assert.equal(price(settings()), 141200);
  assert.notEqual(price({ ...settings(), exchangeRate: 2.18 }), 141200);
  assert.notEqual(price({ ...settings(), bankCharges: [{ minimum: 0, maximum: null, charge: 50 }] }), 141200);
  assert.notEqual(price({ ...settings(), transactionFee: { ...defaultRmbTransactionFee(), percent: 5 } }), 141200);
  assert.notEqual(price({ ...settings(), profitMargins: [{ minimum: 0, maximum: null, percent: 10 }] }), 141200);
  assert.deepEqual(original, before);
  const changed = product(); changed.combinations[0].sourceCost!.shippingExpressGhs = 180;
  assert.notEqual(priceRmbProduct(changed, settings()).product.combinations[0].priceExpressPesewas, 141200);
  const manual = { ...original, pricingMode: 'manual' as const };
  assert.equal(priceRmbProduct(manual, emptyRmbPricingSettings()).product.combinations[0].priceExpressPesewas, 1);
});

test('public payloads strip private costs; preorder laptops use the engine while in-stock manual prices stay unchanged', () => {
  const priced = priceRmbProduct(product(), settings()).product;
  assert.equal(publicRmbProduct(priced).combinations[0].sourceCost, undefined);
  assert.equal(publicRmbLaptop(laptop()).preorderCost, undefined);
  assert.equal(publicRmbLaptop(laptop()).priceGhs, undefined);
  const config = DEFAULT_PRICING_CONFIG;
  const preorder = laptopToCatalogueItem(laptop(), config, settings());
  assert.equal(preorder.preorderPricesPesewas?.express, 141200);
  assert.equal(preorder.preorderPricesPesewas?.['two-months'], 149600);
  const stock = laptopToCatalogueItem(laptop('Available'), config, settings());
  const changed = laptopToCatalogueItem(laptop('Available'), config, { ...settings(), exchangeRate: 10 });
  assert.equal(stock.pricePesewas, 77700);
  assert.equal(changed.pricePesewas, stock.pricePesewas);
  assert.deepEqual(priceRmbLaptop(laptop('In Stock'), settings()).prices, {});
});

test('cart refresh uses server prices for both speeds and blocks a newly unpriced line', () => {
  const original = priceRmbProduct(product(), settings()).product;
  const addition = buildSingleCombinationAddition(original)!;
  let lines = addPreorderLine([], addition);
  const changed = priceRmbProduct(product(), { ...settings(), exchangeRate: 2.18 }).product;
  lines = refreshPreorderLines(lines, [changed]);
  assert.equal(lines[0].pricePesewas, changed.combinations[0].priceExpressPesewas);
  assert.equal(lines[0].pricesPesewas['two-months'], changed.combinations[0].priceTwoMonthsPesewas);
  assert.equal(preorderCartTotalPesewas(lines), lines[0].pricePesewas);
  const unavailable = refreshPreorderLines(lines, [priceRmbProduct(product(), emptyRmbPricingSettings()).product]);
  assert.equal(unavailable[0].pricingUnavailable, true);
  assert.equal(unavailable[0].pricePesewas, 0);
});

function database() {
  const rows = new Map<string, any>([[`settings/${RMB_SETTINGS_ID}`, settings()], ['preorderProducts/test', product()]]);
  const ref = (name: string, id: string) => ({ key: `${name}/${id}`, get: async () => ({ exists: rows.has(`${name}/${id}`), data: () => structuredClone(rows.get(`${name}/${id}`)) }) });
  const db = { collection: (name: string) => ({ doc: (id: string) => ref(name, id) }), batch: () => {
    const writes: (() => void)[] = []; return { set: (ref: any, value: any) => writes.push(() => rows.set(ref.key, structuredClone(value))), commit: async () => writes.forEach(write => write()) };
  }, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = []; const result = await fn({ get: (ref: any) => ref.get(), create: (ref: any, value: any) => writes.push(() => rows.set(ref.key, structuredClone(value))) }); writes.forEach(write => write()); return result;
  } } as unknown as Firestore;
  return { rows, db };
}

test('settings save is audited, uncached reads see edits, and no example rate is installed by default', async () => {
  const { db, rows } = database();
  await saveRmbPricingSettings({ ...settings(), exchangeRate: 2.18 }, { uid: 'test-admin' }, db);
  assert.equal((await getRmbPricingSettings(db)).exchangeRate, 2.18);
  assert.equal([...rows.keys()].filter(key => key.startsWith('admin_audit/')).length, 1);
  rows.delete(`settings/${RMB_SETTINGS_ID}`);
  assert.equal((await getRmbPricingSettings(db)).exchangeRate, null);
});

test('real preorder submission snapshots authoritative prices and never reprices past orders; stale quotes are rejected', async () => {
  const { db, rows } = database();
  const submission = { customer: { name: 'Test', phone: '0241234567', email: 'test@example.com', location: 'Test location' }, items: [{ productId: 'test', combinationId: 'default', delivery: 'express' as const, quantity: 2, expectedPricePesewas: 141200 }] };
  const first = await submitPreorder(submission, { db, notify: async () => {} });
  assert.equal(first.items[0].pricePesewas, 141200);
  rows.set(`settings/${RMB_SETTINGS_ID}`, { ...settings(), exchangeRate: 2.18 });
  await assert.rejects(submitPreorder(submission, { db, notify: async () => {} }), /Prices have changed/);
  const second = await submitPreorder({ ...submission, items: [{ ...submission.items[0], expectedPricePesewas: undefined }] }, { db, notify: async () => {} });
  assert.notEqual(second.items[0].pricePesewas, first.items[0].pricePesewas);
  assert.equal(rows.get(`preorders/${first.preorderId}`).items[0].pricePesewas, 141200);
  assert.equal(rows.get('preorderProducts/test').combinations[0].sourceCost.rawCostRmb, 500);
});

test('exchange rate and charges endpoints require administrator authentication', async () => {
  const app = express(); app.use(express.json()); app.use('/admin', createAdminRouter());
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  try { for (const method of ['GET', 'PUT']) assert.equal((await fetch(`http://127.0.0.1:${(server.address() as any).port}/admin/rmb-pricing`, { method })).status, 401); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});


test('a cart can switch from a withheld delivery to a correctly priced one', () => {
  const original = priceRmbProduct(product(), settings()).product;
  const lines = addPreorderLine([], buildSingleCombinationAddition(original)!);
  const config = { ...settings(), profitMargins: [{ minimum: 1200, maximum: null, percent: 20 }] };
  const refreshed = refreshPreorderLines(lines, [priceRmbProduct(product(), config).product]);
  assert.equal(refreshed[0].pricingUnavailable, true);
  const switched = setPreorderLineDelivery(refreshed, refreshed[0].id, 'two-months');
  assert.equal(switched[0].pricingUnavailable, false);
  assert.equal(switched[0].pricePesewas, 149600);
});

test('variants retain distinct RMB costs and order prices; an invalid delivery does not hide a valid delivery', async () => {
  const { db, rows } = database();
  const configured = product();
  configured.combinations.push({ combinationId: 'larger', selections: { capacity: 'large' }, sourceCost: { ...source, rawCostRmb: 600 } });
  rows.set('preorderProducts/test', configured);
  const priced = priceRmbProduct(configured, settings()).product;
  assert.notEqual(priced.combinations[1].priceExpressPesewas, priced.combinations[0].priceExpressPesewas);
  const order = await submitPreorder({ customer: { name: 'Test', phone: '0241234567', email: 'test@example.com', location: 'Test' }, items: [{ productId: 'test', combinationId: 'larger', delivery: 'express', quantity: 1, expectedPricePesewas: priced.combinations[1].priceExpressPesewas }] }, { db, notify: async () => {} });
  assert.equal(order.items[0].pricePesewas, priced.combinations[1].priceExpressPesewas);
  const partial = priceRmbProduct(product(), { ...settings(), profitMargins: [{ minimum: 1200, maximum: null, percent: 20 }] });
  assert.equal(partial.product.combinations[0].priceExpressPesewas, undefined);
  assert.equal(partial.product.combinations[0].priceTwoMonthsPesewas, 149600);
  assert.equal(partial.errors.length, 1);
});
