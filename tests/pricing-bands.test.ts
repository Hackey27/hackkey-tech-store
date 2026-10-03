import test from 'node:test';
import assert from 'node:assert/strict';
import { sequentialPricingBands } from '../shared/pricingBands';
import { defaultRmbTransactionFee, validateRmbPricingSettings } from '../shared/rmbPricing';

test('inclusive pricing minima start at zero and follow each upper bound by exactly one pesewa', () => {
  const bands = [{ minimum: 50, maximum: 99.99, percent: 20 }, { minimum: 900, maximum: 199.99, percent: 15 }, { minimum: 999, maximum: null, percent: 10 }];
  assert.deepEqual(sequentialPricingBands(bands).map(row => row.minimum), [0, 100, 200]);
  const edited = sequentialPricingBands(bands.map((row, index) => index === 0 ? { ...row, maximum: 125.3 } : row));
  assert.deepEqual(edited.map(row => row.minimum), [0, 125.31, 200]);
  assert.deepEqual(edited.map(row => row.percent), [20, 15, 10]);
  assert.equal(bands[0].minimum, 50);
});

test('adding and removing pricing rows derives the next minimum and rebases following rows', () => {
  const original = sequentialPricingBands([{ minimum: 0, maximum: 249.99, charge: 7 }, { minimum: 0, maximum: 499.99, charge: 10 }]);
  const added = sequentialPricingBands([...original, { minimum: 0, maximum: null, charge: 12 }]);
  assert.equal(added[2].minimum, 500);
  assert.deepEqual(sequentialPricingBands(added.filter((_, i) => i !== 1)).map(row => row.minimum), [0, 250]);
  assert.equal(sequentialPricingBands(added.slice(1))[0].minimum, 0);
});

test('unfinished or inverted upper bounds still fail range validation', () => {
  const settings = { exchangeRate: 1, bankCharges: [{ minimum: 0, maximum: null, charge: 0 }], transactionFee: defaultRmbTransactionFee(), profitMargins: [] };
  const profitMargins = sequentialPricingBands([{ minimum: 0, maximum: null, percent: 20 }, { minimum: 100, maximum: 200, percent: 10 }]);
  assert.equal(profitMargins[1].minimum, 100);
  assert.throws(() => validateRmbPricingSettings({ ...settings, profitMargins }), /overlap/);
  assert.throws(() => validateRmbPricingSettings({ ...settings, profitMargins: sequentialPricingBands([{ minimum: 0, maximum: 200, percent: 20 }, { minimum: 0, maximum: 100, percent: 10 }]) }), /maximum cannot be lower/);
});
