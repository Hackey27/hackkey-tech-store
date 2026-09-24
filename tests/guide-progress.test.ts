import assert from 'node:assert/strict';
import test from 'node:test';
import { guideProgressKey, initialGuidePosition, shouldClearGuideProgress } from '../src/utils/guideProgress';

test('unfinished guides resume at their saved step and invalid values reset safely', () => {
  assert.equal(initialGuidePosition('3', 7), 3);
  assert.equal(initialGuidePosition('0', 7), 0);
  assert.equal(initialGuidePosition('7', 7), 0);
  assert.equal(initialGuidePosition('NaN', 7), 0);
  assert.equal(initialGuidePosition('-1', 7), 0);
});

test('only the completion view clears saved progress when closed', () => {
  assert.equal(shouldClearGuideProgress(3, 7), false);
  assert.equal(shouldClearGuideProgress(7, 7), true);
});

test('different orders and OS-specific guides never share a progress key', () => {
  assert.notEqual(guideProgressKey('ORDER-1', 'spss-windows'), guideProgressKey('ORDER-1', 'spss-macos'));
  assert.notEqual(guideProgressKey('ORDER-1', 'spss-windows'), guideProgressKey('ORDER-2', 'spss-windows'));
});
