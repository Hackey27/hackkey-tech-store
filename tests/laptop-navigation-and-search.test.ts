import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DismissibleStack } from '../src/utils/dismissibleStack';
import { SearchResultsOverlay } from '../src/components/SearchResultsOverlay';
import { laptopToCatalogueItems } from '../server/catalogue';
import { DEFAULT_PRICING_CONFIG } from '../server/pricingConfig';
import { variantLaptop, variantSettings } from './fixtures/laptopVariants';
import { formatPesewas } from '../shared/money';

test('Back dismisses only the top overlay, preserving its parent until the next Back', () => {
  const stack = new DismissibleStack();
  stack.add('interest');
  stack.add('gallery');
  assert.equal(stack.claim('interest', 'interest'), false);
  assert.equal(stack.claim('gallery', 'interest'), true);
  assert.equal(stack.claim('interest', 'interest'), false);
  assert.equal(stack.claim('interest'), true);
  assert.equal(stack.claim('gallery'), false);
});

test('overlay registration survives effect cleanup and repeated registration without duplicate history levels', () => {
  const stack = new DismissibleStack();
  stack.add('gallery');
  stack.add('gallery');
  assert.equal(stack.claim('gallery', 'gallery'), false);
  stack.remove('gallery');
  stack.add('gallery');
  assert.equal(stack.claim('gallery'), true);
  assert.equal(stack.claim('gallery'), false);
});

test('laptop search distinguishes rows by specs and shows the configured delivery prices', () => {
  const laptop = variantLaptop('Pre-order');
  const items = laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG, variantSettings());
  const render = (rows: typeof items) => renderToStaticMarkup(React.createElement(SearchResultsOverlay, { query: 'Envy', items: rows, loading: false, onClose() {}, onSelect() {} }));
  const html = render(items);
  assert.match(html, /CPU:.*Intel Core i7-1355U/);
  assert.match(html, /AMD Ryzen 7 7730U/);
  assert.match(html, /RAM:.*8GB/);
  assert.match(html, /Storage:.*512GB/);
  assert.doesNotMatch(html, /Laptops on sale/);
  assert.match(html, /2–3 weeks/);
  assert.match(html, /6–8 weeks/);
  for (const item of items) for (const price of Object.values(item.preorderPricesPesewas!)) assert.ok(html.includes(formatPesewas(price)));
  laptop.preorderDeliveryOptions = ['two-months'];
  const singleDelivery = render(laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG, variantSettings()));
  assert.doesNotMatch(singleDelivery, /2–3 weeks/);
  assert.match(singleDelivery, /6–8 weeks/);
  const inStock = render(laptopToCatalogueItems(variantLaptop(), DEFAULT_PRICING_CONFIG));
  assert.doesNotMatch(inStock, /2–3 weeks|6–8 weeks/);
  assert.ok(inStock.includes(formatPesewas(120000)));
});

test('non-laptop search retains its product name, category and selling price', () => {
  const html = renderToStaticMarkup(React.createElement(SearchResultsOverlay, { query: 'AMOS', items: [{ kind: 'product', itemId: 'AMOS', name: 'AMOS', categoryId: 'STATS', categoryName: 'Statistics software', pricePesewas: 15000 }], loading: false, onClose() {}, onSelect() {} }));
  assert.match(html, /AMOS/);
  assert.match(html, /Statistics software/);
  assert.ok(html.includes(formatPesewas(15000)));
  assert.doesNotMatch(html, /CPU:|RAM:|Storage:|2–3 weeks|6–8 weeks/);
});
