import {
  PreorderCombination,
  PreorderDelivery,
  PreorderProduct,
} from '../../shared/types';
import {
  preorderCardPricing,
  readableSelections,
  resolvePreorderSelection,
  PreorderSelections,
  PreorderDeliveryPrice,
} from '../../shared/preorderCombinations';

/**
 * Search within the pre-order section.
 *
 * Token matching, normalised the same way the software catalogue's search
 * does it, so the two behave alike: every token must appear somewhere, in any
 * order, accents folded.
 *
 * Combination matches carry the selection for queries such as "black XL bag".
 * The overlay groups these matches into one product with selectable variants.
 *
 * A product's own haystack deliberately EXCLUDES its variant options. If it
 * included them, "black" would match the product itself and every product with
 * a black anything would surface as a whole product, which is the opposite of
 * narrowing. Option values live only in the combination haystacks, which each
 * carry the product's text as well — so a bare product word matches the
 * product and all of its combinations, while a word naming a variant matches
 * only the combinations that carry it.
 */

export interface PreorderSearchResult {
  /** Unique per row: a product row and its combination rows coexist. */
  key: string;
  product: PreorderProduct;
  /** Absent on the product's own row. */
  combination?: PreorderCombination;
  /** "Black, XL" on a combination row, empty on a product row. */
  selectionLabel: string;
  pricePesewas: number | null;
  delivery: PreorderDelivery | null;
  imageUrl?: string;
}

function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function preorderSearchTokens(query: string): string[] {
  return fold(query).trim().split(/\s+/).filter(Boolean);
}

/** Product-level text only. Variant options are deliberately not in here. */
function productText(product: PreorderProduct): string {
  return fold(
    [
      product.name,
      product.description,
      product.categoryId,
      product.subcategoryId,
      ...product.details.flatMap((detail) => [detail.label, detail.value]),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function combinationText(product: PreorderProduct, combination: PreorderCombination): string {
  return `${productText(product)} ${fold(
    [
      ...Object.keys(combination.selections),
      ...Object.values(combination.selections),
    ].join(' ')
  )}`;
}

const matches = (haystack: string, tokens: string[]) =>
  tokens.every((token) => haystack.includes(token));

/** The cheapest offered price on a combination, preferring Express. */
function combinationPrice(
  product: PreorderProduct,
  combination: PreorderCombination
): { pricePesewas: number | null; delivery: PreorderDelivery | null } {
  for (const delivery of ['express', 'two-months'] as const) {
    if (!product.deliveryOptions.includes(delivery)) continue;
    const price =
      delivery === 'express' ? combination.priceExpressPesewas : combination.priceTwoMonthsPesewas;
    if (typeof price === 'number') return { pricePesewas: price, delivery };
  }
  return { pricePesewas: null, delivery: null };
}

export function searchPreorder(
  products: PreorderProduct[],
  query: string
): PreorderSearchResult[] {
  const tokens = preorderSearchTokens(query);
  if (!tokens.length) return [];

  const results: PreorderSearchResult[] = [];

  for (const product of products) {
    if (matches(productText(product), tokens)) {
      const preview = preorderCardPricing(product)[0];
      results.push({
        key: product.productId,
        product,
        selectionLabel: '',
        pricePesewas: preview?.pricePesewas ?? null,
        delivery: preview?.delivery ?? null,
        imageUrl: product.previewImagePath,
      });
    }

    for (const combination of product.combinations) {
      // A product with no variants has one implicit combination whose label is
      // empty; listing it would be the same row twice under a blank name.
      if (!Object.keys(combination.selections).length) continue;
      if (!matches(combinationText(product, combination), tokens)) continue;

      const { pricePesewas, delivery } = combinationPrice(product, combination);
      results.push({
        key: `${product.productId}:${combination.combinationId}`,
        product,
        combination,
        selectionLabel: readableSelections(combination.selections, product.variantAxes),
        pricePesewas,
        delivery,
        // Through the resolver, so a result's picture is the one the product
        // page will show when the customer lands on it.
        imageUrl: resolvePreorderSelection(product, combination.selections).imagePath || undefined,
      });
    }
  }

  return results;
}

/** The link a result opens. A combination is a selection on the product page,
 *  so it is a parameter rather than a path of its own — drop it and the link
 *  is still the product. */
export function preorderResultHref(result: PreorderSearchResult): string {
  const path = `/preorder/${encodeURIComponent(result.product.productId)}`;
  return result.combination
    ? `${path}?combination=${encodeURIComponent(result.combination.combinationId)}`
    : path;
}

/** Results in the order found, grouped so a product and its combinations read
 *  as one block rather than as unrelated rows. */
export function groupPreorderResults(
  results: PreorderSearchResult[]
): Array<{ product: PreorderProduct; rows: PreorderSearchResult[] }> {
  const groups = new Map<string, { product: PreorderProduct; rows: PreorderSearchResult[] }>();
  for (const result of results) {
    const group = groups.get(result.product.productId) || { product: result.product, rows: [] };
    group.rows.push(result);
    groups.set(result.product.productId, group);
  }
  return [...groups.values()];
}

/** Exact prices once a combination resolves; otherwise starting prices among
 * the combinations compatible with the customer's current variant choices. */
export function preorderSelectionPricing(
  product: PreorderProduct,
  selections: PreorderSelections
): PreorderDeliveryPrice[] {
  if (!Object.keys(selections).length) return preorderCardPricing(product);
  const resolved = resolvePreorderSelection(product, selections);
  if (resolved.combination) {
    return product.deliveryOptions.flatMap(delivery => {
      const price = delivery === 'express' ? resolved.priceExpressPesewas : resolved.priceTwoMonthsPesewas;
      return price === null ? [] : [{ delivery, pricePesewas: price, uniform: true }];
    });
  }
  const combinations = product.combinations.filter(combination =>
    Object.entries(combination.selections).every(([axis, value]) =>
      selections[axis] === undefined || selections[axis] === value
    )
  );
  return preorderCardPricing({ ...product, combinations });
}
