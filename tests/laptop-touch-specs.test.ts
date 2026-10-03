import test from 'node:test';
import assert from 'node:assert/strict';
import type { Laptop } from '../shared/types';
import { hasLaptopTouchscreen, laptopTwoInOneStatus, normalizeLaptopTouchSpecs } from '../shared/laptopTouchSpecs';
import { publicRmbLaptop } from '../shared/rmbPricing';
import { laptopToCatalogueItem } from '../server/catalogue';
import { DEFAULT_PRICING_CONFIG } from '../server/pricingConfig';

const laptop = (touchscreen?: string, twoInOne?: Laptop['twoInOne']): Laptop => ({ laptopId: 'TEST', title: 'Test laptop', categoryId: 'LAPTOP', brand: 'HP', model: 'Test', processor: 'i5', ram: '16GB', storage: '512GB', screen: '14', colour: 'Silver', graphics: 'Integrated', ports: '', operatingSystem: 'Windows', picturesUrl: [], availability: 'Available', active: true, sortOrder: 1, priceGhs: 100, touchscreen, twoInOne });

test('touchscreen notes remain free text while negative and unset statuses hide 2-in-1', () => {
  for (const text of [undefined, '', 'No', ' no touchscreen ', 'Non-touchscreen', 'Not touchscreen', 'Unknown']) {
    assert.equal(hasLaptopTouchscreen(laptop(text)), false, text);
    assert.equal(laptopTwoInOneStatus(laptop(text, 'X360')), undefined);
  }
  for (const text of ['Yes', 'Yes — pen support', '10-point multitouch', 'Touchscreen with a small fault']) assert.equal(hasLaptopTouchscreen(laptop(text)), true);
  for (const status of ['No', 'X360', 'Detachable'] as const) assert.equal(normalizeLaptopTouchSpecs(laptop('Yes', status)).twoInOne, status);
  assert.equal(normalizeLaptopTouchSpecs(laptop(' Yes — pen support ')).touchscreen, 'Yes — pen support');
  assert.equal(normalizeLaptopTouchSpecs(laptop('Yes')).twoInOne, 'No');
  assert.throws(() => normalizeLaptopTouchSpecs(laptop('Yes', 'Invalid' as any)), /2-in-1 must be/);
});

test('saved and public non-touch laptops omit stale 2-in-1 fields, preserving other prices and specs', () => {
  const original = laptop('No', 'Detachable');
  const clean = normalizeLaptopTouchSpecs(original);
  assert.equal('twoInOne' in clean, false);
  assert.equal('twoInOne' in publicRmbLaptop(original), false);
  const catalogue = laptopToCatalogueItem(original, DEFAULT_PRICING_CONFIG);
  assert.equal(catalogue.laptop?.twoInOne, undefined);
  assert.equal(catalogue.pricePesewas, 10000);
  assert.equal(catalogue.laptop?.ram, '16GB');
  assert.equal(original.twoInOne, 'Detachable');
  assert.equal(laptopToCatalogueItem(laptop('Yes', 'X360'), DEFAULT_PRICING_CONFIG).laptop?.twoInOne, 'X360');
});
