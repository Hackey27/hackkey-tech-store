import type { Laptop, PreorderCombination, PreorderDelivery, PreorderProduct, RmbPricingSettings, RmbSourceCost } from './types';

export const emptyRmbPricingSettings = (): RmbPricingSettings => ({ exchangeRate: null, bankCharges: [], transactionFees: [], profitMargins: [] });
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
  return { exchangeRate, bankCharges: bands(input.bankCharges, 'Bank charges', 'charge', false), transactionFees: bands(input.transactionFees, 'Transaction fees', 'fee', true), profitMargins: bands(input.profitMargins, 'Profit margins', 'percent', false, 4) };
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
  transactionFeeRmb: number; transactionFeeGhs: number; shippingGhs: number;
  landedCostGhs: number; marginPercent: number; profitGhs: number; sellingPriceGhs: number; pricePesewas: number;
}

/** Exact decimal arithmetic until the final whole-cedi ceiling. Intermediate
 * numbers below are display-only; never feed them back into the calculation. */
export function calculateRmbPrice(source: RmbSourceCost | undefined, delivery: PreorderDelivery, settings: RmbPricingSettings): RmbPriceBreakdown {
  const config = validateRmbPricingSettings(settings);
  const cost = validateRmbSourceCost(source, [delivery]);
  const scaled = (value: number, decimals: number) => BigInt(value.toFixed(decimals).replace('.', ''));
  const minor = (value: number) => scaled(value, 2);
  const rate = scaled(config.exchangeRate!, 6);
  // Units are 10^-8 cedis: two RMB decimals times six exchange-rate decimals.
  const unit = 100000000n, cediMinorUnit = 1000000n;
  const converted = minor(cost.rawCostRmb) * rate;
  const match = <T extends { minimum: number; maximum: number | null }>(amount: bigint, rows: T[], multiplier: bigint) => rows.find(row => amount >= minor(row.minimum) * multiplier && (row.maximum === null || amount <= minor(row.maximum) * multiplier));
  const bank = match(converted, config.bankCharges, cediMinorUnit);
  if (!bank) throw new Error('No bank-charge range covers the converted product cost. Check Payments → Exchange Rate & Charges.');
  const fee = match(minor(cost.rawCostRmb), config.transactionFees, 1n)?.fee || 0;
  const feeGhs = minor(fee) * rate;
  const shipping = delivery === 'express' ? cost.shippingExpressGhs! : cost.shippingTwoMonthsGhs!;
  const landed = converted + minor(bank.charge) * cediMinorUnit + feeGhs + minor(shipping) * cediMinorUnit;
  const margin = match(landed, config.profitMargins, cediMinorUnit);
  if (!margin) throw new Error('No profit-margin range covers this delivery option’s landed cost. Check Payments → Exchange Rate & Charges.');
  const percent = scaled(margin.percent, 4), percentUnit = 1000000n;
  const numerator = landed * (percentUnit + percent), denominator = unit * percentUnit;
  const roundedCedis = (numerator + denominator - 1n) / denominator;
  const pesewas = roundedCedis * 100n;
  if (pesewas > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Calculated selling price exceeds the supported money limit.');
  return { rawCostRmb: cost.rawCostRmb, exchangeRate: config.exchangeRate!, convertedCostGhs: Number(converted) / Number(unit), bankChargeGhs: bank.charge, transactionFeeRmb: fee, transactionFeeGhs: Number(feeGhs) / Number(unit), shippingGhs: shipping, landedCostGhs: Number(landed) / Number(unit), marginPercent: margin.percent, profitGhs: Number(landed * percent) / Number(denominator), sellingPriceGhs: Number(numerator) / Number(denominator), pricePesewas: Number(pesewas) };
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
