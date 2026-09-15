import { PricingConfig } from '../src/types';

/**
 * Pricing rules are neutral by default: no silent adjustment and no promotion,
 * so every variant's payable price equals the price migrated from the sheet.
 *
 * These are settings, not catalogue data, which is why they are not a Firestore
 * collection in Phase 1. The admin portal owns them from Phase 2 — see
 * docs/phase-1-firestore-spec.md §9.
 */
export const PRICING_CONFIG: PricingConfig = {
  silentAdjustment: { active: false, percent: 0, targetIds: [] },
  globalPromotion: { active: false, percent: 0, label: '', targetIds: [] },
  itemSpecificPromotion: { active: false, percent: 0, label: '', targetIds: [] }
};
