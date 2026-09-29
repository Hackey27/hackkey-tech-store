import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupPreorderResults,
  preorderResultHref,
  searchPreorder,
} from '../src/utils/preorderSearch';
import { PreorderProduct } from '../shared/types';
import { cedisToPesewas } from '../shared/money';

/**
 * Search within the pre-order section.
 *
 * The rule under test is which rows a query produces. A product's own text
 * excludes its variant options, so a bare product word matches the product and
 * all of its combinations, while a word naming a variant matches only the
 * combinations carrying it. Get that backwards and "black" returns every
 * product that has a black anything, as a whole product.
 */

const bag: PreorderProduct = {
  productId: 'canvas-bag',
  name: 'Canvas Bag',
  description: 'Roomy tote for the market.',
  details: [{ label: 'Material', value: 'Cotton canvas' }],
  categoryId: 'bags',
  galleryImagePaths: [],
  previewImagePath: 'preview.webp',
  variantAxes: [
    { name: 'Colour', options: ['Black', 'Navy'] },
    { name: 'Size', options: ['M', 'XL'] },
  ],
  combinations: [
    { combinationId: 'colour-black', selections: { Colour: 'Black' }, priceExpressPesewas: cedisToPesewas(120) },
    { combinationId: 'colour-black__size-xl', selections: { Colour: 'Black', Size: 'XL' }, priceExpressPesewas: cedisToPesewas(145) },
    { combinationId: 'colour-navy__size-m', selections: { Colour: 'Navy', Size: 'M' }, priceExpressPesewas: cedisToPesewas(120) },
  ],
  imageAssignments: [{ selections: { Colour: 'Black' }, imagePath: 'black.webp' }],
  deliveryOptions: ['express'],
  active: true,
};

/** No axes: its single implicit combination must never become a blank row. */
const belt: PreorderProduct = {
  productId: 'web-belt',
  name: 'Web Belt',
  description: '',
  details: [],
  categoryId: 'bags',
  galleryImagePaths: [],
  variantAxes: [],
  combinations: [{ combinationId: 'default', selections: {}, priceTwoMonthsPesewas: cedisToPesewas(30) }],
  imageAssignments: [],
  deliveryOptions: ['two-months'],
  active: true,
};

const keys = (query: string, products = [bag, belt]) =>
  searchPreorder(products, query).map((result) => result.key);

test('an empty query returns nothing rather than everything', () => {
  // The overlay only opens on a typed query; returning the catalogue here
  // would render it behind the box the moment it gains focus.
  assert.deepEqual(searchPreorder([bag], ''), []);
  assert.deepEqual(searchPreorder([bag], '   '), []);
});

test('a product word returns the product and all of its combinations', () => {
  assert.deepEqual(keys('canvas'), [
    'canvas-bag',
    'canvas-bag:colour-black',
    'canvas-bag:colour-black__size-xl',
    'canvas-bag:colour-navy__size-m',
  ]);
});

test('a variant word returns only the combinations carrying it', () => {
  // Crucially NOT the product row: the product's own text does not mention
  // Black, so "black" is a narrowing word, not a product word.
  assert.deepEqual(keys('black'), [
    'canvas-bag:colour-black',
    'canvas-bag:colour-black__size-xl',
  ]);
});

test('the worked example lands on one combination', () => {
  assert.deepEqual(keys('black xl bag'), ['canvas-bag:colour-black__size-xl']);
});

test('tokens may arrive in any order', () => {
  assert.deepEqual(keys('bag xl black'), ['canvas-bag:colour-black__size-xl']);
});

test('every token must match, not merely one', () => {
  assert.deepEqual(keys('black tractor'), []);
});

test('matching is case-insensitive and accent-folded, as the software search is', () => {
  assert.deepEqual(keys('BLACK XL'), ['canvas-bag:colour-black__size-xl']);
  assert.deepEqual(keys('cánvas').length > 0, true);
});

test('a detail value is searchable', () => {
  assert.deepEqual(keys('cotton').includes('canvas-bag'), true);
});

test('an axis NAME is searchable, not just its options', () => {
  // "colour" should reach the combinations that name a colour.
  assert.deepEqual(keys('colour'), [
    'canvas-bag:colour-black',
    'canvas-bag:colour-black__size-xl',
    'canvas-bag:colour-navy__size-m',
  ]);
});

test('a product with no variants yields one row, never a blank combination row', () => {
  assert.deepEqual(keys('belt'), ['web-belt']);
});

test('a combination row carries its readable label and its own price', () => {
  const [row] = searchPreorder([bag], 'black xl');
  assert.equal(row.selectionLabel, 'Black, XL');
  assert.equal(row.pricePesewas, cedisToPesewas(145));
  assert.equal(row.delivery, 'express');
});

test('a partial combination labels the axis it leaves open', () => {
  const row = searchPreorder([bag], 'black').find((r) => r.combination?.combinationId === 'colour-black');
  assert.equal(row?.selectionLabel, 'Black, any size');
});

test('a combination row shows the image the product page will show', () => {
  // Resolved through the same rule, so the result and the page agree.
  const row = searchPreorder([bag], 'black').find((r) => r.combination?.combinationId === 'colour-black');
  assert.equal(row?.imageUrl, 'black.webp');
});

test('a product row links to the product, a combination row to that combination', () => {
  const [product] = searchPreorder([bag], 'canvas');
  assert.equal(preorderResultHref(product), '/preorder/canvas-bag');

  const [combination] = searchPreorder([bag], 'black xl');
  assert.equal(
    preorderResultHref(combination),
    '/preorder/canvas-bag?combination=colour-black__size-xl'
  );
});

test('the link is a refinement, so dropping the parameter still names the product', () => {
  const [combination] = searchPreorder([bag], 'black xl');
  assert.equal(preorderResultHref(combination).split('?')[0], '/preorder/canvas-bag');
});

test('rows are grouped under their product', () => {
  const groups = groupPreorderResults(searchPreorder([bag, belt], 'canvas'));
  assert.deepEqual(groups.map((group) => group.product.productId), ['canvas-bag']);
  assert.equal(groups[0].rows.length, 4);
});

test('matching is by substring, so a category name reaches its products', () => {
  // Belt is filed under "bags", and "bag" is a substring of it. Same semantics
  // as the software search, which also uses includes() per token.
  assert.deepEqual(
    groupPreorderResults(searchPreorder([bag, belt], 'bag')).map((g) => g.product.productId),
    ['canvas-bag', 'web-belt']
  );
});

test('an unpriced combination reports no price rather than zero', () => {
  const product: PreorderProduct = {
    ...bag,
    combinations: [{ combinationId: 'colour-navy', selections: { Colour: 'Navy' } }],
  };
  const [row] = searchPreorder([product], 'navy');
  assert.equal(row.pricePesewas, null);
  assert.equal(row.delivery, null);
});
