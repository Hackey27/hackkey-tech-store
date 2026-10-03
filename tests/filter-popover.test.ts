import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDismissFilterPopover } from '../src/utils/useFilterPopover';
import { isDownwardScrollKey } from '../src/utils/useResumeNavAfterBack';

test('focused price editing survives keyboard resizing and layout or focus scrolling', () => {
  assert.equal(shouldDismissFilterPopover('scroll', false, false, true), false);
  assert.equal(shouldDismissFilterPopover('resize', false, false, true), false);
  assert.equal(shouldDismissFilterPopover('resize', false, false, false), false);
});
test('scrolling within a dropdown and moving between its minimum and maximum keep it open', () => {
  assert.equal(shouldDismissFilterPopover('scroll', true, false, true), false);
  assert.equal(shouldDismissFilterPopover('pointerdown', true, false, true), false);
  assert.equal(shouldDismissFilterPopover('pointerdown', false, true, true), false);
});
test('outside taps still dismiss even during editing; page scrolling dismisses an unfocused dropdown', () => {
  assert.equal(shouldDismissFilterPopover('pointerdown', false, false, true), true);
  assert.equal(shouldDismissFilterPopover('scroll', false, false, false), true);
});
test('navigation resumes only for downward scroll keys, not text entry or upward navigation', () => {
  for (const key of ['ArrowDown', 'PageDown', ' ', 'End']) assert.equal(isDownwardScrollKey(key), true);
  for (const key of ['ArrowUp', 'PageUp', 'Home', 'Tab', '1', 'Backspace']) assert.equal(isDownwardScrollKey(key), false);
});
