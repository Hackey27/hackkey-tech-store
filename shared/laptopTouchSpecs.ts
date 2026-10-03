import type { Laptop } from './types';

export const LAPTOP_TWO_IN_ONE_OPTIONS = ['No', 'X360', 'Detachable'] as const;

/** Free text can describe touch support, including faults or pen support. */
export function hasLaptopTouchscreen(laptop: Pick<Laptop, 'touchscreen'>): boolean {
  const text = (laptop.touchscreen || '').trim();
  return Boolean(text) && !/^(?:no\b|false\b|0$|none\b|n\/?a\b|unknown\b|not\s+(?:(?:a|an)\s+)?(?:touch|sure)|non[ -]?touch|without\s+touch)/i.test(text);
}

export function laptopTwoInOneStatus(laptop: Pick<Laptop, 'touchscreen' | 'twoInOne'>): Laptop['twoInOne'] {
  if (!hasLaptopTouchscreen(laptop)) return undefined;
  return LAPTOP_TWO_IN_ONE_OPTIONS.includes(laptop.twoInOne!) ? laptop.twoInOne : 'No';
}

export function normalizeLaptopTouchSpecs(laptop: Laptop): Laptop {
  const result = { ...laptop, touchscreen: (laptop.touchscreen || '').trim() };
  if (hasLaptopTouchscreen(result) && result.twoInOne && !LAPTOP_TWO_IN_ONE_OPTIONS.includes(result.twoInOne)) throw new Error('2-in-1 must be No, X360 or Detachable.');
  const status = laptopTwoInOneStatus(result);
  if (status) result.twoInOne = status;
  else delete result.twoInOne;
  return result;
}
