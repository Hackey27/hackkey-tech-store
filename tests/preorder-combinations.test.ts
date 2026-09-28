import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combinationSlug,
  combinationsForAxes,
  preorderCardPricing,
  lowestPricePesewas,
  previewPricePesewas,
  readableSelections,
  resolvePreorderSelection,
  validatePreorderProduct,
} from '../shared/preorderCombinations';
import { cedisToPesewas } from '../shared/money';
import { PreorderProduct } from '../shared/types';

/**
 * The worked example from the brief, in the brief's own numbers:
 *
 *   {Colour: Black}            120.00 / 85.00
 *   {Colour: Black, Size: XL}  145.00 / 100.00
 *   {Colour: Navy, Size: M}    120.00 / 85.00
 *
 * Prices go through cedisToPesewas so the fixture cannot drift from the one
 * money implementation the rest of the store uses.
 */
function shirt(): PreorderProduct {
  return {
    productId: 'shirt',
    name: 'Field Shirt',
    description: '',
    details: [],
    categoryId: 'apparel',
    galleryImagePaths: [],
    previewImagePath: 'preview.webp',
    variantAxes: [
      { name: 'Colour', options: ['Black', 'Navy', 'Red'] },
      { name: 'Size', options: ['M', 'XL'] },
    ],
    combinations: [
      {
        combinationId: 'colour-black',
        selections: { Colour: 'Black' },
        priceExpressPesewas: cedisToPesewas(120),
        priceTwoMonthsPesewas: cedisToPesewas(85),
      },
      {
        combinationId: 'colour-black__size-xl',
        selections: { Colour: 'Black', Size: 'XL' },
        priceExpressPesewas: cedisToPesewas(145),
        priceTwoMonthsPesewas: cedisToPesewas(100),
      },
      {
        combinationId: 'colour-navy__size-m',
        selections: { Colour: 'Navy', Size: 'M' },
        priceExpressPesewas: cedisToPesewas(120),
        priceTwoMonthsPesewas: cedisToPesewas(85),
      },
    ],
    imageAssignments: [{ selections: { Colour: 'Black' }, imagePath: 'black.webp' }],
    deliveryOptions: ['express', 'two-months'],
    active: true,
  };
}

/** A product with no variants gets one implicit combination. */
function cable(): PreorderProduct {
  return {
    productId: 'cable',
    name: 'Braided Cable',
    description: '',
    details: [],
    categoryId: 'accessories',
    galleryImagePaths: [],
    variantAxes: [],
    combinations: [
      { combinationId: 'default', selections: {}, priceTwoMonthsPesewas: cedisToPesewas(30) },
    ],
    imageAssignments: [],
    deliveryOptions: ['two-months'],
    active: true,
  };
}

test('partial match: Black alone resolves the Colour-only combination', () => {
  const resolved = resolvePreorderSelection(shirt(), { Colour: 'Black' });
  assert.equal(resolved.combination?.combinationId, 'colour-black');
  assert.equal(resolved.priceExpressPesewas, cedisToPesewas(120));
  assert.ok(resolved.sellable);
});

test('precedence: Black + XL beats the Colour-only combination', () => {
  const resolved = resolvePreorderSelection(shirt(), { Colour: 'Black', Size: 'XL' });
  assert.equal(resolved.combination?.combinationId, 'colour-black__size-xl');
  assert.equal(resolved.priceExpressPesewas, cedisToPesewas(145));
  assert.equal(resolved.priceTwoMonthsPesewas, cedisToPesewas(100));
});

test('exact match: Navy + M resolves its own combination', () => {
  const resolved = resolvePreorderSelection(shirt(), { Colour: 'Navy', Size: 'M' });
  assert.equal(resolved.combination?.combinationId, 'colour-navy__size-m');
  assert.equal(resolved.priceExpressPesewas, cedisToPesewas(120));
});

test('no match: Navy alone has no price and cannot be added yet', () => {
  const resolved = resolvePreorderSelection(shirt(), { Colour: 'Navy' });
  assert.equal(resolved.combination, null);
  assert.equal(resolved.priceExpressPesewas, null);
  assert.equal(resolved.sellable, false);
  assert.deepEqual(resolved.missingAxes, ['Size']);
});

test('empty selection: nothing is resolved until the customer picks', () => {
  const resolved = resolvePreorderSelection(shirt(), {});
  assert.equal(resolved.combination, null);
  assert.equal(resolved.sellable, false);
});

test('a product with no axes is sellable immediately, through the same path', () => {
  const resolved = resolvePreorderSelection(cable(), {});
  assert.equal(resolved.combination?.combinationId, 'default');
  assert.equal(resolved.sellable, true);
  assert.deepEqual(resolved.axes, []);
  assert.deepEqual(resolved.missingAxes, []);
  // Express is not offered, so it reads as null rather than as free.
  assert.equal(resolved.priceExpressPesewas, null);
  assert.equal(resolved.priceTwoMonthsPesewas, cedisToPesewas(30));
});

test('axis visibility: Size hides when no reachable combination distinguishes it', () => {
  // Only {Colour: Black} is Black, so Black is simply what they are buying.
  const product = shirt();
  product.combinations = product.combinations.filter(
    (c) => c.combinationId !== 'colour-black__size-xl'
  );
  const size = resolvePreorderSelection(product, { Colour: 'Black' }).axes
    .find((axis) => axis.name === 'Size');
  assert.equal(size?.visible, false);
});

test('axis visibility: Size shows once a Black combination distinguishes it', () => {
  const size = resolvePreorderSelection(shirt(), { Colour: 'Black' }).axes
    .find((axis) => axis.name === 'Size');
  assert.equal(size?.visible, true);
});

test('option availability: Navy leaves only M selectable, and M is not hidden', () => {
  const size = resolvePreorderSelection(shirt(), { Colour: 'Navy' }).axes
    .find((axis) => axis.name === 'Size');
  assert.equal(size?.visible, true);
  assert.equal(size?.options.find((option) => option.value === 'M')?.enabled, true);
  assert.equal(size?.options.find((option) => option.value === 'XL')?.enabled, false);
});

test('option availability: Red is visible but unselectable, never hidden', () => {
  const colour = resolvePreorderSelection(shirt(), {}).axes
    .find((axis) => axis.name === 'Colour');
  const red = colour?.options.find((option) => option.value === 'Red');
  assert.ok(red, 'Red should still be listed');
  assert.equal(red.enabled, false);
});

test('a Colour-only combination keeps every size buyable at its price', () => {
  // {Colour: Black} means Black in any size, so M resolves to it rather than
  // falling through to no price.
  const resolved = resolvePreorderSelection(shirt(), { Colour: 'Black', Size: 'M' });
  assert.equal(resolved.combination?.combinationId, 'colour-black');
  assert.equal(resolved.priceExpressPesewas, cedisToPesewas(120));
});

test('image resolution follows the same most-specific rule, then falls back', () => {
  assert.equal(resolvePreorderSelection(shirt(), { Colour: 'Black' }).imagePath, 'black.webp');
  assert.equal(resolvePreorderSelection(shirt(), { Colour: 'Navy' }).imagePath, 'preview.webp');
  assert.equal(resolvePreorderSelection(cable(), {}).imagePath, null);
});

test('the listing card shows the lowest price, and Two months when that is all there is', () => {
  assert.equal(lowestPricePesewas(shirt(), 'express'), cedisToPesewas(120));
  assert.equal(lowestPricePesewas(cable(), 'express'), null);
  assert.deepEqual(previewPricePesewas(shirt()), {
    pricePesewas: cedisToPesewas(120),
    delivery: 'express',
  });
  assert.deepEqual(previewPricePesewas(cable()), {
    pricePesewas: cedisToPesewas(30),
    delivery: 'two-months',
  });
});

test('slugs are readable, ordered by the product axes, and stable', () => {
  const axes = shirt().variantAxes;
  assert.equal(combinationSlug({ Colour: 'Black', Size: 'XL' }, axes), 'colour-black__size-xl');
  // Axis order comes from the product, not from the object's key order.
  assert.equal(combinationSlug({ Size: 'XL', Colour: 'Black' }, axes), 'colour-black__size-xl');
  assert.equal(combinationSlug({ Colour: 'Black' }, axes), 'colour-black');
  assert.equal(combinationSlug({}, axes), 'default');
});

test('duplicate selections are rejected, because the price would be ambiguous', () => {
  const product = shirt();
  product.combinations.push({
    combinationId: 'duplicate',
    selections: { Colour: 'Black' },
    priceExpressPesewas: cedisToPesewas(99),
  });
  const { errors } = validatePreorderProduct(product);
  assert.ok(errors.some((error) => error.includes('same thing')), errors.join(' | '));
});

test('a product with no combinations is rejected', () => {
  const product = shirt();
  product.combinations = [];
  const { errors } = validatePreorderProduct(product);
  assert.ok(errors.some((error) => error.includes('at least one combination')), errors.join(' | '));
});

test('an unreachable selection warns rather than blocking', () => {
  const { errors, warnings } = validatePreorderProduct(shirt());
  // Navy + XL and every Red combination match nothing.
  assert.equal(errors.length, 0, errors.join(' | '));
  assert.ok(warnings.some((warning) => warning.includes('Navy, XL')), warnings.join(' | '));
  assert.ok(warnings.some((warning) => warning.includes('Red')), warnings.join(' | '));
});

test('a combination naming an unknown axis or option is rejected', () => {
  const product = shirt();
  product.combinations.push({
    combinationId: 'bad-axis',
    selections: { Finish: 'Matte' },
    priceExpressPesewas: 1,
  });
  product.combinations.push({
    combinationId: 'bad-option',
    selections: { Colour: 'Chartreuse' },
    priceExpressPesewas: 1,
  });
  const { errors } = validatePreorderProduct(product);
  assert.ok(errors.some((error) => error.includes('Finish')), errors.join(' | '));
  assert.ok(errors.some((error) => error.includes('Chartreuse')), errors.join(' | '));
});

test('a combination with no price for any offered delivery is rejected', () => {
  const product = cable();
  product.combinations = [{ combinationId: 'default', selections: {} }];
  const { errors } = validatePreorderProduct(product);
  assert.ok(errors.some((error) => error.includes('no price')), errors.join(' | '));
});

test('readable selections name the open axes rather than omitting them', () => {
  const axes = shirt().variantAxes;
  assert.equal(readableSelections({ Colour: 'Black', Size: 'XL' }, axes), 'Black, XL');
  assert.equal(readableSelections({ Colour: 'Black' }, axes), 'Black, any size');
});

/* -- the listing card's pricing ------------------------------------------- */

test('the card prices every delivery option the product offers', () => {
  const pricing = preorderCardPricing(shirt());
  assert.deepEqual(pricing.map((entry) => entry.delivery), ['express', 'two-months']);
  assert.equal(pricing[0].pricePesewas, cedisToPesewas(120));
  assert.equal(pricing[1].pricePesewas, cedisToPesewas(85));
});

test('a product whose combinations differ is priced "from", not flatly', () => {
  // Black is 120 and Black+XL is 145, so 120 is not the whole story.
  const pricing = preorderCardPricing(shirt());
  assert.equal(pricing.every((entry) => entry.uniform), false);
});

test('a product where every combination agrees is uniform, so the card can drop "from"', () => {
  const product = shirt();
  product.combinations = product.combinations.map((combination) => ({
    ...combination,
    priceExpressPesewas: cedisToPesewas(120),
    priceTwoMonthsPesewas: cedisToPesewas(85),
  }));
  const pricing = preorderCardPricing(product);
  assert.equal(pricing.length, 2);
  assert.ok(pricing.every((entry) => entry.uniform), 'every delivery should read as uniform');
  assert.equal(pricing[0].pricePesewas, cedisToPesewas(120));
});

test('one unpriced combination is a gap, not agreement, so it is not uniform', () => {
  // Every Express price agrees except one combination that has none. Saying
  // "GHS 120" flatly would promise a price the product page cannot honour.
  const product = shirt();
  product.combinations = product.combinations.map((combination) => ({
    ...combination,
    priceExpressPesewas: cedisToPesewas(120),
  }));
  delete product.combinations[1].priceExpressPesewas;
  const express = preorderCardPricing(product).find((entry) => entry.delivery === 'express');
  assert.equal(express?.pricePesewas, cedisToPesewas(120));
  assert.equal(express?.uniform, false);
});

test('a delivery option with no priced combination is left off the card entirely', () => {
  const product = shirt();
  product.combinations = product.combinations.map((combination) => {
    const next = { ...combination };
    delete next.priceTwoMonthsPesewas;
    return next;
  });
  assert.deepEqual(
    preorderCardPricing(product).map((entry) => entry.delivery),
    ['express']
  );
});

test('a delivery the product does not offer is never priced, even if a combination carries one', () => {
  const product = shirt();
  product.deliveryOptions = ['express'];
  assert.deepEqual(preorderCardPricing(product).map((entry) => entry.delivery), ['express']);
});

/* -- filling combinations from the variants -------------------------------- */

test('filling from one axis yields a row per option, in the order they were entered', () => {
  const rows = combinationsForAxes([{ name: 'Colour', options: ['Black', 'Navy', 'Red'] }]);
  assert.deepEqual(rows.map((row) => row.selections.Colour), ['Black', 'Navy', 'Red']);
  assert.deepEqual(rows.map((row) => row.combinationId), [
    'colour-black',
    'colour-navy',
    'colour-red',
  ]);
});

test('filling from two axes varies the first axis slowest, matching the selector order', () => {
  const rows = combinationsForAxes(shirt().variantAxes);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.slice(0, 2).map((row) => `${row.selections.Colour}/${row.selections.Size}`), [
    'Black/M',
    'Black/XL',
  ]);
});

test('filling carries the shared price onto every row', () => {
  const rows = combinationsForAxes([{ name: 'Colour', options: ['Black', 'Navy'] }], {
    priceExpressPesewas: cedisToPesewas(120),
    priceTwoMonthsPesewas: cedisToPesewas(85),
  });
  assert.ok(rows.every((row) => row.priceExpressPesewas === cedisToPesewas(120)));
  assert.ok(rows.every((row) => row.priceTwoMonthsPesewas === cedisToPesewas(85)));
});

test('filling with no price leaves the fields absent rather than zero', () => {
  // A blank price means "ask", never free — a zero here would put a free
  // product on the shelf.
  const [row] = combinationsForAxes([{ name: 'Colour', options: ['Black'] }]);
  assert.equal('priceExpressPesewas' in row, false);
  assert.equal('priceTwoMonthsPesewas' in row, false);
});

test('a product with no variants fills to the single implicit combination', () => {
  const rows = combinationsForAxes([], { priceExpressPesewas: cedisToPesewas(30) });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].selections, {});
  assert.equal(rows[0].combinationId, 'default');
});

test('filled rows satisfy the validator, so the button cannot produce an unsaveable product', () => {
  const product = shirt();
  product.combinations = combinationsForAxes(product.variantAxes, {
    priceExpressPesewas: cedisToPesewas(120),
    priceTwoMonthsPesewas: cedisToPesewas(85),
  });
  const { errors, warnings } = validatePreorderProduct(product);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});
