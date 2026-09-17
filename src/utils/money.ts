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

// ---------------------------------------------------------------------------
// One price-resolution path for every catalogue kind
// ---------------------------------------------------------------------------

/**
 * What one cart line costs, whatever kind it is.
 *
 * Products price from the chosen variant, services from the chosen option with
 * the bulk rule, and bundles and laptops from the price the catalogue already
 * resolved. Everything returns integer pesewas.
 *
 * This exists because four parallel resolutions is how a line ends up at ₵0:
 * the previous cart read `variant.priceGhs` and fell back to the item price
 * through a `??` chain whose left side was never nullish, so a bundle, service
 * or laptop — which has no variant — always resolved to zero.
 */
export function resolveLinePricePesewas(line: {
  item: { kind: string; pricePesewas?: number };
  variant?: { payablePricePesewas?: number; priceGhs?: number };
  serviceOption?: ServiceOption;
  quantity: number;
}): { unitPesewas: number; totalPesewas: number } {
  const quantity = Math.max(1, Math.floor(line.quantity) || 1);

  // A service with a chosen option carries the bulk rule, so quantity is
  // already accounted for in the line total.
  if (line.serviceOption) {
    const priced = priceServiceLine(line.serviceOption, quantity);
    return { unitPesewas: priced.unitPricePesewas, totalPesewas: priced.totalPesewas };
  }

  const unitPesewas =
    line.variant?.payablePricePesewas ??
    (line.variant?.priceGhs !== undefined ? cedisToPesewas(line.variant.priceGhs) : undefined) ??
    line.item.pricePesewas ??
    0;

  return { unitPesewas, totalPesewas: unitPesewas * quantity };
}

/**
 * Split a total across parts in proportion to their weights, exactly.
 *
 * A bundle's price is fixed and is deliberately not the sum of its parts, so
 * spreading it over one order row per item has to land on the bundle price to
 * the pesewa. Every part is floored and the **last row absorbs the remainder**,
 * which is what makes the sum exact rather than approximately right.
 */
export function allocateProportionally(totalPesewas: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (weights.length === 1) return [totalPesewas];

  const weightSum = weights.reduce((a, b) => a + b, 0);

  // No usable weights: split as evenly as integers allow.
  if (weightSum <= 0) {
    const each = Math.floor(totalPesewas / weights.length);
    const parts = weights.map(() => each);
    parts[parts.length - 1] = totalPesewas - each * (weights.length - 1);
    return parts;
  }

  const parts = weights.map((w) => Math.floor((totalPesewas * w) / weightSum));
  const allocated = parts.slice(0, -1).reduce((a, b) => a + b, 0);
  parts[parts.length - 1] = totalPesewas - allocated;
  return parts;
}
