import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_PREORDER_FILTERS,
  PreorderFilterState,
  filterPreorderProducts,
  lowestFor,
} from '../src/utils/preorderFilters';
import { PreorderCategory, PreorderProduct } from '../shared/types';
import { cedisToPesewas } from '../shared/money';

/**
 * The listing page's filter strip.
 *
 * Every rule here fails quietly when it goes wrong: a range that hides a
 * product the customer could afford, or a sort that floats an unpriced item to
 * the top of a cheapest-first list, looks like a thin catalogue rather than a
 * bug.
 */

const categories: PreorderCategory[] = [
  { categoryId: 'apparel', name: 'Apparel', parentId: null },
  { categoryId: 'shirts', name: 'Shirts', parentId: 'apparel' },
  { categoryId: 'bags', name: 'Bags', parentId: null },
];

function product(overrides: Partial<PreorderProduct> & { productId: string }): PreorderProduct {
  return {
    name: overrides.productId,
    description: '',
    details: [],
    categoryId: 'apparel',
    galleryImagePaths: [],
    variantAxes: [],
    combinations: [{ combinationId: 'default', selections: {}, priceExpressPesewas: cedisToPesewas(100), priceTwoMonthsPesewas: cedisToPesewas(70) }],
    imageAssignments: [],
    deliveryOptions: ['express', 'two-months'],
    active: true,
    ...overrides,
  };
}

const cheap = product({ productId: 'cheap', combinations: [{ combinationId: 'default', selections: {}, priceExpressPesewas: cedisToPesewas(50), priceTwoMonthsPesewas: cedisToPesewas(40) }] });
const mid = product({ productId: 'mid', categoryId: 'shirts' });
const dear = product({ productId: 'dear', categoryId: 'bags', combinations: [{ combinationId: 'default', selections: {}, priceExpressPesewas: cedisToPesewas(500), priceTwoMonthsPesewas: cedisToPesewas(300) }] });
const slowOnly = product({ productId: 'slow-only', deliveryOptions: ['two-months'], combinations: [{ combinationId: 'default', selections: {}, priceTwoMonthsPesewas: cedisToPesewas(20) }] });

const all = [cheap, mid, dear, slowOnly];
const ids = (rows: PreorderProduct[]) => rows.map((row) => row.productId);
const withFilters = (patch: Partial<PreorderFilterState>) => ({ ...EMPTY_PREORDER_FILTERS, ...patch });

test('no filters returns everything, in the order given', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, EMPTY_PREORDER_FILTERS)), ['cheap', 'mid', 'dear', 'slow-only']);
});

test('a delivery filter keeps only products offering that speed', () => {
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ delivery: 'express' }))),
    ['cheap', 'mid', 'dear']
  );
});

test('a parent category also matches products filed under its children', () => {
  // "mid" is in Shirts, which sits under Apparel. Someone filtering by Apparel
  // expects to see it; excluding it would make the parent look empty.
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ categoryId: 'apparel' }))),
    ['cheap', 'mid', 'slow-only']
  );
});

test('choosing a subcategory narrows to it alone', () => {
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ categoryId: 'apparel', subcategoryId: 'shirts' }))),
    ['mid']
  );
});

test('a price range reads the delivery it was told to', () => {
  // 45 express but 40 two-months: the same range includes "cheap" only when
  // the basis is the two-months price.
  const express = withFilters({ priceBasis: 'express', maxCedis: '45' });
  const twoMonths = withFilters({ priceBasis: 'two-months', maxCedis: '45' });
  assert.equal(ids(filterPreorderProducts([cheap], categories, express)).length, 0);
  assert.deepEqual(ids(filterPreorderProducts([cheap], categories, twoMonths)), ['cheap']);
});

test('a minimum and a maximum together bracket the list', () => {
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ minCedis: '60', maxCedis: '200' }))),
    ['mid']
  );
});

test('a blank bound is open-ended rather than zero', () => {
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ minCedis: '', maxCedis: '60' }))),
    ['cheap']
  );
});

test('an unparseable bound is ignored rather than emptying the list', () => {
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ maxCedis: 'abc' }))),
    ['cheap', 'mid', 'dear', 'slow-only']
  );
});

test('a product qualifies when ANY of its combinations falls in range', () => {
  // The customer is asking what they could buy for the money. A product whose
  // cheapest variant is affordable belongs in the list even though its
  // dearest is not.
  const spread = product({
    productId: 'spread',
    combinations: [
      { combinationId: 'a', selections: { Size: 'S' }, priceExpressPesewas: cedisToPesewas(40) },
      { combinationId: 'b', selections: { Size: 'L' }, priceExpressPesewas: cedisToPesewas(900) },
    ],
  });
  assert.deepEqual(ids(filterPreorderProducts([spread], categories, withFilters({ maxCedis: '50' }))), ['spread']);
});

test('a product with no price at the chosen basis drops out of a range', () => {
  // slow-only carries no express price at all.
  assert.deepEqual(
    ids(filterPreorderProducts([slowOnly], categories, withFilters({ priceBasis: 'express', maxCedis: '10000' }))),
    []
  );
});

test('cheapest first sorts by the chosen delivery', () => {
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ sort: 'price-asc' }))),
    ['cheap', 'mid', 'dear', 'slow-only']
  );
});

test('dearest first reverses it, and still parks the unpriced last', () => {
  // slow-only has no express price. It must not lead either ordering.
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ sort: 'price-desc' }))),
    ['dear', 'mid', 'cheap', 'slow-only']
  );
});

test('sorting on two-months reorders, because the two prices do not rank alike', () => {
  const rows = ids(filterPreorderProducts(all, categories, withFilters({ sort: 'price-asc', priceBasis: 'two-months' })));
  assert.deepEqual(rows, ['slow-only', 'cheap', 'mid', 'dear']);
});

test('filters combine rather than override each other', () => {
  const rows = filterPreorderProducts(
    all,
    categories,
    withFilters({ delivery: 'express', categoryId: 'apparel', sort: 'price-asc' })
  );
  assert.deepEqual(ids(rows), ['cheap', 'mid']);
});

test('lowestFor returns null rather than zero when a speed is not offered', () => {
  assert.equal(lowestFor(slowOnly, 'express'), null);
  assert.equal(lowestFor(slowOnly, 'two-months'), cedisToPesewas(20));
});
