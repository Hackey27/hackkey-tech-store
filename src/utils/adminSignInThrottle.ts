export interface AdminSignInThrottleState {
  failures: number;
  lockedUntil: number;
}

export const EMPTY_ADMIN_SIGN_IN_THROTTLE: AdminSignInThrottleState = { failures: 0, lockedUntil: 0 };

/** Browser-side defence in depth. Firebase Authentication remains the actual
 * credential verifier and applies its own project/IP abuse controls. */
export function afterFailedAdminSignIn(state: AdminSignInThrottleState, now = Date.now()): AdminSignInThrottleState {
  const failures = Math.max(0, state.failures) + 1;
  if (failures < 5) return { failures, lockedUntil: 0 };
  const delayMs = Math.min(15 * 60_000, 60_000 * 2 ** (failures - 5));
  return { failures, lockedUntil: now + delayMs };
}

export function adminSignInWaitSeconds(state: AdminSignInThrottleState, now = Date.now()): number {
  return Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
}
