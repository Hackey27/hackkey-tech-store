import type { RmbPricingSettings } from './types';

export interface BankChargeSettings {
  bankChargeMode: 'percentage_min' | 'ranges';
  bankChargeRateBps: number;
  bankChargeMinimumGhs: number;
  bankChargeMaximumGhs: number | null;
}

export const defaultBankChargeSettings = (): BankChargeSettings => ({ bankChargeMode: 'percentage_min', bankChargeRateBps: 850, bankChargeMinimumGhs: 7.47, bankChargeMaximumGhs: null });

/** Existing fixed bands keep their behavior until the admin switches modes.
 * A missing field gets a default; invalid stored values remain validation errors. */
export function resolveBankChargeSettings(input: Partial<RmbPricingSettings>): BankChargeSettings {
  const defaults = defaultBankChargeSettings();
  return {
    bankChargeMode: input.bankChargeMode === undefined ? (input.bankCharges?.length ? 'ranges' : defaults.bankChargeMode) : input.bankChargeMode,
    bankChargeRateBps: input.bankChargeRateBps === undefined ? defaults.bankChargeRateBps : input.bankChargeRateBps,
    bankChargeMinimumGhs: input.bankChargeMinimumGhs === undefined ? defaults.bankChargeMinimumGhs : input.bankChargeMinimumGhs,
    bankChargeMaximumGhs: input.bankChargeMaximumGhs === undefined ? null : input.bankChargeMaximumGhs,
  };
}

export function validateBankChargeSettings(input: Partial<RmbPricingSettings>): BankChargeSettings {
  const config = resolveBankChargeSettings(input);
  if (!['percentage_min', 'ranges'].includes(config.bankChargeMode)) throw new Error('Choose a valid bank-charge mode.');
  if (!Number.isInteger(config.bankChargeRateBps) || config.bankChargeRateBps < 0 || config.bankChargeRateBps > 10000) throw new Error('Bank charge rate must be an integer from 0 to 10000 basis points (0–100%).');
  const amount = (value: unknown, label: string) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9 || Number(value.toFixed(2)) !== value) throw new Error(`${label} must be a non-negative number with up to 2 decimal places.`);
  };
  amount(config.bankChargeMinimumGhs, 'Bank charge minimum');
  if (config.bankChargeMaximumGhs !== null) {
    amount(config.bankChargeMaximumGhs, 'Bank charge maximum');
    if (config.bankChargeMaximumGhs < config.bankChargeMinimumGhs) throw new Error('Bank charge maximum cannot be lower than the minimum.');
  }
  return config;
}

/** Non-negative exact arithmetic, half-up at a specified integer unit. */
export const roundHalfUp = (amount: bigint, divisor: bigint) => (amount + divisor / 2n) / divisor;
const pesewas = (ghs: number) => BigInt(ghs.toFixed(2).replace('.', ''));

/** Shared by the authoritative pipeline and admin examples. Base and return
 * value are integer pesewas; no floating-point monetary multiplication. */
export function percentageBankChargePesewas(basePesewas: bigint, input: Partial<RmbPricingSettings>): bigint {
  const config = validateBankChargeSettings(input);
  if (basePesewas <= 0n) return 0n;
  const rounded = roundHalfUp(basePesewas * BigInt(config.bankChargeRateBps), 10000n);
  const minimum = pesewas(config.bankChargeMinimumGhs);
  const charge = rounded < minimum ? minimum : rounded;
  const cap = config.bankChargeMaximumGhs === null ? null : pesewas(config.bankChargeMaximumGhs);
  return cap !== null && charge > cap ? cap : charge;
}

/** Informational crossover, rounded half-up to a pesewa for admin display. */
export function bankChargeBreakEvenPesewas(input: Partial<RmbPricingSettings>): bigint | null {
  const config = validateBankChargeSettings(input);
  return config.bankChargeRateBps === 0 ? null : roundHalfUp(pesewas(config.bankChargeMinimumGhs) * 10000n, BigInt(config.bankChargeRateBps));
}
