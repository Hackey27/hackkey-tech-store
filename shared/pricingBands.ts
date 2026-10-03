import { cedisToPesewas, pesewasToCedis } from './money';

/** Inclusive price bands start at zero, then one pesewa after the prior maximum.
 * Keep later minima while an unfinished upper bound awaits input; validation
 * still rejects a blank upper bound before the last row or inverted bands. */
export function sequentialPricingBands<T extends { minimum: number; maximum: number | null }>(rows: T[]): T[] {
  return rows.map((row, index) => {
    const previous = rows[index - 1]?.maximum;
    const minimum = index === 0 ? 0 : typeof previous === 'number' && Number.isFinite(previous) && previous >= 0 ? pesewasToCedis(cedisToPesewas(previous) + 1) : row.minimum;
    return { ...row, minimum };
  });
}
