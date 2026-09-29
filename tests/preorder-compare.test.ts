import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_COMPARED, togglePreorderCompare } from '../src/utils/usePreorderCompare';
import { buildSingleCombinationAddition } from '../src/utils/preorderAdd';
import { PreorderProduct } from '../shared/types';
import { cedisToPesewas } from '../shared/money';

/**
 * Choosing what to compare, and the one place the comparison can sell.
 *
 * The cap is the interesting part: silently ignoring a fourth pick would leave
 * a customer tapping a control that appears to do nothing.
 */

test('the cap is three', () => {
  // Stated here so a change to it is a deliberate edit to a test, not a
  // number quietly raised in a component.
  assert.equal(MAX_COMPARED, 3);
});

test('picking adds, and picking again removes', () => {
  assert.deepEqual(togglePreorderCompare([], 'a'), ['a']);
  assert.deepEqual(togglePreorderCompare(['a', 'b'], 'a'), ['b']);
});

test('selection keeps the order things were picked in', () => {
  // The columns read left to right in the order chosen, so this is the order
  // of the screen, not an implementation detail.
  assert.deepEqual(togglePreorderCompare(togglePreorderCompare(['c'], 'a'), 'b'), ['c', 'a', 'b']);
});

test('the session starts from one product and goes looking for the next', () => {
  // A single column is not a comparison, so starting must lead to the picker
  // rather than to a lonely product on its own.
  assert.deepEqual(togglePreorderCompare([], 'a'), ['a']);
});

test('a fourth pick is refused rather than pushing one out', () => {
  // Dropping the oldest would take away something the customer chose without
  // saying so. The control is disabled at this point; this is the backstop.
  const full = ['a', 'b', 'c'];
  assert.deepEqual(togglePreorderCompare(full, 'd'), full);
});

test('removing one makes room again', () => {
  const full = ['a', 'b', 'c'];
  const freed = togglePreorderCompare(full, 'b');
  assert.deepEqual(freed, ['a', 'c']);
  assert.deepEqual(togglePreorderCompare(freed, 'd'), ['a', 'c', 'd']);
});

test('an already-compared product can still be removed when full', () => {
  assert.deepEqual(togglePreorderCompare(['a', 'b', 'c'], 'c'), ['a', 'b']);
});

/* -- the comparison's add button ------------------------------------------ */

function product(overrides: Partial<PreorderProduct> = {}): PreorderProduct {
  return {
    productId: 'belt', name: 'Web Belt', description: '', details: [], categoryId: 'apparel',
    galleryImagePaths: [], variantAxes: [],
    combinations: [{ combinationId: 'default', selections: {}, priceExpressPesewas: cedisToPesewas(50), priceTwoMonthsPesewas: cedisToPesewas(35) }],
    imageAssignments: [], deliveryOptions: ['express', 'two-months'], active: true,
    ...overrides,
  };
}

test('a single-combination product builds a line the cart can hold', () => {
  const addition = buildSingleCombinationAddition(product());
  assert.equal(addition?.combinationId, 'default');
  assert.equal(addition?.delivery, 'express');
  assert.equal(addition?.pricePesewas, cedisToPesewas(50));
});

test('...carrying both prices, so the cart can switch delivery later', () => {
  const addition = buildSingleCombinationAddition(product());
  assert.deepEqual(addition?.pricesPesewas, {
    express: cedisToPesewas(50),
    'two-months': cedisToPesewas(35),
  });
  assert.deepEqual(addition?.availableDeliveries, ['express', 'two-months']);
});

test('the delivery chosen is the product\'s first offered one', () => {
  const slow = product({ deliveryOptions: ['two-months'], combinations: [{ combinationId: 'default', selections: {}, priceTwoMonthsPesewas: cedisToPesewas(35) }] });
  assert.equal(buildSingleCombinationAddition(slow)?.delivery, 'two-months');
  assert.equal(buildSingleCombinationAddition(slow)?.pricePesewas, cedisToPesewas(35));
});

test('an unpriced product yields nothing rather than a free line', () => {
  const unpriced = product({ combinations: [{ combinationId: 'default', selections: {} }] });
  assert.equal(buildSingleCombinationAddition(unpriced), null);
});
