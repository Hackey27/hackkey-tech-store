/**
 * The formatter, the one price-resolution path, and the bundle allocation.
 *
 * Both defects in docs/pesewas-display-bugs-spec.md were money crossing a
 * boundary without its unit enforced, so these assert the boundary itself.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  allocateProportionally,
  formatPesewas,
  priceServiceLine,
  resolveLinePricePesewas
} from '../src/utils/money';
import { ServiceOption } from '../src/types';
import { TURNITIN_SERVICE } from '../server/seed/turnitin';

// ---------------------------------------------------------------------------
// The formatter — the only thing that turns pesewas into a display string
// ---------------------------------------------------------------------------

test('the formatter renders pesewas as cedis', () => {
  assert.equal(formatPesewas(35000), 'GHS 350.00');
  assert.equal(formatPesewas(4750), 'GHS 47.50');
  assert.equal(formatPesewas(0), 'GHS 0.00');
});

test('the 100x defect: a raw pesewa integer is never the display string', () => {
  // 20000 pesewas is GHS 200.00. The card used to render "₵20,000" by building
  // the string by hand, which is exactly what this asserts against.
  assert.equal(formatPesewas(20000), 'GHS 200.00');
  assert.notEqual(formatPesewas(20000), 'GHS 20,000');
  assert.equal(formatPesewas(39600), 'GHS 396.00');
  assert.equal(formatPesewas(16900), 'GHS 169.00');
  assert.equal(formatPesewas(8000), 'GHS 80.00');
  assert.equal(formatPesewas(6200), 'GHS 62.00');
});

/**
 * Guard against recurrence. Every price on screen must go through
 * formatPesewas; a hand-built currency string is how both defects happened.
 */
test('no source file builds a currency string by hand', () => {
  const roots = ['src', 'server'];
  const offenders: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        // money.ts is the one place allowed to divide by 100 and to compose the
        // currency string.
        if (full.endsWith(path.join('utils', 'money.ts'))) continue;

        const source = fs.readFileSync(full, 'utf8');
        source.split('\n').forEach((line, i) => {
          if (line.trim().startsWith('*') || line.trim().startsWith('//')) return;
          // A cedi sign immediately followed by an interpolation, or an
          // amount divided by 100 for display.
          if (/₵\$\{/.test(line) || /Pesewas\s*\/\s*100/.test(line)) {
            offenders.push(`${full}:${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
  };

  roots.forEach(walk);
  assert.deepEqual(offenders, [], `format prices through formatPesewas:\n${offenders.join('\n')}`);
});

// ---------------------------------------------------------------------------
// One resolution path for every catalogue kind
// ---------------------------------------------------------------------------

const PLAG_AI = TURNITIN_SERVICE.options!.find((o) => o.optionId === 'PLAG_AI')!;
const PLAG = TURNITIN_SERVICE.options!.find((o) => o.optionId === 'PLAG')!;

test('a product line prices from its chosen variant', () => {
  const line = resolveLinePricePesewas({
    item: { kind: 'product', pricePesewas: 16000 },
    variant: { payablePricePesewas: 22000 },
    quantity: 2
  });
  assert.equal(line.unitPesewas, 22000, 'the chosen variant wins over the card "from" price');
  assert.equal(line.totalPesewas, 44000);
});

test('bundles, services and laptops resolve a price without a variant', () => {
  // The ₵0 defect: these kinds have no variant, and the old cart fell through a
  // dead ?? chain to zero.
  for (const kind of ['bundle', 'laptop', 'service']) {
    const line = resolveLinePricePesewas({
      item: { kind, pricePesewas: 48000 },
      quantity: 1
    });
    assert.equal(line.unitPesewas, 48000, `${kind} must not resolve to 0`);
    assert.equal(line.totalPesewas, 48000);
  }
});

test('a quantity multiplies a non-service line', () => {
  const line = resolveLinePricePesewas({
    item: { kind: 'laptop', pricePesewas: 320000 },
    quantity: 3
  });
  assert.equal(line.totalPesewas, 960000);
});

test('a genuinely priceless item resolves to 0, not to a wrong number', () => {
  const line = resolveLinePricePesewas({ item: { kind: 'laptop' }, quantity: 1 });
  assert.equal(line.totalPesewas, 0, 'ask-for-price stays 0 and is rendered as such');
});

// ---------------------------------------------------------------------------
// The Turnitin table, through the shared resolver this time
// ---------------------------------------------------------------------------

test('the Turnitin pricing table holds through the cart resolver', () => {
  const via = (option: ServiceOption, qty: number) =>
    resolveLinePricePesewas({
      item: { kind: 'service', pricePesewas: 1500 },
      serviceOption: option,
      quantity: qty
    }).totalPesewas;

  assert.equal(via(PLAG_AI, 1), 5000, 'PLAG_AI qty 1 -> 5000');
  assert.equal(via(PLAG_AI, 2), 9500, 'PLAG_AI qty 2 -> 9500, NOT 9750');
  assert.equal(via(PLAG_AI, 3), 14250, 'PLAG_AI qty 3 -> 14250');
  assert.equal(via(PLAG, 1), 1500, 'PLAG qty 1 -> 1500');

  // The tiered answer the bulk rule must not produce.
  assert.notEqual(via(PLAG_AI, 2), 9750);
});

test('the service resolver ignores the card price and uses the chosen option', () => {
  // The card shows the cheapest option (1500); the line must cost what was
  // actually chosen.
  const line = resolveLinePricePesewas({
    item: { kind: 'service', pricePesewas: 1500 },
    serviceOption: PLAG_AI,
    quantity: 2
  });
  assert.equal(line.totalPesewas, 9500);
});

// ---------------------------------------------------------------------------
// Bundle allocation — must be exact in integer pesewas
// ---------------------------------------------------------------------------

test('allocation sums exactly to the bundle price', () => {
  const parts = allocateProportionally(48000, [30000, 30000, 22000]);
  assert.equal(
    parts.reduce((a, b) => a + b, 0),
    48000,
    'no pesewa may be lost or invented'
  );
});

test('a price that does not divide evenly still sums exactly', () => {
  // 47501 over three equal parts: 15833.67 each. Floored parts lose 2p, which
  // the last row must absorb.
  const parts = allocateProportionally(47501, [1, 1, 1]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 47501);
  assert.deepEqual(parts, [15833, 15833, 15835]);
  parts.forEach((p) => assert.ok(Number.isInteger(p), 'every part is whole pesewas'));
});

test('allocation is exact across many awkward prices and weightings', () => {
  const prices = [47501, 1, 99999, 12345, 480000, 7, 33333];
  const weightings = [[1], [1, 1], [1, 2], [3, 5, 7], [1, 1, 1, 1, 1], [100, 1], [2, 3, 5, 7, 11]];

  for (const total of prices) {
    for (const weights of weightings) {
      const parts = allocateProportionally(total, weights);
      assert.equal(
        parts.reduce((a, b) => a + b, 0),
        total,
        `total ${total} over weights ${JSON.stringify(weights)}`
      );
      parts.forEach((p) => assert.ok(Number.isInteger(p), 'parts stay integral'));
    }
  }
});

test('allocation is proportional, not merely exact', () => {
  // 3:1 over 40000 is 30000 and 10000.
  assert.deepEqual(allocateProportionally(40000, [3000, 1000]), [30000, 10000]);
});

test('items with no resolvable price split evenly rather than collapsing', () => {
  const parts = allocateProportionally(10000, [0, 0, 0]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 10000);
  assert.deepEqual(parts, [3333, 3333, 3334]);
});

test('a single-item bundle takes the whole price', () => {
  assert.deepEqual(allocateProportionally(48000, [12345]), [48000]);
});

// ---------------------------------------------------------------------------
// The charged amount must not have moved
// ---------------------------------------------------------------------------

test('a product line still charges what it charged before this fix', () => {
  // AMOS01 is GHS 220.00 in the workbook -> 22000 pesewas. Display was wrong;
  // the charge never was, and must not change.
  const line = resolveLinePricePesewas({
    item: { kind: 'product', pricePesewas: 16000 },
    variant: { payablePricePesewas: 22000 },
    quantity: 1
  });
  assert.equal(line.totalPesewas, 22000);
  assert.equal(formatPesewas(line.totalPesewas), 'GHS 220.00');
});

test('priceServiceLine is unchanged by the shared resolver', () => {
  for (const qty of [1, 2, 3, 10, 50]) {
    assert.equal(
      resolveLinePricePesewas({
        item: { kind: 'service' },
        serviceOption: PLAG_AI,
        quantity: qty
      }).totalPesewas,
      priceServiceLine(PLAG_AI, qty).totalPesewas
    );
  }
});
