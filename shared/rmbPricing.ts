import type { Laptop, PreorderCombination, PreorderDelivery, PreorderProduct, RmbPricingSettings, RmbSourceCost } from './types';
import { defaultBankChargeSettings, percentageBankChargePesewas, resolveBankChargeSettings, roundHalfUp, validateBankChargeSettings } from './bankCharges';

export const defaultRmbTransactionFee = () => ({ percent: 3, freeUpToRmb: 200, maximumPaymentRmb: 6000 });
export const emptyRmbPricingSettings = (): RmbPricingSettings => ({ ...defaultBankChargeSettings(), exchangeRate: null, bankCharges: [], transactionFee: defaultRmbTransactionFee(), profitMargins: [] });
/** Upgrade legacy fixed-fee settings on read without changing bank bands,
 * source costs or orders. Only an absent policy gets the default; malformed
 * saved policies must fail validation rather than silently changing prices. */
export function normalizeRmbPricingSettings(value?: Record<string, unknown>): RmbPricingSettings {
  const { transactionFees: _legacyFixedFees, ...stored } = value || {};
  return { ...emptyRmbPricingSettings(), ...stored, ...resolveBankChargeSettings(stored as Partial<RmbPricingSettings>) } as RmbPricingSettings;
}
export const isPreorderLaptop = (laptop: Pick<Laptop, 'availability'>) => /^pre[ -]?order$/i.test(laptop.availability.trim());
export const laptopDeliveries = (laptop: Laptop): PreorderDelivery[] => laptop.preorderDeliveryOptions || ['express', 'two-months'];

function number(value: unknown, label: string, decimals = 2): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9 || Number(value.toFixed(decimals)) !== value) throw new Error(`${label} must be a non-negative number with up to ${decimals} decimal places.`);
  return value;
}

/** Inclusive endpoints. Blank maximum means Above, and is allowed only last. */
export function validateRmbPricingSettings(input: RmbPricingSettings): RmbPricingSettings {
  const exchangeRate = number(input?.exchangeRate, 'RMB to GHS exchange rate', 6);
  if (!exchangeRate) throw new Error('RMB to GHS exchange rate must be greater than zero.');
  const bands = <T extends { minimum: number; maximum: number | null }>(rows: T[], label: string, field: string, optional: boolean, decimals = 2): T[] => {
    if (!Array.isArray(rows) || rows.length > 5 || (!optional && !rows.length)) throw new Error(`${label}: configure ${optional ? 'up to' : 'one to'} five ranges.`);
    const clean = rows.map((row, index) => {
      const minimum = number(row.minimum, `${label} row ${index + 1} minimum`);
      const maximum = row.maximum === null ? null : number(row.maximum, `${label} row ${index + 1} maximum`);
      const value = number((row as any)[field], `${label} row ${index + 1} ${field}`, decimals);
      if (maximum !== null && maximum < minimum) throw new Error(`${label} row ${index + 1}: maximum cannot be lower than minimum.`);
      return { minimum, maximum, [field]: value } as T;
    }).sort((a, b) => a.minimum - b.minimum);
    for (let i = 1; i < clean.length; i++) if (clean[i - 1].maximum === null || clean[i].minimum <= clean[i - 1].maximum!) throw new Error(`${label} ranges overlap. An open-ended range must be last.`);
    return clean;
  };
  const policy = input.transactionFee;
  const percent = number(policy?.percent, 'Transaction fee percentage', 4);
  if (percent > 100) throw new Error('Transaction fee percentage cannot exceed 100%.');
  const freeUpToRmb = number(policy?.freeUpToRmb, 'Fee-free payment limit in RMB');
  const maximumPaymentRmb = number(policy?.maximumPaymentRmb, 'Maximum payment in RMB');
  if (!maximumPaymentRmb || maximumPaymentRmb <= freeUpToRmb) throw new Error('Maximum payment must be greater than the fee-free payment limit.');
  const bankSettings = validateBankChargeSettings(input);
  return { exchangeRate, ...bankSettings, bankCharges: bands(input.bankCharges, 'Bank charges', 'charge', bankSettings.bankChargeMode === 'percentage_min'), transactionFee: { percent, freeUpToRmb, maximumPaymentRmb }, profitMargins: bands(input.profitMargins, 'Profit margins', 'percent', false, 4) };
}

export function validateRmbSourceCost(input: RmbSourceCost | undefined, deliveries: PreorderDelivery[]): RmbSourceCost {
  if (!input) throw new Error('Enter the raw product cost in RMB and shipping costs.');
  const rawCostRmb = number(input.rawCostRmb, 'Raw product cost in RMB');
  if (!rawCostRmb) throw new Error('Raw product cost in RMB must be greater than zero.');
  const result: RmbSourceCost = { rawCostRmb };
  for (const delivery of deliveries) {
    if (!['express', 'two-months'].includes(delivery)) throw new Error('Choose a valid delivery option.');
    const key = delivery === 'express' ? 'shippingExpressGhs' : 'shippingTwoMonthsGhs';
    result[key] = number(input[key], `${delivery === 'express' ? '2–3 weeks' : '6–8 weeks'} shipping cost in GHS`);
  }
  return result;
}

export interface RmbPriceBreakdown {
  rawCostRmb: number; exchangeRate: number; convertedCostGhs: number; bankChargeGhs: number;
  bankChargeBaseGhs: number; bankChargeMode: 'percentage_min' | 'ranges';
  transactionFeePercent: number; transactionFeeRmb: number; transactionFeeGhs: number; shippingGhs: number;
  landedCostGhs: number; marginPercent: number; profitGhs: number; sellingPriceGhs: number; pricePesewas: number;
}

/** Exact decimal arithmetic until the final whole-cedi ceiling. Intermediate
 * numbers below are display-only; never feed them back into the calculation. */
export function calculateRmbPrice(source: RmbSourceCost | undefined, delivery: PreorderDelivery, settings: RmbPricingSettings): RmbPriceBreakdown {
  const config = validateRmbPricingSettings(settings);
  const cost = validateRmbSourceCost(source, [delivery]);
  const scaled = (value: number, decimals: number) => BigInt(value.toFixed(decimals).replace('.', ''));
  // Convert the exact decimal string for display, avoiding rounding a large
  // BigInt to a Number before division (payable arithmetic stays in BigInt).
  const display = (value: bigint, decimals: number) => {
    const digits = value.toString().padStart(decimals + 1, '0');
    return Number(`${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`);
  };
  const minor = (value: number) => scaled(value, 2);
  const rate = scaled(config.exchangeRate!, 6);
  // Units are 10^-14 cedis: RMB decimals × percentage × exchange rate.
  // Preserve sub-pesewa percentage fees until the final whole-cedi ceiling.
  const unit = 100000000000000n, cediMinorUnit = 1000000000000n, percentUnit = 1000000n;
  const raw = minor(cost.rawCostRmb);
  if (raw > minor(config.transactionFee.maximumPaymentRmb)) throw new Error(`Raw RMB cost exceeds the configured ¥${config.transactionFee.maximumPaymentRmb} per-payment limit. Admin review is required; automatic pricing does not assume split payments.`);
  const converted = raw * rate * percentUnit;
  const match = <T extends { minimum: number; maximum: number | null }>(amount: bigint, rows: T[], multiplier: bigint) => rows.find(row => amount >= minor(row.minimum) * multiplier && (row.maximum === null || amount <= minor(row.maximum) * multiplier));
  const feePercent = raw > minor(config.transactionFee.freeUpToRmb) ? config.transactionFee.percent : 0;
  const feeRmbUnits = raw * scaled(feePercent, 4);
  const feeGhs = feeRmbUnits * rate;
  // Consume the existing fee output; its logic and rounding are unchanged.
  // Only percentage mode rounds the full debited base to pesewas half-up.
  const bankBase = config.bankChargeMode === 'percentage_min' ? roundHalfUp(converted + feeGhs, cediMinorUnit) : null;
  let bankCharge: bigint;
  if (bankBase !== null) bankCharge = percentageBankChargePesewas(bankBase, config);
  else {
    const band = match(converted, config.bankCharges, cediMinorUnit);
    if (!band) throw new Error('No bank-charge range covers the converted product cost. Check Payments → Exchange Rate & Charges.');
    bankCharge = minor(band.charge);
  }
  const shipping = delivery === 'express' ? cost.shippingExpressGhs! : cost.shippingTwoMonthsGhs!;
  const landed = converted + bankCharge * cediMinorUnit + feeGhs + minor(shipping) * cediMinorUnit;
  const margin = match(landed, config.profitMargins, cediMinorUnit);
  if (!margin) throw new Error('No profit-margin range covers this delivery option’s landed cost. Check Payments → Exchange Rate & Charges.');
  const percent = scaled(margin.percent, 4);
  const numerator = landed * (percentUnit + percent), denominator = unit * percentUnit;
  const roundedCedis = (numerator + denominator - 1n) / denominator;
  const pesewas = roundedCedis * 100n;
  if (pesewas > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Calculated selling price exceeds the supported money limit.');
  return { rawCostRmb: cost.rawCostRmb, exchangeRate: config.exchangeRate!, convertedCostGhs: display(converted, 14), bankChargeGhs: display(bankCharge, 2), bankChargeBaseGhs: bankBase === null ? display(converted, 14) : display(bankBase, 2), bankChargeMode: config.bankChargeMode!, transactionFeePercent: feePercent, transactionFeeRmb: display(feeRmbUnits, 8), transactionFeeGhs: display(feeGhs, 14), shippingGhs: shipping, landedCostGhs: display(landed, 14), marginPercent: margin.percent, profitGhs: display(landed * percent, 20), sellingPriceGhs: display(numerator, 20), pricePesewas: Number(pesewas) };
}

/** One adapter feeds every existing preorder view/resolver/cart. An invalid
 * automatic price is absent, never a fallback to an old manual price. */
export function priceRmbProduct(product: PreorderProduct, settings: RmbPricingSettings): { product: PreorderProduct; errors: string[] } {
  if (product.pricingMode !== 'rmb') return { product, errors: [] };
  const errors: string[] = [];
  const combinations = product.combinations.map(combination => {
    const { priceExpressPesewas: _express, priceTwoMonthsPesewas: _sea, ...source } = combination;
    const priced: PreorderCombination = { ...source };
    for (const delivery of product.deliveryOptions) {
      try { const result = calculateRmbPrice(combination.sourceCost, delivery, settings); if (delivery === 'express') priced.priceExpressPesewas = result.pricePesewas; else priced.priceTwoMonthsPesewas = result.pricePesewas; }
      catch (error) { errors.push(`${product.name} / ${combination.combinationId} / ${delivery}: ${(error as Error).message}`); }
    }
    return priced;
  });
  return { product: { ...product, combinations }, errors };
}

export function priceRmbLaptop(laptop: Laptop, settings: RmbPricingSettings): { prices: Partial<Record<PreorderDelivery, number>>; errors: string[] } {
  const prices: Partial<Record<PreorderDelivery, number>> = {}, errors: string[] = [];
  if (!isPreorderLaptop(laptop)) return { prices, errors };
  for (const delivery of laptopDeliveries(laptop)) try { prices[delivery] = calculateRmbPrice(laptop.preorderCost, delivery, settings).pricePesewas; } catch (error) { errors.push(`${laptop.title} / ${delivery}: ${(error as Error).message}`); }
  return { prices, errors };
}

export function publicRmbProduct(product: PreorderProduct): PreorderProduct {
  return { ...product, combinations: product.combinations.map(({ sourceCost: _private, ...combination }) => combination) };
}
export function publicRmbLaptop(laptop: Laptop): Laptop {
  const { preorderCost: _private, ...publicLaptop } = laptop;
  if (isPreorderLaptop(laptop)) delete publicLaptop.priceGhs;
  return publicLaptop;
}
