import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOrderId } from '../server/orders';

test('new order references include date, time, product, version and entropy', () => {
  const id = buildOrderId('SPSS', '29', new Date('2026-09-18T18:40:06.000Z'), '9797AA');
  assert.equal(id, 'HKT-20260918-184006-SPSS-29-9797AA');
});

test('order reference segments are URL-safe and bounded', () => {
  const id = buildOrderId('Smart PLS / Student', '4.1.1.8 (Mac)', new Date('2026-09-18T18:40:06.000Z'), 'a-b_c!');
  assert.match(id, /^HKT-\d{8}-\d{6}-[A-Z0-9]{1,7}-[A-Z0-9]{1,5}-[A-Z0-9]{6}$/);
});
