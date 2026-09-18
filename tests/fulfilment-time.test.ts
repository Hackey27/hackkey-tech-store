import assert from 'node:assert/strict';
import test from 'node:test';
import { fulfilmentTimeState } from '../src/utils/fulfilmentTime';

test('01:00–16:00 is calculated in UTC, not the customer timezone', () => {
  assert.equal(fulfilmentTimeState(new Date('2026-09-18T01:00:00Z'), 'Pacific/Honolulu').insideWindow, true);
  assert.equal(fulfilmentTimeState(new Date('2026-09-18T15:59:00Z'), 'Pacific/Honolulu').insideWindow, true);
  assert.equal(fulfilmentTimeState(new Date('2026-09-18T16:00:00Z'), 'Africa/Accra').insideWindow, false);
  assert.equal(fulfilmentTimeState(new Date('2026-09-18T00:59:00Z'), 'Asia/Tokyo').insideWindow, false);
});

test('customer-local delivery range reports when it crosses midnight', () => {
  const timing = fulfilmentTimeState(new Date('2026-09-18T12:00:00Z'), 'America/New_York');
  assert.equal(timing.localRange, '21:00–12:00');
  assert.equal(timing.crossesMidnight, true);
});

test('outside-hours next start is today before 01:00 UTC and tomorrow after 16:00 UTC', () => {
  assert.equal(fulfilmentTimeState(new Date('2026-09-18T00:30:00Z'), 'Africa/Accra').nextStartLocalTime, '01:00');
  assert.equal(fulfilmentTimeState(new Date('2026-09-18T18:00:00Z'), 'Africa/Accra').nextStartLocalTime, '01:00');
});
