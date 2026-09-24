import assert from 'node:assert/strict';
import test from 'node:test';
import type { CatalogueItem, Variant } from '../src/types';
import { bundleOperatingSystems, bundleVariantsForOs, resolveCustomBundleChoices } from '../src/utils/customBundle';

const variant = (id: string, version: string, os: string, available = true): Variant => ({
  variantId: id, versionOrPlan: version, os, available, priceGhs: 100, latest: false,
  licenceTerm: '', macViaParallels: false, fulfilmentType: '', deliverableType: '', activationMode: '',
  autoFulfil: false, manualDelivery: false, licenceRequiredForSelfActivation: false, activationLinkLive: false
});
const product = (id: string, variants: Variant[]): CatalogueItem => ({
  kind: 'product', itemId: id, name: id, categoryId: 'DATA', sortOrder: 0, variants
});
const catalogue = [
  product('PLS', [variant('PLS-WIN-4', '4.1.1.8', 'Windows'), variant('PLS-MAC-4', '4.1.1.8', 'macOS')]),
  product('SPSS', [variant('SPSS-WIN-32', '32', 'Windows'), variant('SPSS-MAC-32', '32', 'macOS'), variant('SPSS-OLD', '28', 'Windows', false)])
];

test('custom bundle choices list only sellable versions for the selected OS', () => {
  assert.deepEqual(bundleOperatingSystems(catalogue[0]), ['Windows', 'macOS']);
  assert.deepEqual(bundleVariantsForOs(catalogue[1], 'macOS').map((value) => value.variantId), ['SPSS-MAC-32']);
});

test('custom bundle request stores the exact variant, OS and canonical catalogue name', () => {
  assert.deepEqual(resolveCustomBundleChoices(catalogue, [
    { itemId: 'PLS', name: 'forged', variantId: 'PLS-MAC-4', os: 'macOS' },
    { itemId: 'SPSS', variantId: 'SPSS-WIN-32', os: 'Windows' }
  ]), { choices: [
    { itemId: 'PLS', name: 'PLS', variantId: 'PLS-MAC-4', versionOrPlan: '4.1.1.8', os: 'macOS' },
    { itemId: 'SPSS', name: 'SPSS', variantId: 'SPSS-WIN-32', versionOrPlan: '32', os: 'Windows' }
  ] });
});

test('custom bundle request rejects unavailable OS, hidden version, duplicates and incomplete rows', () => {
  const valid = { itemId: 'PLS', variantId: 'PLS-MAC-4', os: 'macOS' };
  assert.match(resolveCustomBundleChoices(catalogue, [valid, { itemId: 'SPSS', variantId: 'SPSS-WIN-32', os: 'macOS' }]).error || '', /unavailable/);
  assert.match(resolveCustomBundleChoices(catalogue, [valid, { itemId: 'SPSS', variantId: 'SPSS-OLD', os: 'Windows' }]).error || '', /unavailable/);
  assert.match(resolveCustomBundleChoices(catalogue, [valid, valid]).error || '', /selected twice/);
  assert.match(resolveCustomBundleChoices(catalogue, [valid, { itemId: 'SPSS' }]).error || '', /version and operating system/);
});
