export const MAX_COMPARISON_PRODUCTS = 5;

/** Keep the customer's selection order and refuse duplicate or excess picks. */
export function addComparisonProduct(ids: string[], id: string): string[] {
  if (ids.includes(id) || ids.length >= MAX_COMPARISON_PRODUCTS) return ids;
  return [...ids, id];
}
