import { refreshLaptopCart, unavailableLaptopLine } from '../src/utils/laptopCart';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { variantLaptop, variantSettings } from './fixtures/laptopVariants';
import { cpuLabel, laptopItemUrl, laptopVariantOption, pricedLaptopVariant, resolveLaptopListing, switchLaptopVariant, validateLaptopVariants } from '../shared/laptopVariants';
import { calculateRmbPrice, emptyRmbPricingSettings } from '../shared/rmbPricing';
import { laptopToCatalogueItems, matchesSearch } from '../server/catalogue';
import { DEFAULT_PRICING_CONFIG } from '../server/pricingConfig';
import { createLaptopOrder } from '../server/orders';
import { publicOrder } from '../server/publicOrder';
import { cartItemToCheckoutItem } from '../src/utils/checkout';
import { cartLineDetail } from '../src/utils/cartLineDetail';
import { filterLaptops, emptyLaptopFilters } from '../src/utils/laptopFilters';
import { LaptopVariantPurchasePanel } from '../src/components/LaptopVariantPurchasePanel';
import { LaptopVariantBuilder } from '../src/admin/LaptopVariantBuilder';
import { LaptopSection } from '../src/components/LaptopSection';

test('builder rejects empty property values, CPU labels duplicated case-insensitively and duplicate combinations', () => {
  const cases: Array<[(laptop: ReturnType<typeof variantLaptop>) => void, RegExp]> = [
    [l => { l.variantConfig!.cpus[0].prefix = ' '; }, /cannot be empty/],
    [l => { l.variantConfig!.cpus[0].model = ''; }, /cannot be empty/],
    [l => { l.variantConfig!.ram[0].value = ''; }, /cannot be empty/],
    [l => { l.variantConfig!.storage[0].value = ''; }, /cannot be empty/],
    [l => { l.variantConfig!.cpus[1] = { id: 'amd', prefix: ' intel ', model: 'CORE i7-1355u' }; }, /Duplicate CPU/],
    [l => { l.variantConfig!.ram[1].value = '8gb'; }, /Duplicate RAM/],
    [l => { l.variantConfig!.storage[1].value = '256gb'; }, /Duplicate Storage/],
    [l => { l.variantConfig!.rows.push({ ...l.variantConfig!.rows[0], id: 'new' }); }, /already exists/],
    [l => { l.variantConfig!.rows[0].cpuId = ''; }, /choose CPU/],
    [l => { l.variantConfig!.rows[0].priceGhs = 0; }, /greater than zero/],
    [l => { l.variantConfig!.rows[0].priceGhs = NaN; }, /greater than zero/],
    [l => { l.variantConfig!.rows[0].priceGhs = 1.001; }, /two decimals/],
    [l => { l.variantConfig!.rows = []; }, /at least one complete/],
    [l => { l.variantConfig!.rows[0].id = 'unsafe/path'; }, /IDs/]
  ];
  for (const [change, error] of cases) { const laptop = variantLaptop(); change(laptop); assert.throws(() => validateLaptopVariants(laptop), error); }
  assert.doesNotThrow(() => validateLaptopVariants(variantLaptop()));
  assert.equal(cpuLabel({ prefix: ' Intel ', model: ' Core i7 ' }), 'Intel Core i7');
});

test('Available variants use GHS as-is despite global adjustments, promotions, or invalid RMB settings', () => {
  const pricing = structuredClone(DEFAULT_PRICING_CONFIG);
  pricing.silentAdjustment = { enabled: true, percent: 50 };
  const items = laptopToCatalogueItems(variantLaptop(), pricing, emptyRmbPricingSettings());
  assert.deepEqual(items.map(item => item.pricePesewas), [120000, 150000, 145000]);
  assert.ok(items.every(item => !item.promoLabel && !item.preorderPricesPesewas && !item.laptop?.variantConfig));
});

test('Pre-order rows reuse the complete engine with common shipping, separate delivery margins and live settings', () => {
  const laptop = variantLaptop('Pre-order'), settings = variantSettings();
  const row = laptop.variantConfig!.rows[0];
  const option = laptopVariantOption(laptop, row.id, settings);
  for (const delivery of ['express', 'two-months'] as const) assert.equal(option.deliveryPrices?.[delivery], calculateRmbPrice({ ...laptop.preorderCost, rawCostRmb: row.priceRmb! }, delivery, settings).pricePesewas);
  const changed = laptopVariantOption(laptop, row.id, { ...settings, exchangeRate: 2 });
  assert.notEqual(changed.pricePesewas, option.pricePesewas);
  assert.equal(row.priceRmb, 1000);
  assert.equal(laptop.preorderCost?.rawCostRmb, 400);
  const items = laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG, settings);
  assert.ok(items.every(item => !item.laptop?.preorderCost && !item.laptop?.variantConfig));
});

test('availability switching keeps distinct prices and blocks missing new-currency inputs; toggle off restores one legacy listing', () => {
  const laptop = variantLaptop(); const saved = structuredClone(laptop.variantConfig);
  laptop.availability = 'Pre-order'; validateLaptopVariants(laptop);
  assert.equal(laptopVariantOption(laptop, 'intel-8', variantSettings()).currencyBasis, 'RMB');
  laptop.availability = 'Available'; validateLaptopVariants(laptop);
  assert.deepEqual(laptop.variantConfig, saved);
  delete laptop.variantConfig!.rows[0].priceRmb; laptop.availability = 'Pre-order';
  assert.throws(() => validateLaptopVariants(laptop), /RMB.*Availability changed/);
  laptop.variantsEnabled = false;
  assert.doesNotThrow(() => validateLaptopVariants(laptop));
  laptop.availability = 'Available';
  const items = laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG);
  assert.equal(items.length, 1); assert.equal(items[0].itemId, laptop.laptopId);
  assert.equal(items[0].pricePesewas, 77700); assert.equal(items[0].laptop?.processor, 'Original CPU');
  assert.equal(laptop.variantConfig?.rows.length, 3);
  delete laptop.variantsEnabled;
  assert.equal(laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG).length, 1);
});

test('grids, filters and server search expose each variant; URL resolves exactly and switching changes URL and price', () => {
  const items = laptopToCatalogueItems(variantLaptop(), DEFAULT_PRICING_CONFIG, variantSettings());
  assert.equal(items.length, 3); assert.equal(new Set(items.map(item => item.itemId)).size, 3);
  assert.equal(items.filter(item => matchesSearch(item, 'hp envy')).length, 3);
  assert.equal(items.filter(item => matchesSearch(item, '16gb')).length, 2);
  assert.equal(items.filter(item => matchesSearch(item, 'ryzen')).length, 1);
  assert.equal(filterLaptops(items, { ...emptyLaptopFilters(), query: 'Ryzen 16GB' }).length, 1);
  const item = resolveLaptopListing(items, 'TEST-VARIANTS', 'intel-8')!;
  assert.equal(laptopItemUrl(item), '/laptops/TEST-VARIANTS?variant=intel-8');
  assert.equal(resolveLaptopListing(items, 'TEST-VARIANTS')?.itemId, item.itemId);
  assert.equal(resolveLaptopListing(items, 'TEST-VARIANTS', 'removed'), undefined);
  const current = item.laptopVariantOptions![0];
  const next = switchLaptopVariant(item.laptopVariantOptions!, current, 'ramId', 'r16')!;
  const changed = resolveLaptopListing(items, 'TEST-VARIANTS', next.rowId)!;
  assert.equal(changed.pricePesewas, 150000);
  assert.equal(laptopItemUrl(changed), '/laptops/TEST-VARIANTS?variant=intel-16');
  assert.equal(switchLaptopVariant(item.laptopVariantOptions!, current, 'storageId', 's512'), undefined);
  assert.equal(switchLaptopVariant(item.laptopVariantOptions!, current, 'ramId', 'r32'), undefined);
  assert.equal(switchLaptopVariant(item.laptopVariantOptions!, current, 'cpuId', 'amd')?.rowId, 'amd-16');
});

test('selection renders before other variants, visible check chips and disabled missing combinations, with compact type and the interest action', () => {
  const item = laptopToCatalogueItems(variantLaptop(), DEFAULT_PRICING_CONFIG)[0];
  const html = renderToStaticMarkup(React.createElement(LaptopVariantPurchasePanel, { item, onDeliveryChange: () => {}, onChange: () => {}, onInterest: () => {} }));
  assert.ok(html.indexOf('Your selection') < html.indexOf('Other variants for this model'));
  assert.match(html, /text-\[9\.775px\]/); assert.match(html, /text-\[8\.5px\]/);
  assert.match(html, /aria-pressed="true"/); assert.match(html, /lucide-check/);
  assert.match(html, /disabled=""[^>]*>.*?32GB/);
  const admin = renderToStaticMarkup(React.createElement(LaptopVariantBuilder, { laptop: variantLaptop(), onChange: () => {} }));
  assert.match(admin, /Add combination/); assert.doesNotMatch(admin, /<select/);
  assert.match(admin, /min-\[641px\]:grid-cols-4/);
});

test('laptop listing and detail never render a 6–8 month delivery window', () => {
  for (const availability of ['Available', 'Pre-order']) {
    const items = laptopToCatalogueItems(variantLaptop(availability), DEFAULT_PRICING_CONFIG, variantSettings());
    for (const variantRowId of [undefined, 'intel-8']) {
      const html = renderToStaticMarkup(React.createElement(LaptopSection, { items, productId: variantRowId ? 'TEST-VARIANTS' : undefined, variantRowId, onOpen: () => {}, onBack: () => {}, searchQuery: '', onSearchClose: () => {}, advancedOpen: false, onAdvancedOpenChange: () => {} }));
      assert.doesNotMatch(html, /6\s*[–-]\s*8\s*months/i);
    }
  }
});

test('cart checkout and authoritative orders snapshot selection, currency, delivery and charged price; history remains fixed', async () => {
  for (const availability of ['Available', 'Pre-order']) {
    const laptop = variantLaptop(availability), settings = variantSettings();
    const item = laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG, settings)[0];
    const price = availability === 'Available' ? item.pricePesewas! : item.preorderPricesPesewas!['two-months']!;
    const cart = { id: item.itemId, product: { ...item, pricePesewas: price, ...(availability === 'Pre-order' ? { laptopDelivery: 'two-months' as const } : {}) }, quantity: 2 };
    const checkout = cartItemToCheckoutItem(cart);
    assert.equal(checkout.laptopId, laptop.laptopId); assert.equal(checkout.laptopVariantRowId, 'intel-8');
    assert.match(cartLineDetail(cart), /Intel Core i7-1355U.*8GB.*256GB/);
    const dependencies = { findLaptop: async () => laptop, getPricingConfig: async () => { throw new Error('Available variants must not use pricing adjustments'); }, getRmbPricingSettings: async () => { if (availability === 'Available') throw new Error('Available variants must not read RMB settings'); return settings; } };
    const request = { customerName: 'Test Customer', phone: '0551234567', email: 'test@example.com', items: [checkout] };
    const order = await createLaptopOrder(request, checkout, 'CART-test', dependencies);
    assert.equal(order.amountPesewas, price * 2);
    assert.deepEqual(order.laptopVariant, { laptopId: laptop.laptopId, rowId: 'intel-8', cpu: 'Intel Core i7-1355U', ram: '8GB', storage: '256GB', currencyBasis: availability === 'Available' ? 'GHS' : 'RMB', unitPricePesewas: price, ...(availability === 'Pre-order' ? { delivery: 'two-months' } : {}) });
    assert.deepEqual(publicOrder(order).laptopVariant, order.laptopVariant);
    laptop.variantConfig!.rows[0].priceGhs = 9999; settings.exchangeRate = 9;
    assert.equal(order.amountPesewas, price * 2); assert.equal(order.laptopVariant!.unitPricePesewas, price);
    await assert.rejects(createLaptopOrder(request, checkout, 'CART-test', dependencies), /price has changed|valid price/);
    laptop.variantsEnabled = false;
    await assert.rejects(createLaptopOrder(request, checkout, 'CART-test', dependencies), /no longer enabled/);
  }
});

test('unpriced, deleted, over-limit and unsupported delivery combinations cannot be ordered', () => {
  const laptop = variantLaptop('Pre-order');
  assert.throws(() => pricedLaptopVariant(laptop, 'deleted', 'express', variantSettings()), /no longer exists/);
  assert.throws(() => pricedLaptopVariant(laptop, 'intel-8', undefined, variantSettings()), /valid price/);
  laptop.preorderDeliveryOptions = ['express'];
  assert.throws(() => pricedLaptopVariant(laptop, 'intel-8', 'two-months', variantSettings()), /valid price/);
  laptop.variantConfig!.rows[0].priceRmb = 6001;
  assert.throws(() => pricedLaptopVariant(laptop, 'intel-8', 'express', variantSettings()), /valid price/);
});

test('cart refresh uses selected delivery prices and disables removed rows without changing old snapshots', () => {
  const laptop = variantLaptop('Pre-order');
  const original = laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG, variantSettings());
  const lines = [{ id: original[0].itemId, product: { ...original[0], laptopDelivery: 'two-months' as const, pricePesewas: original[0].preorderPricesPesewas!['two-months'] }, quantity: 1 }];
  const savedPrice = lines[0].product.pricePesewas;
  const current = laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG, { ...variantSettings(), exchangeRate: 2 });
  const refreshed = refreshLaptopCart(lines, current);
  assert.equal(refreshed[0].product.pricePesewas, current[0].preorderPricesPesewas!['two-months']);
  assert.notEqual(refreshed[0].product.pricePesewas, savedPrice);
  assert.equal(lines[0].product.pricePesewas, savedPrice);
  assert.equal(unavailableLaptopLine(refreshed), false);
  assert.equal(unavailableLaptopLine(refreshLaptopCart(lines, [])), true);
});
