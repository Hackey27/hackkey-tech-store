import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartLineDetail } from '../src/utils/cartLineDetail';

const variant = (versionOrPlan: string, os: string) => ({ versionOrPlan, os }) as never;

test('a software line shows its version and its operating system together', () => {
  assert.equal(
    cartLineDetail({ variant: variant('2024', 'Windows'), selectedOs: 'Windows' }),
    '2024 · Windows'
  );
});

test('the chosen operating system wins over the variant default', () => {
  assert.equal(
    cartLineDetail({ variant: variant('2024', 'Windows'), selectedOs: 'Mac (via Parallels)' }),
    '2024 · Mac (via Parallels)'
  );
});

test('two lines of one version differ by operating system', () => {
  const windows = cartLineDetail({ variant: variant('2024', 'Windows'), selectedOs: 'Windows' });
  const mac = cartLineDetail({ variant: variant('2024', 'Windows'), selectedOs: 'macOS' });
  assert.notEqual(windows, mac);
});

test('a missing operating system leaves the version alone, with no stray separator', () => {
  assert.equal(cartLineDetail({ variant: variant('31', '') }), '31');
});

test('an operating system with no version stands on its own', () => {
  assert.equal(cartLineDetail({ selectedOs: 'Windows' }), 'Windows');
});

test('a service is described by its option, never an operating system', () => {
  assert.equal(
    cartLineDetail({ serviceOption: { name: 'AI check' } as never, selectedOs: 'Windows' }),
    'AI check'
  );
});
