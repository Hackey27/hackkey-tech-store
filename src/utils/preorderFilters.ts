import { PreorderCategory, PreorderDelivery, PreorderProduct } from '../../shared/types';

/**
 * The listing page's filter strip, as plain functions over a product list.
 *
 * Kept out of the component so the rules can be asserted directly. Every one
 * of them is a quiet failure if it goes wrong — a price range that excludes a
 * product the customer can afford, or a sort that silently drops the
 * unpriced ones, is not something anybody reports.
 *
 * It lives in src/utils/ rather than shared/ because only the browser filters.
 * The server recomputes prices from the combination and never needs to know
 * how a listing was narrowed.
 */

export type PreorderSort = 'default' | 'price-asc' | 'price-desc';

export interface PreorderFilterState {
  /** '' means every category. */
  categoryId: string;
  subcategoryId: string;
  /** 'all', or one delivery speed the product must offer. */
  delivery: PreorderDelivery | 'all';
  sort: PreorderSort;
  /** Which delivery's price the sort and the range read. */
  priceBasis: PreorderDelivery;
  /** Whole cedis as typed, blank for open-ended. Parsed at the edge. */
  minCedis: string;
  maxCedis: string;
}

export const EMPTY_PREORDER_FILTERS: PreorderFilterState = {
  categoryId: '',
  subcategoryId: '',
  delivery: 'all',
  sort: 'default',
  priceBasis: 'express',
  minCedis: '',
  maxCedis: '',
};

export function isPreorderFilterActive(filters: PreorderFilterState): boolean {
  return (
    Boolean(filters.categoryId) ||
    Boolean(filters.subcategoryId) ||
    filters.delivery !== 'all' ||
    filters.sort !== 'default' ||
    Boolean(filters.minCedis.trim()) ||
    Boolean(filters.maxCedis.trim())
  );
}

function priceOf(product: PreorderProduct, delivery: PreorderDelivery): number[] {
  if (!product.deliveryOptions.includes(delivery)) return [];
  return product.combinations
    .map((c) => (delivery === 'express' ? c.priceExpressPesewas : c.priceTwoMonthsPesewas))
    .filter((price): price is number => typeof price === 'number');
}

/** The cheapest price a product can be had for at this speed, or null. */
export function lowestFor(product: PreorderProduct, delivery: PreorderDelivery): number | null {
  const prices = priceOf(product, delivery);
  return prices.length ? Math.min(...prices) : null;
}

/** The set of ids a category selection covers: itself plus its children. */
export function categoryScope(categories: PreorderCategory[], categoryId: string): Set<string> {
  return new Set([
    categoryId,
    ...categories.filter((c) => c.parentId === categoryId).map((c) => c.categoryId),
  ]);
}

function inCategory(
  product: PreorderProduct,
  categories: PreorderCategory[],
  filters: PreorderFilterState
): boolean {
  // The narrower control wins: once a subcategory is chosen the parent stops
  // mattering, which is what makes the second dropdown feel like a refinement
  // rather than a second, competing filter.
  const target = filters.subcategoryId || filters.categoryId;
  if (!target) return true;
  const scope = filters.subcategoryId ? new Set([target]) : categoryScope(categories, target);
  return scope.has(product.categoryId) || (product.subcategoryId ? scope.has(product.subcategoryId) : false);
}

/** Cedis as typed to integer pesewas, or null when blank or unparseable. */
function boundPesewas(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  // Rounded, not truncated: money arriving here is a human-typed cedi figure
  // and 12.005 should not quietly become 12.00.
  return Math.round(parsed * 100);
}

function inPriceRange(product: PreorderProduct, filters: PreorderFilterState): boolean {
  const min = boundPesewas(filters.minCedis);
  const max = boundPesewas(filters.maxCedis);
  if (min === null && max === null) return true;

  // A product qualifies when ANY of its combinations falls in the range. The
  // customer is asking what they could buy for that money, and a product whose
  // cheapest variant is affordable belongs in the list even if its dearest
  // is not.
  return priceOf(product, filters.priceBasis).some(
    (price) => (min === null || price >= min) && (max === null || price <= max)
  );
}

export function filterPreorderProducts(
  products: PreorderProduct[],
  categories: PreorderCategory[],
  filters: PreorderFilterState
): PreorderProduct[] {
  const matched = products.filter((product) => {
    if (filters.delivery !== 'all' && !product.deliveryOptions.includes(filters.delivery)) return false;
    if (!inCategory(product, categories, filters)) return false;
    if (!inPriceRange(product, filters)) return false;
    return true;
  });

  if (filters.sort === 'default') return matched;

  const direction = filters.sort === 'price-asc' ? 1 : -1;
  return [...matched].sort((a, b) => {
    const left = lowestFor(a, filters.priceBasis);
    const right = lowestFor(b, filters.priceBasis);
    // A product with no price at this speed sorts last either way. Treating
    // "ask for price" as zero would park it at the top of a cheapest-first
    // list, which is the one place it is most misleading.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * direction;
  });
}
