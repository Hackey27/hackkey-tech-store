import {
  PreorderAxis,
  PreorderCombination,
  PreorderDelivery,
  PreorderProduct,
} from './types';

/**
 * Combination resolution for the pre-order section.
 *
 * Both sides need this: the browser renders the product page from it, and the
 * server recomputes a submitted order's price from it rather than trusting the
 * client. That is why it lives in shared/ — see this directory's README.
 *
 * Two ideas carry the whole file.
 *
 * MOST SPECIFIC WINS. Combinations and image assignments may both specify only
 * some axes. Given what the customer has picked, the winner is the assignment
 * whose selections are a subset of theirs and which names the most axes. Ties
 * are impossible in valid data and rejected at save time by
 * validatePreorderProduct.
 *
 * REACHABILITY drives what the customer can see and press. A combination is
 * reachable from a selection when the two agree on every axis they both name —
 * which is a weaker test than subset, because a combination naming MORE axes
 * than the customer has picked is still reachable, it just has not won yet.
 * An axis is shown only if some reachable combination names it, and an option
 * is enabled only if picking it would leave something reachable. Without that,
 * partial combinations look broken: a customer picking Black would be asked for
 * a size that no Black combination distinguishes.
 */

export type PreorderSelections = Record<string, string>;

export interface ResolvedOption {
  value: string;
  /** Picking this would leave at least one combination reachable. */
  enabled: boolean;
  selected: boolean;
}

export interface ResolvedAxis {
  name: string;
  /** False when no reachable combination distinguishes this axis. */
  visible: boolean;
  options: ResolvedOption[];
}

export interface ResolvedPreorderSelection {
  /** Null while the selection is still ambiguous. */
  combination: PreorderCombination | null;
  /** Null when the product does not offer that delivery option, or the winning
   *  combination carries no price for it. */
  priceExpressPesewas: number | null;
  priceTwoMonthsPesewas: number | null;
  /** Falls back to the product's preview image when no assignment matches. */
  imagePath: string | null;
  /** In the product's own axis order. Hidden axes are present with visible:false
   *  so a caller can render in a stable order without re-deriving anything. */
  axes: ResolvedAxis[];
  /** A price resolved, so this can go in the cart. */
  sellable: boolean;
  /** Visible axes still unpicked. Drives the line under a disabled add button. */
  missingAxes: string[];
}

/** Every axis `candidate` names is named identically by `selections`. */
function isSubsetOf(candidate: PreorderSelections, selections: PreorderSelections): boolean {
  return Object.keys(candidate).every((axis) => selections[axis] === candidate[axis]);
}

/** The two agree wherever they overlap. Neither has to be complete. */
function isCompatible(candidate: PreorderSelections, selections: PreorderSelections): boolean {
  return Object.keys(candidate).every(
    (axis) => selections[axis] === undefined || selections[axis] === candidate[axis]
  );
}

function specificity(selections: PreorderSelections): number {
  return Object.keys(selections).length;
}

/** The most specific entry whose selections are a subset of the customer's. */
function mostSpecificMatch<T extends { selections: PreorderSelections }>(
  entries: T[],
  selections: PreorderSelections
): T | null {
  let winner: T | null = null;
  for (const entry of entries) {
    if (!isSubsetOf(entry.selections, selections)) continue;
    if (!winner || specificity(entry.selections) > specificity(winner.selections)) winner = entry;
  }
  return winner;
}

function priceFor(
  combination: PreorderCombination | null,
  product: PreorderProduct,
  delivery: PreorderDelivery
): number | null {
  if (!combination) return null;
  if (!product.deliveryOptions.includes(delivery)) return null;
  const price = delivery === 'express'
    ? combination.priceExpressPesewas
    : combination.priceTwoMonthsPesewas;
  return typeof price === 'number' ? price : null;
}

function resolveAxis(
  axis: PreorderAxis,
  product: PreorderProduct,
  selections: PreorderSelections
): ResolvedAxis {
  const reachable = product.combinations.filter((c) => isCompatible(c.selections, selections));
  // Shown only if something still on the table actually distinguishes this axis.
  const visible = reachable.some((c) => c.selections[axis.name] !== undefined);

  const options = axis.options.map((value) => ({
    value,
    selected: selections[axis.name] === value,
    // Greyed rather than hidden when unavailable: a customer should be able to
    // see that Red exists and is not available with what they have picked.
    enabled: product.combinations.some((c) =>
      isCompatible(c.selections, { ...selections, [axis.name]: value })
    ),
  }));

  return { name: axis.name, visible, options };
}

export function resolvePreorderSelection(
  product: PreorderProduct,
  selections: PreorderSelections
): ResolvedPreorderSelection {
  const combination = mostSpecificMatch(product.combinations, selections);
  const assignment = mostSpecificMatch(product.imageAssignments, selections);

  const axes = product.variantAxes.map((axis) => resolveAxis(axis, product, selections));
  const priceExpressPesewas = priceFor(combination, product, 'express');
  const priceTwoMonthsPesewas = priceFor(combination, product, 'two-months');

  return {
    combination,
    priceExpressPesewas,
    priceTwoMonthsPesewas,
    imagePath: assignment?.imagePath ?? product.previewImagePath ?? null,
    axes,
    sellable: priceExpressPesewas !== null || priceTwoMonthsPesewas !== null,
    missingAxes: axes
      .filter((axis) => axis.visible && selections[axis.name] === undefined)
      .map((axis) => axis.name),
  };
}

/** Lowest price across every combination, for the listing card's "from GHS X". */
export function lowestPricePesewas(
  product: PreorderProduct,
  delivery: PreorderDelivery
): number | null {
  if (!product.deliveryOptions.includes(delivery)) return null;
  const prices = product.combinations
    .map((c) => (delivery === 'express' ? c.priceExpressPesewas : c.priceTwoMonthsPesewas))
    .filter((price): price is number => typeof price === 'number');
  return prices.length ? Math.min(...prices) : null;
}

/** What the listing card shows: Express if offered, otherwise Two months. */
export function previewPricePesewas(
  product: PreorderProduct
): { pricePesewas: number; delivery: PreorderDelivery } | null {
  for (const delivery of ['express', 'two-months'] as const) {
    const pricePesewas = lowestPricePesewas(product, delivery);
    if (pricePesewas !== null) return { pricePesewas, delivery };
  }
  return null;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A readable, stable id for a combination, in the product's axis order.
 *
 * `{Colour: 'Black', Size: 'XL'}` becomes `colour-black__size-xl`, and the
 * implicit combination of a product with no axes becomes `default`. Readable
 * because these end up in shared links; derived from the selections so a
 * re-save cannot orphan one. Renaming an option does change the id, which is
 * the accepted cost of not putting opaque noise in a customer's URL.
 */
export function combinationSlug(selections: PreorderSelections, axes: PreorderAxis[]): string {
  const ordered = axes
    .map((axis) => axis.name)
    .filter((name) => selections[name] !== undefined);
  // An axis not in the product's list still has to appear, or two different
  // combinations could collapse onto one id.
  const extras = Object.keys(selections)
    .filter((name) => !ordered.includes(name))
    .sort();
  const parts = [...ordered, ...extras].map(
    (name) => `${slugPart(name)}-${slugPart(selections[name])}`
  );
  return parts.length ? parts.join('__') : 'default';
}

/** Order-independent identity for a selection map, for duplicate detection. */
function selectionKey(selections: PreorderSelections): string {
  return Object.keys(selections)
    .sort()
    .map((axis) => `${axis}=${selections[axis]}`)
    .join('&');
}

/** Guard against enumerating an unreasonable cross-product on a big product. */
const MAX_REACHABILITY_CHECKS = 2000;

export interface PreorderProductValidation {
  /** Block the save: these make pricing ambiguous or the product unsellable. */
  errors: string[];
  /** Usually an oversight rather than a decision, so flagged and not blocked. */
  warnings: string[];
}

export function validatePreorderProduct(product: PreorderProduct): PreorderProductValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!product.deliveryOptions.length) {
    errors.push('Choose at least one delivery option.');
  }

  if (!product.combinations.length) {
    errors.push('Add at least one combination, or nothing is purchasable.');
  }

  const seen = new Map<string, number>();
  for (const combination of product.combinations) {
    const key = selectionKey(combination.selections);
    seen.set(key, (seen.get(key) || 0) + 1);

    for (const [axisName, value] of Object.entries(combination.selections)) {
      const axis = product.variantAxes.find((candidate) => candidate.name === axisName);
      if (!axis) {
        errors.push(`Combination refers to "${axisName}", which is not one of this product's variants.`);
      } else if (!axis.options.includes(value)) {
        errors.push(`"${value}" is not an option of "${axisName}".`);
      }
    }

    const priced = product.deliveryOptions.some((delivery) =>
      typeof (delivery === 'express'
        ? combination.priceExpressPesewas
        : combination.priceTwoMonthsPesewas) === 'number'
    );
    if (!priced) {
      errors.push(`Combination "${combination.combinationId}" has no price for any offered delivery option.`);
    }
  }

  for (const [key, count] of seen) {
    if (count > 1) {
      errors.push(
        `Two combinations select the same thing (${key || 'no variants'}), so the price would be ambiguous.`
      );
    }
  }

  // A customer can pick any full set of options. Any that matches no
  // combination shows no price and cannot be bought — nearly always an
  // oversight, but deliberate gaps are legitimate, so this only warns.
  const total = product.variantAxes.reduce((count, axis) => count * Math.max(1, axis.options.length), 1);
  if (product.variantAxes.length && total <= MAX_REACHABILITY_CHECKS) {
    for (const selections of everySelection(product.variantAxes)) {
      if (!mostSpecificMatch(product.combinations, selections)) {
        const readable = product.variantAxes.map((axis) => selections[axis.name]).join(', ');
        warnings.push(`A customer could pick ${readable}, which matches no combination.`);
      }
    }
  }

  return { errors, warnings };
}

/** Every full selection a customer could arrive at. */
function everySelection(axes: PreorderAxis[]): PreorderSelections[] {
  return axes.reduce<PreorderSelections[]>(
    (rows, axis) =>
      rows.flatMap((row) => axis.options.map((option) => ({ ...row, [axis.name]: option }))),
    [{}]
  );
}

/** "Black, XL", or "Black, any size" where an axis is left open. */
export function readableSelections(
  selections: PreorderSelections,
  axes: PreorderAxis[]
): string {
  if (!axes.length) return '';
  return axes
    .map((axis) =>
      selections[axis.name] !== undefined
        ? selections[axis.name]
        : `any ${axis.name.toLowerCase()}`
    )
    .join(', ');
}
