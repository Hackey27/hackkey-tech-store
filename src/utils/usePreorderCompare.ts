import { useCallback, useState } from 'react';
import { addComparisonProduct, MAX_COMPARISON_PRODUCTS } from './comparison';

/** A session keeps product ids in selection order and opens the catalogue
 * to pick another. Cards expose Compare on desktop hover and on touch screens.
 * Columns scroll horizontally, with up to five preorders per session. */
export const MAX_COMPARED = MAX_COMPARISON_PRODUCTS;

export interface PreorderCompare {
  /** In pick order. The first is pinned leftmost. */
  productIds: string[];
  /** A session is running. */
  active: boolean;
  /** Looking for the next product, so the picker is showing. */
  picking: boolean;
  full: boolean;
  has: (productId: string) => boolean;
  /** From a product page: opens a session and goes looking for the next one. */
  start: (productId: string) => void;
  /** From the picker: takes this product and shows the comparison. */
  pick: (productId: string) => void;
  /** Reopens the picker for a further product. */
  addAnother: () => void;
  remove: (productId: string) => void;
  clear: () => void;
}

/** Adds, or removes if already there. Refuses past the cap — the caller is
 *  expected to have disabled the control by then. */
export function togglePreorderCompare(productIds: string[], productId: string): string[] {
  if (productIds.includes(productId)) return productIds.filter((entry) => entry !== productId);
  return addComparisonProduct(productIds, productId);
}

export function usePreorderCompare(): PreorderCompare {
  const [productIds, setProductIds] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  const start = useCallback((productId: string) => {
    setProductIds([productId]);
    // One product is not a comparison, so a new session goes straight to the
    // picker rather than showing a single lonely column.
    setPicking(true);
  }, []);

  const pick = useCallback((productId: string) => {
    setProductIds((current) => togglePreorderCompare(current, productId));
    setPicking(false);
  }, []);

  const addAnother = useCallback(() => setPicking(true), []);

  const remove = useCallback((productId: string) => {
    setProductIds((current) => {
      const next = current.filter((entry) => entry !== productId);
      // Down to one and the comparison has nothing to say, so it goes back to
      // picking rather than showing a column on its own.
      if (next.length < 2) setPicking(next.length > 0);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setProductIds([]);
    setPicking(false);
  }, []);

  return {
    productIds,
    active: productIds.length > 0,
    picking,
    full: productIds.length >= MAX_COMPARED,
    has: (productId: string) => productIds.includes(productId),
    start,
    pick,
    addAnother,
    remove,
    clear,
  };
}
