import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PreorderCartAddition,
  PreorderCartLine,
  addPreorderLine,
  preorderCartCount,
  preorderCartTotalPesewas,
  preorderLineId,
  removePreorderLine,
  setPreorderLineQuantity,
} from '../src/utils/usePreorderCart';
import { cedisToPesewas } from '../shared/money';

/**
 * The pre-order basket's rules.
 *
 * The identity of a line is the interesting part: the same product at two
 * delivery speeds is two prices and therefore two lines, while the same
 * product at the same speed must merge rather than stack up. Both are silent
 * failures — nobody reports a basket that looks slightly wrong, they just
 * abandon it.
 */

function addition(overrides: Partial<PreorderCartAddition> = {}): PreorderCartAddition {
  return {
    productId: 'shirt',
    productName: 'Field Shirt',
    combinationId: 'colour-black__size-xl',
    selectionLabel: 'Black, XL',
    delivery: 'express',
    pricePesewas: cedisToPesewas(145),
    ...overrides,
  };
}

test('a line id is the product, the combination and the delivery speed', () => {
  assert.equal(
    preorderLineId('shirt', 'colour-black', 'two-months'),
    'shirt__colour-black__two-months'
  );
});

test('adding something new appends a line of one', () => {
  const lines = addPreorderLine([], addition());
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 1);
  assert.equal(lines[0].id, 'shirt__colour-black__size-xl__express');
});

test('adding the same thing again merges rather than stacking a second row', () => {
  const lines = addPreorderLine(addPreorderLine([], addition()), addition());
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2);
});

test('the same product at a different delivery speed is a separate line', () => {
  // Two prices, so two lines. Merging them would mean one of the two prices
  // silently winning, and the customer paying it for both.
  const lines = addPreorderLine(
    addPreorderLine([], addition()),
    addition({ delivery: 'two-months', pricePesewas: cedisToPesewas(100) })
  );
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => line.delivery), ['express', 'two-months']);
});

test('a different combination of the same product is a separate line', () => {
  const lines = addPreorderLine(
    addPreorderLine([], addition()),
    addition({ combinationId: 'colour-navy__size-m', selectionLabel: 'Navy, M' })
  );
  assert.equal(lines.length, 2);
});

test('merging takes the newer price, so a stale basket cannot outlive the catalogue', () => {
  const lines = addPreorderLine(
    addPreorderLine([], addition({ pricePesewas: cedisToPesewas(145) })),
    addition({ pricePesewas: cedisToPesewas(160) })
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].pricePesewas, cedisToPesewas(160));
});

test('an explicit quantity is honoured and adds on merge', () => {
  const lines = addPreorderLine(
    addPreorderLine([], addition({ quantity: 3 })),
    addition({ quantity: 2 })
  );
  assert.equal(lines[0].quantity, 5);
});

test('quantity is clamped to at least one, whatever a caller asks for', () => {
  assert.equal(addPreorderLine([], addition({ quantity: 0 }))[0].quantity, 1);
  assert.equal(addPreorderLine([], addition({ quantity: -4 }))[0].quantity, 1);
});

test('stepping a quantity below one removes the line', () => {
  const lines = addPreorderLine([], addition());
  assert.deepEqual(setPreorderLineQuantity(lines, lines[0].id, 0), []);
});

test('a quantity is capped rather than growing without limit', () => {
  const lines = addPreorderLine([], addition());
  assert.equal(setPreorderLineQuantity(lines, lines[0].id, 5000)[0].quantity, 99);
});

test('setting a quantity leaves every other line alone', () => {
  const lines = addPreorderLine(
    addPreorderLine([], addition()),
    addition({ delivery: 'two-months', pricePesewas: cedisToPesewas(100) })
  );
  const updated = setPreorderLineQuantity(lines, lines[0].id, 4);
  assert.equal(updated[0].quantity, 4);
  assert.equal(updated[1].quantity, 1);
});

test('removing takes only the named line', () => {
  const lines = addPreorderLine(
    addPreorderLine([], addition()),
    addition({ delivery: 'two-months', pricePesewas: cedisToPesewas(100) })
  );
  const remaining = removePreorderLine(lines, lines[0].id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].delivery, 'two-months');
});

test('the badge counts units, and the total multiplies each line by its quantity', () => {
  const lines: PreorderCartLine[] = setPreorderLineQuantity(
    addPreorderLine(
      addPreorderLine([], addition()),
      addition({ delivery: 'two-months', pricePesewas: cedisToPesewas(100) })
    ),
    'shirt__colour-black__size-xl__express',
    2
  );
  assert.equal(preorderCartCount(lines), 3);
  // 145 × 2 + 100 = 390, in integer pesewas throughout.
  assert.equal(preorderCartTotalPesewas(lines), cedisToPesewas(390));
});

test('an empty basket totals zero rather than anything stranger', () => {
  assert.equal(preorderCartCount([]), 0);
  assert.equal(preorderCartTotalPesewas([]), 0);
});
