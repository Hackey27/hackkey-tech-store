import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBundleItems } from '../server/orders';
import type { BundleItem } from '../src/types';

const rows: BundleItem[] = [
  { itemId: 'fixed', productId: 'PLS', variantId: 'WINPLS01', sortOrder: 1 },
  { itemId: 'amos-new', productId: 'AMOS', variantId: 'AMOS01', altGroup: 'AMOS', altLabel: 'Choose your AMOS version', sortOrder: 2 },
  { itemId: 'amos-old', productId: 'AMOS', variantId: 'AMOS04', altGroup: 'AMOS', altLabel: 'Choose your AMOS version', sortOrder: 3 }
];

test('a bundle includes fixed rows and one default alternative', () => {
  assert.deepEqual(resolveBundleItems(rows).map((row) => row.itemId), ['fixed', 'amos-new']);
});

test('a chosen bundle alternative replaces the default instead of being added to it', () => {
  assert.deepEqual(resolveBundleItems(rows, { AMOS: 'AMOS04' }).map((row) => row.itemId), ['fixed', 'amos-old']);
});

test('an invalid alternative is rejected instead of silently charging another one', () => {
  assert.throws(() => resolveBundleItems(rows, { AMOS: 'NOT-IN-BUNDLE' }), /Invalid selection/);
});
