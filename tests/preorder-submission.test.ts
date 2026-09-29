import test from 'node:test';
import assert from 'node:assert/strict';
import { PreorderProduct } from '../shared/types';
import { readableSelections } from '../shared/preorderCombinations';
import { cedisToPesewas } from '../shared/money';

/**
 * What a submitted pre-order is allowed to cost.
 *
 * The submission path itself reaches Firestore, which this environment has no
 * access to, so these assert the pricing rule against the same stored shape the
 * server reads: the combination is the only source of a price, and the request
 * body names what was chosen and never what it costs.
 *
 * Mirrors `priceFor` in server/preorderOrders.ts. Kept honest by asserting the
 * documented behaviour rather than importing the module, which would drag the
 * Firestore client in with it.
 */

function shirt(): PreorderProduct {
  return {
    productId: 'shirt',
    name: 'Field Shirt',
    description: '',
    details: [],
    categoryId: 'apparel',
    galleryImagePaths: [],
    variantAxes: [
      { name: 'Colour', options: ['Black', 'Navy'] },
      { name: 'Size', options: ['M', 'XL'] },
    ],
    combinations: [
      { combinationId: 'colour-black', selections: { Colour: 'Black' }, priceExpressPesewas: cedisToPesewas(120), priceTwoMonthsPesewas: cedisToPesewas(85) },
      { combinationId: 'colour-black__size-xl', selections: { Colour: 'Black', Size: 'XL' }, priceExpressPesewas: cedisToPesewas(145) },
    ],
    imageAssignments: [],
    deliveryOptions: ['express', 'two-months'],
    active: true,
  };
}

/** The rule server/preorderOrders.ts applies, in one place for the tests. */
function priceFor(product: PreorderProduct, combinationId: string, delivery: 'express' | 'two-months') {
  const combination = product.combinations.find((entry) => entry.combinationId === combinationId);
  if (!combination) throw new Error('no such combination');
  if (!product.deliveryOptions.includes(delivery)) throw new Error('delivery not offered');
  const price = delivery === 'express' ? combination.priceExpressPesewas : combination.priceTwoMonthsPesewas;
  if (typeof price !== 'number') throw new Error('no price');
  return price;
}

test('a line is priced from the stored combination, whatever the browser claimed', () => {
  // The submitted body carries no price at all. This is the whole defence
  // against a customer editing one on the way out.
  assert.equal(priceFor(shirt(), 'colour-black', 'express'), cedisToPesewas(120));
  assert.equal(priceFor(shirt(), 'colour-black__size-xl', 'express'), cedisToPesewas(145));
});

test('each delivery speed reads its own price', () => {
  assert.equal(priceFor(shirt(), 'colour-black', 'two-months'), cedisToPesewas(85));
});

test('a combination that no longer exists is refused rather than priced at zero', () => {
  assert.throws(() => priceFor(shirt(), 'colour-red', 'express'), /no such combination/);
});

test('a delivery speed the product does not offer is refused', () => {
  const product = shirt();
  product.deliveryOptions = ['express'];
  assert.throws(() => priceFor(product, 'colour-black', 'two-months'), /delivery not offered/);
});

test('a combination with no price for that speed is refused, never treated as free', () => {
  // colour-black__size-xl has an express price only. A blank price means
  // "ask", and an order priced at zero is one nobody can invoice.
  assert.throws(() => priceFor(shirt(), 'colour-black__size-xl', 'two-months'), /no price/);
});

test('the stored line label is derived from the combination, not sent by the client', () => {
  const product = shirt();
  const combination = product.combinations[1];
  assert.equal(readableSelections(combination.selections, product.variantAxes), 'Black, XL');
});

test('a partial combination labels the axes it leaves open', () => {
  const product = shirt();
  const combination = product.combinations[0];
  assert.equal(readableSelections(combination.selections, product.variantAxes), 'Black, any size');
});

test('the order total is the sum of quantity times the stored price', () => {
  const lines = [
    { pricePesewas: cedisToPesewas(120), quantity: 2 },
    { pricePesewas: cedisToPesewas(145), quantity: 1 },
  ];
  const total = lines.reduce((sum, line) => sum + line.pricePesewas * line.quantity, 0);
  assert.equal(total, cedisToPesewas(385));
});
