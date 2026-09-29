import { PreorderCategory, PreorderDelivery, PreorderProduct } from '../../shared/types';

/**
 * The listing page's filter strip, as plain functions over a product list.
 *
 * Kept out of the component so the rules can be asserted directly. Every one
 * of them is a quiet failure if it goes wrong — a price range that excludes a
 * product the customer can afford, or a facet count that zeroes itself the
 * moment you use it, is not something anybody reports.
 *
 * It lives in src/utils/ rather than shared/ because only the browser filters.
 * The server recomputes prices from the combination and never needs to know
 * how a listing was narrowed.
 */

export type PreorderSort = 'default' | 'price-asc' | 'price-desc';

export interface PreorderFilterState {
  /**
   * Selected category and subcategory ids. Empty means every category.
   *
   * ONE list drives both the quick dropdown and the Advanced tree. Two
   * independent category filters over the same dimension would have to either
   * intersect — where picking Apparel above and Bags below silently returns
   * nothing — or let one quietly override the other. Neither is explicable to
   * someone looking at the screen.
   */
  categoryIds: string[];
  /** Axis name to the values ticked under it. Values OR, axes AND. */
  axisValues: Record<string, string[]>;
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
  categoryIds: [],
  axisValues: {},
  delivery: 'all',
  sort: 'default',
  priceBasis: 'express',
  minCedis: '',
  maxCedis: '',
};

export function isPreorderFilterActive(filters: PreorderFilterState): boolean {
  return (
    filters.categoryIds.length > 0 ||
    Object.values(filters.axisValues).some((values) => values.length > 0) ||
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

/** Selected ids plus the children of any selected parent. Ticking a heading is
 *  understood as ticking everything filed beneath it. */
export function categoryScope(categories: PreorderCategory[], selected: string[]): Set<string> {
  const scope = new Set(selected);
  for (const category of categories) {
    if (category.parentId && scope.has(category.parentId)) scope.add(category.categoryId);
  }
  return scope;
}

function matchesCategory(
  product: PreorderProduct,
  categories: PreorderCategory[],
  selected: string[]
): boolean {
  if (!selected.length) return true;
  const scope = categoryScope(categories, selected);
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

function matchesPrice(product: PreorderProduct, filters: PreorderFilterState): boolean {
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

/** Does this product offer that option on that axis at all? */
export function productOffers(product: PreorderProduct, axisName: string, value: string): boolean {
  return Boolean(product.variantAxes.find((axis) => axis.name === axisName)?.options.includes(value));
}

/** Values within one axis are OR; separate axes are AND. */
function matchesAxes(product: PreorderProduct, axisValues: Record<string, string[]>): boolean {
  return Object.entries(axisValues).every(([name, values]) => {
    if (!values.length) return true;
    return values.some((value) => productOffers(product, name, value));
  });
}

/** Everything except the axis facets. Also the set the facets are derived from. */
export function narrowByBaseFilters(
  products: PreorderProduct[],
  categories: PreorderCategory[],
  filters: PreorderFilterState
): PreorderProduct[] {
  return products.filter((product) => {
    if (filters.delivery !== 'all' && !product.deliveryOptions.includes(filters.delivery)) return false;
    if (!matchesCategory(product, categories, filters.categoryIds)) return false;
    if (!matchesPrice(product, filters)) return false;
    return true;
  });
}

export function filterPreorderProducts(
  products: PreorderProduct[],
  categories: PreorderCategory[],
  filters: PreorderFilterState
): PreorderProduct[] {
  const matched = narrowByBaseFilters(products, categories, filters).filter((product) =>
    matchesAxes(product, filters.axisValues)
  );

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

/* -- the Advanced panel's derived facets ---------------------------------- */

export interface PreorderFacetOption {
  value: string;
  count: number;
  selected: boolean;
}

export interface PreorderAxisFacet {
  name: string;
  options: PreorderFacetOption[];
}

/**
 * The variant axes worth offering as filters, derived from the products.
 *
 * AN AXIS SURFACES ONLY IF EVERY PRODUCT IN THE CURRENT SELECTION HAS IT.
 * Half the shelf having a Size makes Size a useless filter: ticking it would
 * silently discard every product that simply does not carry that dimension,
 * rather than narrowing the ones that do. The cost of this rule is that axis
 * naming is load-bearing — "Size" on one product and "Storage size" on another
 * are two different axes and neither will surface — which is why the admin
 * screen warns when a new axis name is nearly an existing one.
 *
 * COUNTS IGNORE THEIR OWN FACET AND RESPECT EVERY OTHER. Counting an option
 * against its own facet's selections is what makes multi-select impossible:
 * tick Black, and every other colour immediately reads zero, so the interface
 * tells you there is nothing else to tick when in fact there is.
 */
export function derivePreorderAxisFacets(
  products: PreorderProduct[],
  categories: PreorderCategory[],
  filters: PreorderFilterState
): PreorderAxisFacet[] {
  const base = narrowByBaseFilters(products, categories, filters);
  if (!base.length) return [];

  // Ordered by the first product's axis order, so the panel does not reshuffle
  // itself as the selection changes.
  const shared = base[0].variantAxes
    .map((axis) => axis.name)
    .filter((name) => base.every((product) => product.variantAxes.some((axis) => axis.name === name)));

  return shared.map((name) => {
    const values: string[] = [];
    for (const product of base) {
      for (const option of product.variantAxes.find((axis) => axis.name === name)?.options || []) {
        if (!values.includes(option)) values.push(option);
      }
    }

    const others = { ...filters.axisValues };
    delete others[name];
    const selected = filters.axisValues[name] || [];

    return {
      name,
      options: values.map((value) => ({
        value,
        selected: selected.includes(value),
        count: base.filter(
          (product) => matchesAxes(product, others) && productOffers(product, name, value)
        ).length,
      })),
    };
  });
}

/**
 * Existing axis names close enough to `name` that one of them is likely a slip.
 *
 * The facet rule above matches axes by their exact name, so "Size" here and
 * "Storage size" there are two different dimensions and neither will ever
 * surface as a filter. Nothing errors and nothing looks wrong — the Advanced
 * panel simply stays empty — which is why the admin screen warns at the point
 * the name is typed rather than leaving it to be discovered on the storefront.
 *
 * Deliberately loose: it catches case and punctuation differences, and either
 * name containing the other. It is a hint, never a block, because two axes
 * genuinely called "Size" and "Screen size" are legitimate.
 */
export function similarAxisNames(name: string, existing: string[]): string[] {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const target = normalise(name);
  if (!target) return [];
  return existing.filter((candidate) => {
    if (candidate === name) return false;
    const other = normalise(candidate);
    if (!other) return false;
    return other === target || other.includes(target) || target.includes(other);
  });
}

/** Ticks or unticks one value, dropping the axis entirely when it empties. */
export function toggleAxisValue(
  axisValues: Record<string, string[]>,
  name: string,
  value: string
): Record<string, string[]> {
  const current = axisValues[name] || [];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  const updated = { ...axisValues };
  if (next.length) updated[name] = next;
  else delete updated[name];
  return updated;
}

/** Ticks or unticks one category. */
export function toggleCategoryId(categoryIds: string[], categoryId: string): string[] {
  return categoryIds.includes(categoryId)
    ? categoryIds.filter((entry) => entry !== categoryId)
    : [...categoryIds, categoryId];
}
