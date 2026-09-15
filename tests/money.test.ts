/**
 * The two things in §3 that fail silently if they are wrong.
 *
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPricingRules,
  cedisToPesewas,
  cheapestOptionPesewas,
  formatPesewas,
  pesewasToCedis,
  priceServiceLine,
  serviceTargetIds
} from '../src/utils/money';
import { PricingConfig, ServiceOption } from '../src/types';
import { TURNITIN_SERVICE } from '../server/seed/turnitin';

const PLAG_AI: ServiceOption = {
  optionId: 'PLAG_AI',
  name: 'Plagiarism + AI Check',
  unitPriceGhs: 50.0,
  bulkPriceGhs: 47.5,
  bulkFromQty: 2
};

const PLAG: ServiceOption = {
  optionId: 'PLAG',
  name: 'Plagiarism Only',
  unitPriceGhs: 15.0
};

// ---------------------------------------------------------------------------
// 1. The bulk price replaces the unit price for EVERY unit
// ---------------------------------------------------------------------------

test('bulk price replaces the unit price for every unit, not just those above the threshold', () => {
  // The exact figures the spec names.
  assert.equal(priceServiceLine(PLAG_AI, 1).totalPesewas, 5000, 'qty 1 -> GHS 50.00');
  assert.equal(priceServiceLine(PLAG_AI, 2).totalPesewas, 9500, 'qty 2 -> GHS 95.00');
  assert.equal(priceServiceLine(PLAG_AI, 3).totalPesewas, 14250, 'qty 3 -> GHS 142.50');

  assert.equal(formatPesewas(priceServiceLine(PLAG_AI, 1).totalPesewas), 'GHS 50.00');
  assert.equal(formatPesewas(priceServiceLine(PLAG_AI, 2).totalPesewas), 'GHS 95.00');
  assert.equal(formatPesewas(priceServiceLine(PLAG_AI, 3).totalPesewas), 'GHS 142.50');
});

test('a tiered calculation would overcharge, and is not what this does', () => {
  // What a tiered implementation produces for qty 2: one unit at 50.00 plus one
  // at the bulk rate of 47.50 = 97.50. That is the bug this test exists to
  // catch; it must not equal our result.
  const tiered = cedisToPesewas(50.0) + cedisToPesewas(47.5);
  assert.equal(tiered, 9750);
  assert.notEqual(priceServiceLine(PLAG_AI, 2).totalPesewas, tiered);
  assert.equal(priceServiceLine(PLAG_AI, 2).totalPesewas, 9500);

  // And for qty 3 the tiered answer would be 50.00 + 47.50 + 47.50 = 145.00.
  assert.notEqual(priceServiceLine(PLAG_AI, 3).totalPesewas, 14500);
});

test('the bulk price applies exactly at the threshold quantity, not one above it', () => {
  assert.equal(priceServiceLine(PLAG_AI, 1).bulkApplied, false);
  assert.equal(priceServiceLine(PLAG_AI, 2).bulkApplied, true, 'bulkFromQty is inclusive');
  assert.equal(priceServiceLine(PLAG_AI, 1).unitPricePesewas, 5000);
  assert.equal(priceServiceLine(PLAG_AI, 2).unitPricePesewas, 4750);
});

test('an option with no bulk price charges the unit price at every quantity', () => {
  assert.equal(priceServiceLine(PLAG, 1).totalPesewas, 1500);
  assert.equal(priceServiceLine(PLAG, 4).totalPesewas, 6000);
  assert.equal(priceServiceLine(PLAG, 4).bulkApplied, false);
});

test('a bulk price without a threshold (or vice versa) never applies', () => {
  const noThreshold: ServiceOption = { optionId: 'X', name: 'X', unitPriceGhs: 10, bulkPriceGhs: 8 };
  const noPrice: ServiceOption = { optionId: 'Y', name: 'Y', unitPriceGhs: 10, bulkFromQty: 2 };
  assert.equal(priceServiceLine(noThreshold, 5).totalPesewas, 5000);
  assert.equal(priceServiceLine(noPrice, 5).totalPesewas, 5000);
});

test('quantity is coerced to at least one whole unit', () => {
  assert.equal(priceServiceLine(PLAG, 0).totalPesewas, 1500);
  assert.equal(priceServiceLine(PLAG, -3).totalPesewas, 1500);
  assert.equal(priceServiceLine(PLAG, 2.7).totalPesewas, 3000, 'fractional quantity floors to 2');
});

// ---------------------------------------------------------------------------
// 2. Money is computed in integer pesewas, not floating-point cedis
// ---------------------------------------------------------------------------

test('float multiplication of cedis is lossy for ordinary prices', () => {
  // Turnitin's own 47.5 is exact in binary floating point (95/2), so it is a
  // poor example and would make this test pass for the wrong reason. Plenty of
  // ordinary prices are not exact: 8.1 x 7 and 2.3 x 3 both drift.
  assert.notEqual(8.1 * 7, 56.7, 'float cedis drift on a seven-unit line');
  assert.notEqual(2.3 * 3, 6.9);
  assert.notEqual(0.1 + 0.2, 0.3);

  // The same lines in pesewas are exact.
  const eightTen: ServiceOption = { optionId: 'Z', name: 'Z', unitPriceGhs: 8.1 };
  assert.equal(priceServiceLine(eightTen, 7).totalPesewas, 5670);
  assert.equal(pesewasToCedis(priceServiceLine(eightTen, 7).totalPesewas), 56.7);

  const twoThirty: ServiceOption = { optionId: 'Y', name: 'Y', unitPriceGhs: 2.3 };
  assert.equal(priceServiceLine(twoThirty, 3).totalPesewas, 690);
  assert.equal(pesewasToCedis(priceServiceLine(twoThirty, 3).totalPesewas), 6.9);

  // And Turnitin's figures stay exact at every quantity.
  assert.equal(priceServiceLine(PLAG_AI, 3).totalPesewas, 14250);
  assert.equal(pesewasToCedis(priceServiceLine(PLAG_AI, 3).totalPesewas), 142.5);
});

test('every line total is a whole number of pesewas', () => {
  for (let qty = 1; qty <= 50; qty += 1) {
    const { totalPesewas, unitPricePesewas } = priceServiceLine(PLAG_AI, qty);
    assert.ok(Number.isInteger(totalPesewas), `qty ${qty}: total ${totalPesewas} must be integral`);
    assert.ok(Number.isInteger(unitPricePesewas), `qty ${qty}: unit must be integral`);
  }
});

test('repeated accumulation does not drift, which is what float cedis would do', () => {
  // Fifty separate ₵47.50 lines.
  let pesewas = 0;
  let cedisFloat = 0;
  for (let i = 0; i < 50; i += 1) {
    pesewas += cedisToPesewas(47.5);
    cedisFloat += 47.5;
  }
  assert.equal(pesewas, 237500, 'integer accumulation is exact');
  assert.equal(pesewasToCedis(pesewas), 2375);

  // A price that is not exactly representable in binary floating point.
  let driftingCedis = 0;
  let exactPesewas = 0;
  for (let i = 0; i < 100; i += 1) {
    driftingCedis += 0.07;
    exactPesewas += cedisToPesewas(0.07);
  }
  assert.equal(exactPesewas, 700, 'pesewas stay exact');
  assert.notEqual(driftingCedis, 7, 'the float sum has drifted off the true value');
  assert.equal(pesewasToCedis(exactPesewas), 7);
  void cedisFloat;
});

test('cedis and pesewas round-trip losslessly across the storefront price range', () => {
  for (let pesewas = 0; pesewas <= 200000; pesewas += 1) {
    const cedis = pesewasToCedis(pesewas);
    assert.equal(cedisToPesewas(cedis), pesewas, `round trip failed at ${pesewas}p`);
  }
});

test('cedisToPesewas absorbs float imprecision already present in stored data', () => {
  assert.equal(cedisToPesewas(47.5), 4750);
  assert.equal(cedisToPesewas(0.1 + 0.2), 30, '0.30000000000000004 must become 30p');
  assert.equal(cedisToPesewas(142.50000000000003), 14250);
});

test('formatting always shows two decimals', () => {
  assert.equal(formatPesewas(5000), 'GHS 50.00');
  assert.equal(formatPesewas(4750), 'GHS 47.50');
  assert.equal(formatPesewas(14250), 'GHS 142.50');
  assert.equal(formatPesewas(123456789), 'GHS 1,234,567.89');
  assert.equal(formatPesewas(0), 'GHS 0.00');
});

// ---------------------------------------------------------------------------
// Pricing rules apply on top of the resolved total
// ---------------------------------------------------------------------------

const neutral: PricingConfig = {
  silentAdjustment: { active: false, percent: 0, targetIds: [] },
  globalPromotion: { active: false, percent: 0, label: '', targetIds: [] },
  itemSpecificPromotion: { active: false, percent: 0, label: '', targetIds: [] }
};

test('neutral pricing rules leave the resolved total untouched', () => {
  const { totalPesewas } = priceServiceLine(PLAG_AI, 2);
  const applied = applyPricingRules(totalPesewas, serviceTargetIds('TURNITIN', 'PLAG_AI'), neutral);
  assert.equal(applied.payablePesewas, 9500);
  assert.equal(applied.listPesewas, 9500);
});

test('an item-specific promotion targets the service by SERVICE:<id>', () => {
  const config: PricingConfig = {
    ...neutral,
    itemSpecificPromotion: {
      active: true, percent: 10, label: 'Launch offer', targetIds: ['SERVICE:TURNITIN']
    }
  };
  const { totalPesewas } = priceServiceLine(PLAG_AI, 2);
  const applied = applyPricingRules(totalPesewas, serviceTargetIds('TURNITIN', 'PLAG_AI'), config);
  assert.equal(applied.payablePesewas, 8550, '10% off GHS 95.00 is GHS 85.50');
  assert.equal(applied.promoLabel, 'Launch offer');
  // Still whole pesewas, and the half-cedi survives rather than being rounded
  // away to a whole cedi.
  assert.ok(Number.isInteger(applied.payablePesewas));
});

test('a promotion aimed at another service does not apply', () => {
  const config: PricingConfig = {
    ...neutral,
    itemSpecificPromotion: {
      active: true, percent: 50, label: 'Other', targetIds: ['SERVICE:SOMETHING_ELSE']
    }
  };
  const { totalPesewas } = priceServiceLine(PLAG_AI, 2);
  assert.equal(
    applyPricingRules(totalPesewas, serviceTargetIds('TURNITIN', 'PLAG_AI'), config).payablePesewas,
    9500
  );
});

// ---------------------------------------------------------------------------
// The seeded Turnitin data is what the spec specifies
// ---------------------------------------------------------------------------

test('the seeded Turnitin service matches the spec', () => {
  assert.equal(TURNITIN_SERVICE.serviceId, 'TURNITIN');
  assert.equal(TURNITIN_SERVICE.categoryId, 'SERVICE');
  assert.equal(TURNITIN_SERVICE.active, true);
  assert.equal(TURNITIN_SERVICE.minQty, 1);
  assert.equal(TURNITIN_SERVICE.maxQty, 50);

  const plag = TURNITIN_SERVICE.options?.find((o) => o.optionId === 'PLAG');
  const plagAi = TURNITIN_SERVICE.options?.find((o) => o.optionId === 'PLAG_AI');

  assert.equal(plag?.unitPriceGhs, 15.0);
  assert.equal(plag?.bulkPriceGhs, undefined);
  assert.equal(plagAi?.unitPriceGhs, 50.0);
  assert.equal(plagAi?.bulkPriceGhs, 47.5);
  assert.equal(plagAi?.bulkFromQty, 2);

  // PLAG_AI is the option customers actually bought, so it is presented first.
  assert.equal(TURNITIN_SERVICE.options?.[0].optionId, 'PLAG_AI');
});

test('the seeded options price to the figures in the definition of done', () => {
  const plagAi = TURNITIN_SERVICE.options!.find((o) => o.optionId === 'PLAG_AI')!;
  assert.equal(formatPesewas(priceServiceLine(plagAi, 1).totalPesewas), 'GHS 50.00');
  assert.equal(formatPesewas(priceServiceLine(plagAi, 2).totalPesewas), 'GHS 95.00');
  assert.equal(formatPesewas(priceServiceLine(plagAi, 3).totalPesewas), 'GHS 142.50');
});

test('the disclaimer is stored verbatim', () => {
  const expected =
    'Important: The AI score you receive from us will be the same as the score you ' +
    'would receive through your institution. However, the Similarity Index may be ' +
    'slightly higher, lower, or the same as your institution\'s result. This is ' +
    'because institutions may include private or local repositories in their ' +
    'Turnitin configuration that we do not have access to.';
  assert.equal(TURNITIN_SERVICE.disclaimer, expected);
});

test('the catalogue card shows the cheapest option', () => {
  assert.equal(cheapestOptionPesewas(TURNITIN_SERVICE.options!), 1500, 'PLAG at GHS 15.00');
});
