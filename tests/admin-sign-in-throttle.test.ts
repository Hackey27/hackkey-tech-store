import assert from 'node:assert/strict';
import test from 'node:test';
import { adminSignInWaitSeconds, afterFailedAdminSignIn, EMPTY_ADMIN_SIGN_IN_THROTTLE } from '../src/utils/adminSignInThrottle';

test('admin sign-in starts an escalating cooldown after five failures', () => {
  const now = 1_000_000;
  let state = EMPTY_ADMIN_SIGN_IN_THROTTLE;
  for (let index = 0; index < 4; index += 1) state = afterFailedAdminSignIn(state, now);
  assert.equal(adminSignInWaitSeconds(state, now), 0);
  state = afterFailedAdminSignIn(state, now);
  assert.equal(adminSignInWaitSeconds(state, now), 60);
  state = afterFailedAdminSignIn(state, now);
  assert.equal(adminSignInWaitSeconds(state, now), 120);
});

test('admin sign-in cooldown is capped at fifteen minutes', () => {
  const now = 1_000_000;
  let state = { failures: 20, lockedUntil: 0 };
  state = afterFailedAdminSignIn(state, now);
  assert.equal(adminSignInWaitSeconds(state, now), 900);
});
