/**
 * Money arithmetic, in integer pesewas.
 *
 * ₵47.50 is the first non-integer price in the system. Every calculation here
 * works in whole pesewas and converts to cedis only at the edges, because
 * floating-point arithmetic on money accumulates error that nobody notices
 * until the totals are audited.
 *
 * Storage note: orders keep `amountGhs` in cedis, which is the existing schema
 * and what Phase 1 orders already in Firestore contain. That value is produced
 * by a single division at the end, never by arithmetic in cedis, so no error
 * accumulates. `pesewasToCedis` and `cedisToPesewas` round-trip exactly for
 * every value the storefront can produce.
 */

import { PricingConfig, PromotionRule, ServiceOption } from '../types';

/** Cedis (possibly fractional, from Firestore) to whole pesewas. */
export function cedisToPesewas(cedis: number): number {
  if (typeof cedis !== 'number' || !Number.isFinite(cedis)) return 0;
  // Rounding absorbs any float imprecision already present in the input.
  return Math.round(cedis * 100);
}

/** Whole pesewas back to cedis, for storage and display. */
export function pesewasToCedis(pesewas: number): number {
  return Math.round(pesewas) / 100;
}

/** `GHS 1,200.00` — comma thousands separator, always two decimals. */
export function formatPesewas(pesewas: number): string {
  return `GHS ${pesewasToCedis(pesewas).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export interface ServiceLinePricing {
  /** What one unit costs at this quantity, in pesewas. */
  unitPricePesewas: number;
  /** unitPricePesewas × quantity, before any promotion. */
  totalPesewas: number;
  /** True when the bulk price applied. */
  bulkApplied: boolean;
}

/**
 * Price one service line.
 *
 * The bulk price **replaces** the unit price for every unit, not just the units
 * above the threshold. Two AI checks cost ₵95.00, not ₵97.50. Implemented as a
 * tiered calculation this overcharges every bulk customer by a small amount
 * that nobody ever reports, so it is covered by tests.
 */
export function priceServiceLine(option: ServiceOption, quantity: number): ServiceLinePricing {
  const qty = Math.max(1, Math.floor(quantity) || 1);

  const bulkApplied =
    option.bulkPriceGhs != null && option.bulkFromQty != null && qty >= option.bulkFromQty;

  const unitPricePesewas = cedisToPesewas(
    bulkApplied ? (option.bulkPriceGhs as number) : option.unitPriceGhs
  );

  return {
    unitPricePesewas,
    // Integer multiplication: exact, whatever the quantity.
    totalPesewas: unitPricePesewas * qty,
    bulkApplied
  };
}

export interface AppliedPricing {
  listPesewas: number;
  payablePesewas: number;
  promoLabel?: string;
  promoPercent?: number;
}

function ruleApplies(rule: { targetIds: string[] }, targetIds: string[], matchAll: boolean): boolean {
  if (rule.targetIds.length === 0) return matchAll;
  return rule.targetIds.some((id) => targetIds.includes(id));
}

/**
 * Apply the store's pricing rules on top of an already-resolved total, the same
 * way variant targets work: a silent adjustment produces the list price, then
 * at most one promotion applies to it, item-specific winning over global.
 *
 * Unlike the variant engine, which rounds to whole cedis, this keeps pesewa
 * precision — rounding a ₵47.50 line to a whole cedi would silently undo the
 * bulk price this phase exists to support.
 *
 * `targetIds` are the ids a rule may name, e.g. ['SERVICE:TURNITIN',
 * 'SERVICE:TURNITIN:PLAG_AI'].
 */
export function applyPricingRules(
  basePesewas: number,
  targetIds: string[],
  config: PricingConfig
): AppliedPricing {
  if (basePesewas <= 0) {
    return { listPesewas: 0, payablePesewas: 0 };
  }

  let listPesewas = basePesewas;

  const sa = config.silentAdjustment;
  if (sa?.active && sa.percent !== 0 && ruleApplies(sa, targetIds, true)) {
    listPesewas = Math.ceil(basePesewas * (1 + sa.percent / 100));
  }
  listPesewas = Math.max(1, Math.ceil(listPesewas));

  let promo: PromotionRule | null = null;

  const isp = config.itemSpecificPromotion;
  if (isp?.active && isp.percent > 0 && ruleApplies(isp, targetIds, false)) {
    promo = isp;
  }

  if (!promo) {
    const gp = config.globalPromotion;
    if (gp?.active && gp.percent > 0 && ruleApplies(gp, targetIds, true)) {
      promo = gp;
    }
  }

  if (!promo) {
    return { listPesewas, payablePesewas: listPesewas };
  }

  const payablePesewas = Math.max(1, Math.round(listPesewas * (1 - promo.percent / 100)));
  return {
    listPesewas,
    payablePesewas,
    promoLabel: promo.label,
    promoPercent: promo.percent
  };
}

/** The pricing-rule target ids for a service option. */
export function serviceTargetIds(serviceId: string, optionId?: string): string[] {
  return optionId ? [`SERVICE:${serviceId}`, `SERVICE:${serviceId}:${optionId}`] : [`SERVICE:${serviceId}`];
}

/** The cheapest single unit across a service's options, for the catalogue card. */
export function cheapestOptionPesewas(options: ServiceOption[]): number | undefined {
  const prices = options.map((o) => cedisToPesewas(o.unitPriceGhs)).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : undefined;
}
