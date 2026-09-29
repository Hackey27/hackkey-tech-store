import { useCallback, useState } from 'react';

/**
 * A comparison session.
 *
 * THREE AT A TIME. The screen leads with each product's gallery, and a fourth
 * column takes those pictures below the width where they are worth looking at
 * on a laptop — which would defeat the point of it. Three also survives a
 * phone, where the columns scroll sideways rather than shrinking to slivers.
 *
 * A COMPARISON IS A SESSION, not a basket of ticks. It begins on a product
 * page, because a customer has to have opened something before comparing it is
 * a meaningful thing to want. While it is running, the listing doubles as the
 * picker for the next product and its cards grow a compare control; outside a
 * session those cards carry nothing, so ordinary browsing is not cluttered by
 * a feature almost nobody is using at that moment.
 *
 * The first product picked stays leftmost and the picker opens to its right.
 * That direction is the laptops brief's too, so the layout can be shared.
 *
 * Selection is a list of ids rather than products, so a catalogue refresh
 * cannot leave the session holding a stale copy of something repriced since.
 */
export const MAX_COMPARED = 3;

export interface PreorderCompare {
  /** In pick order. The first is pinned leftmost. */
  productIds: string[];
  /** A session is running: cards show their compare control. */
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
  if (productIds.length >= MAX_COMPARED) return productIds;
  return [...productIds, productId];
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
