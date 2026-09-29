import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_PREORDER_FILTERS,
  PreorderFilterState,
  derivePreorderAxisFacets,
  filterPreorderProducts,
  lowestFor,
  similarAxisNames,
  toggleAxisValue,
  toggleCategoryId,
} from '../src/utils/preorderFilters';
import { PreorderCategory, PreorderProduct } from '../shared/types';
import { cedisToPesewas } from '../shared/money';

/**
 * The listing page's filter strip and its Advanced facets.
 *
 * Every rule here fails quietly when it goes wrong: a range that hides a
 * product the customer could afford, a sort that floats an unpriced item to the
 * top of a cheapest-first list, or a facet that zeroes every other option the
 * moment you tick one, all look like a thin catalogue rather than a bug.
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

/* -- the simple controls --------------------------------------------------- */

test('no filters returns everything, in the order given', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, EMPTY_PREORDER_FILTERS)), ['cheap', 'mid', 'dear', 'slow-only']);
});

test('a delivery filter keeps only products offering that speed', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ delivery: 'express' }))), ['cheap', 'mid', 'dear']);
});

test('a parent category also matches products filed under its children', () => {
  // "mid" is in Shirts, under Apparel. Someone filtering by Apparel expects to
  // see it; excluding it would make the parent look empty.
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ categoryIds: ['apparel'] }))), ['cheap', 'mid', 'slow-only']);
});

test('selecting the child alone narrows to it', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ categoryIds: ['shirts'] }))), ['mid']);
});

test('selecting two categories is a union, not an intersection', () => {
  // Multi-select exists to widen. Anding them would return nothing, since no
  // product is in two categories at once.
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ categoryIds: ['shirts', 'bags'] }))), ['mid', 'dear']);
});

test('a price range reads the delivery it was told to', () => {
  const express = withFilters({ priceBasis: 'express', maxCedis: '45' });
  const twoMonths = withFilters({ priceBasis: 'two-months', maxCedis: '45' });
  assert.equal(ids(filterPreorderProducts([cheap], categories, express)).length, 0);
  assert.deepEqual(ids(filterPreorderProducts([cheap], categories, twoMonths)), ['cheap']);
});

test('a minimum and a maximum together bracket the list', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ minCedis: '60', maxCedis: '200' }))), ['mid']);
});

test('a blank bound is open-ended rather than zero', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ maxCedis: '60' }))), ['cheap']);
});

test('an unparseable bound is ignored rather than emptying the list', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ maxCedis: 'abc' }))), ['cheap', 'mid', 'dear', 'slow-only']);
});

test('a product qualifies when ANY of its combinations falls in range', () => {
  const spread = product({
    productId: 'spread',
    combinations: [
      { combinationId: 'a', selections: { Size: 'S' }, priceExpressPesewas: cedisToPesewas(40) },
      { combinationId: 'b', selections: { Size: 'L' }, priceExpressPesewas: cedisToPesewas(900) },
    ],
  });
  assert.deepEqual(ids(filterPreorderProducts([spread], categories, withFilters({ maxCedis: '50' }))), ['spread']);
});

test('cheapest first sorts by the chosen delivery, unpriced last', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ sort: 'price-asc' }))), ['cheap', 'mid', 'dear', 'slow-only']);
});

test('dearest first reverses it, and still parks the unpriced last', () => {
  assert.deepEqual(ids(filterPreorderProducts(all, categories, withFilters({ sort: 'price-desc' }))), ['dear', 'mid', 'cheap', 'slow-only']);
});

test('sorting on two-months reorders, because the two prices do not rank alike', () => {
  assert.deepEqual(
    ids(filterPreorderProducts(all, categories, withFilters({ sort: 'price-asc', priceBasis: 'two-months' }))),
    ['slow-only', 'cheap', 'mid', 'dear']
  );
});

test('lowestFor returns null rather than zero when a speed is not offered', () => {
  assert.equal(lowestFor(slowOnly, 'express'), null);
  assert.equal(lowestFor(slowOnly, 'two-months'), cedisToPesewas(20));
});

/* -- the Advanced facets --------------------------------------------------- */

const axes = (names: Record<string, string[]>) =>
  Object.entries(names).map(([name, options]) => ({ name, options }));

const tee = product({ productId: 'tee', categoryId: 'shirts', variantAxes: axes({ Colour: ['Black', 'Navy'], Size: ['M', 'L'] }) });
const polo = product({ productId: 'polo', categoryId: 'shirts', variantAxes: axes({ Colour: ['Black', 'Red'], Size: ['L', 'XL'] }) });
/* No Size axis: its presence must stop Size surfacing for the whole selection. */
const scarf = product({ productId: 'scarf', categoryId: 'shirts', variantAxes: axes({ Colour: ['Black'] }) });

const facetOf = (rows: PreorderProduct[], filters: PreorderFilterState, name: string) =>
  derivePreorderAxisFacets(rows, categories, filters).find((facet) => facet.name === name);

test('an axis every product in the selection carries surfaces as a facet', () => {
  const names = derivePreorderAxisFacets([tee, polo], categories, EMPTY_PREORDER_FILTERS).map((f) => f.name);
  assert.deepEqual(names, ['Colour', 'Size']);
});

test('an axis only some of them carry does not surface at all', () => {
  // Scarf has no Size. Offering a Size filter would silently discard it the
  // moment anyone used it, rather than narrowing the products that have one.
  const names = derivePreorderAxisFacets([tee, polo, scarf], categories, EMPTY_PREORDER_FILTERS).map((f) => f.name);
  assert.deepEqual(names, ['Colour']);
});

test('a facet\'s options are the union across the selection', () => {
  const colour = facetOf([tee, polo], EMPTY_PREORDER_FILTERS, 'Colour');
  assert.deepEqual(colour?.options.map((o) => o.value), ['Black', 'Navy', 'Red']);
});

test('facets follow the category selection rather than the whole catalogue', () => {
  // Bags carry no axes, so widening to them should drop every facet.
  const bag = product({ productId: 'bag', categoryId: 'bags' });
  const shirtsOnly = derivePreorderAxisFacets([tee, polo, bag], categories, withFilters({ categoryIds: ['shirts'] }));
  const everything = derivePreorderAxisFacets([tee, polo, bag], categories, EMPTY_PREORDER_FILTERS);
  assert.deepEqual(shirtsOnly.map((f) => f.name), ['Colour', 'Size']);
  assert.deepEqual(everything.map((f) => f.name), []);
});

test('an empty selection yields no facets rather than throwing', () => {
  assert.deepEqual(derivePreorderAxisFacets([], categories, EMPTY_PREORDER_FILTERS), []);
});

test('counts report how many products offer each option', () => {
  const colour = facetOf([tee, polo], EMPTY_PREORDER_FILTERS, 'Colour');
  assert.deepEqual(
    colour?.options.map((o) => [o.value, o.count]),
    [['Black', 2], ['Navy', 1], ['Red', 1]]
  );
});

test('A FACET IGNORES ITS OWN SELECTIONS WHEN COUNTING', () => {
  // The rule that makes multi-select possible. With Navy ticked, Red is not on
  // screen alongside it — but its count must still say 1, because ticking it
  // would widen the list to include polo. Counting Red against the Navy
  // selection would read 0 and tell the customer there is nothing else to tick.
  const filters = withFilters({ axisValues: { Colour: ['Navy'] } });
  const colour = facetOf([tee, polo], filters, 'Colour');
  assert.deepEqual(
    colour?.options.map((o) => [o.value, o.count]),
    [['Black', 2], ['Navy', 1], ['Red', 1]]
  );
  assert.equal(colour?.options.find((o) => o.value === 'Navy')?.selected, true);
});

test('...but it does respect every OTHER facet', () => {
  // Only tee is Navy, and tee has no XL. With Navy ticked on Colour, the Size
  // facet must report XL as unreachable.
  const filters = withFilters({ axisValues: { Colour: ['Navy'] } });
  const size = facetOf([tee, polo], filters, 'Size');
  assert.deepEqual(
    size?.options.map((o) => [o.value, o.count]),
    [['M', 1], ['L', 1], ['XL', 0]]
  );
});

test('selecting a facet value narrows the products', () => {
  const filters = withFilters({ axisValues: { Colour: ['Red'] } });
  assert.deepEqual(ids(filterPreorderProducts([tee, polo], categories, filters)), ['polo']);
});

test('two values in one facet are OR', () => {
  const filters = withFilters({ axisValues: { Colour: ['Navy', 'Red'] } });
  assert.deepEqual(ids(filterPreorderProducts([tee, polo], categories, filters)), ['tee', 'polo']);
});

test('two different facets are AND', () => {
  // Navy narrows to tee; XL then excludes it, because tee has no XL.
  const filters = withFilters({ axisValues: { Colour: ['Navy'], Size: ['XL'] } });
  assert.deepEqual(ids(filterPreorderProducts([tee, polo], categories, filters)), []);
});

test('facet selections combine with the simple controls', () => {
  const filters = withFilters({ categoryIds: ['shirts'], delivery: 'express', axisValues: { Colour: ['Black'] } });
  assert.deepEqual(ids(filterPreorderProducts([tee, polo, dear], categories, filters)), ['tee', 'polo']);
});

test('ticking and unticking a facet value round-trips to an empty axis', () => {
  const once = toggleAxisValue({}, 'Colour', 'Black');
  assert.deepEqual(once, { Colour: ['Black'] });
  // The axis is removed rather than left as an empty array, so "is anything
  // selected" stays a simple check.
  assert.deepEqual(toggleAxisValue(once, 'Colour', 'Black'), {});
});

test('ticking and unticking a category round-trips', () => {
  assert.deepEqual(toggleCategoryId([], 'bags'), ['bags']);
  assert.deepEqual(toggleCategoryId(['bags', 'shirts'], 'bags'), ['shirts']);
});

/* -- the admin's axis-name hint -------------------------------------------- */

test('an axis name differing only by case or punctuation is flagged', () => {
  // Exact-name matching means these are two dimensions, and neither surfaces.
  assert.deepEqual(similarAxisNames('size', ['Size']), ['Size']);
  assert.deepEqual(similarAxisNames('Screen-Size', ['Screen size']), ['Screen size']);
});

test('one name containing the other is flagged', () => {
  assert.deepEqual(similarAxisNames('Size', ['Storage size']), ['Storage size']);
  assert.deepEqual(similarAxisNames('Storage size', ['Size']), ['Size']);
});

test('the identical name is not flagged against itself', () => {
  // Reusing the same name is the point; it is the near-miss that costs you.
  assert.deepEqual(similarAxisNames('Colour', ['Colour']), []);
});

test('an unrelated name is not flagged', () => {
  assert.deepEqual(similarAxisNames('Colour', ['Size', 'Capacity']), []);
});

test('a blank or punctuation-only name flags nothing', () => {
  assert.deepEqual(similarAxisNames('', ['Size']), []);
  assert.deepEqual(similarAxisNames('  -- ', ['Size']), []);
});
