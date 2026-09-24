import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOrderId } from '../server/orders';

test('new order references include date, time, product, version and entropy', () => {
  const id = buildOrderId('SPSS', '29', new Date('2026-09-18T18:40:06.000Z'), '9797AA');
  assert.equal(id, 'HKT-20260918-184006-SPS-29-9797AA');
});

test('order reference segments are URL-safe and bounded', () => {
  const id = buildOrderId('Smart PLS / Student', '4.1.1.8 (Mac)', new Date('2026-09-18T18:40:06.000Z'), 'a-b_c!');
  assert.equal(id, 'HKT-20260918-184006-SMA-MAC-ABC000');
  assert.match(id, /^HKT-\d{8}-\d{6}-[A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{6}$/);
});

test('Turnitin references use TUR-AI and TUR-PL for the two options', () => {
  const date = new Date('2026-09-18T18:40:06.000Z');
  assert.equal(buildOrderId('TURNITIN', 'PLAG_AI', date, '9797AA'), 'HKT-20260918-184006-TUR-AI-9797AA');
  assert.equal(buildOrderId('TURNITIN', 'PLAG', date, '9797AA'), 'HKT-20260918-184006-TUR-PL-9797AA');
});
