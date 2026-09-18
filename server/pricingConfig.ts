import { PricingConfig, PromotionRule } from '../src/types';
import { COLLECTIONS, getFirestore } from './firestore';

/**
 * Pricing rules are neutral by default: no silent adjustment and no promotion,
 * so every variant's payable price equals the price migrated from the sheet.
 *
 * These are store settings rather than catalogue rows. The admin portal writes
 * the single `storeSettings/pricing` document and both catalogue reads and
 * checkout validation use this module, so displayed and charged prices agree.
 */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  silentAdjustment: { active: false, percent: 0, targetIds: [], fixedAdjustmentsGhs: {} },
  globalPromotion: { active: false, percent: 0, label: '', targetIds: [] },
  itemSpecificPromotion: { active: false, percent: 0, label: '', targetIds: [] },
  itemSpecificPromotions: []
};

let cached: { value: PricingConfig; expiresAt: number } | null = null;

const finite = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function cleanPromotion(input: Partial<PromotionRule> | undefined): PromotionRule {
  return {
    active: input?.active === true,
    percent: Math.min(100, Math.max(0, finite(input?.percent))),
    label: String(input?.label || '').trim().slice(0, 120),
    targetIds: Array.isArray(input?.targetIds) ? [...new Set(input.targetIds.map(String).filter(Boolean))] : [],
    ...(input?.endsAt ? { endsAt: String(input.endsAt) } : {})
  };
}

export function normalisePricingConfig(input: Partial<PricingConfig> | undefined): PricingConfig {
  const silent = input?.silentAdjustment;
  const fixedAdjustmentsGhs = Object.fromEntries(
    Object.entries(silent?.fixedAdjustmentsGhs || {})
      .map(([targetId, amount]) => [String(targetId), Math.max(-1_000_000, Math.min(1_000_000, finite(amount)))])
      .filter(([targetId, amount]) => Boolean(targetId) && amount !== 0)
  );
  return {
    silentAdjustment: {
      active: silent?.active === true,
      percent: Math.max(-99, Math.min(1000, finite(silent?.percent))),
      targetIds: Array.isArray(silent?.targetIds) ? [...new Set(silent.targetIds.map(String).filter(Boolean))] : [],
      fixedAdjustmentsGhs
    },
    globalPromotion: cleanPromotion(input?.globalPromotion),
    itemSpecificPromotion: cleanPromotion(input?.itemSpecificPromotion),
    itemSpecificPromotions: Array.isArray(input?.itemSpecificPromotions)
      ? input.itemSpecificPromotions
          .map((rule) => ({ ...cleanPromotion(rule), targetId: String(rule.targetId || '').trim() }))
          .filter((rule) => rule.targetId)
      : []
  };
}

export function invalidatePricingConfigCache(): void {
  cached = null;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const snapshot = await getFirestore().collection(COLLECTIONS.storeSettings).doc('pricing').get();
  const value = normalisePricingConfig(snapshot.exists ? snapshot.data() as Partial<PricingConfig> : DEFAULT_PRICING_CONFIG);
  cached = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export async function persistPricingConfig(input: Partial<PricingConfig>): Promise<PricingConfig> {
  const value = normalisePricingConfig(input);
  await getFirestore().collection(COLLECTIONS.storeSettings).doc('pricing').set(value);
  cached = { value, expiresAt: Date.now() + 30_000 };
  return value;
}
