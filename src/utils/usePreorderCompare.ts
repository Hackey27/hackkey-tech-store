import { useCallback, useState } from 'react';

/**
 * Which pre-order products are being compared.
 *
 * THREE AT A TIME. The comparison leads with each product's gallery, and a
 * fourth column takes those pictures below the width where they are worth
 * looking at on a laptop — which would defeat the point of the screen. Three
 * also stays readable on a phone, where the columns scroll sideways rather
 * than shrinking to slivers.
 *
 * Selection is a list of product ids rather than the products themselves, so a
 * catalogue refresh cannot leave the tray holding a stale copy of something
 * whose price has since changed.
 */
export const MAX_COMPARED = 3;

export interface PreorderCompare {
  productIds: string[];
  /** Full, so the cards can say so rather than silently ignoring a tap. */
  full: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

/** Adds, or removes if already there. Refuses silently past the cap — the
 *  caller is expected to have disabled the control by then. */
export function togglePreorderCompare(productIds: string[], productId: string): string[] {
  if (productIds.includes(productId)) return productIds.filter((entry) => entry !== productId);
  if (productIds.length >= MAX_COMPARED) return productIds;
  return [...productIds, productId];
}

export function usePreorderCompare(): PreorderCompare {
  const [productIds, setProductIds] = useState<string[]>([]);

  const toggle = useCallback((productId: string) => {
    setProductIds((current) => togglePreorderCompare(current, productId));
  }, []);

  const remove = useCallback((productId: string) => {
    setProductIds((current) => current.filter((entry) => entry !== productId));
  }, []);

  const clear = useCallback(() => setProductIds([]), []);

  return {
    productIds,
    full: productIds.length >= MAX_COMPARED,
    has: (productId: string) => productIds.includes(productId),
    toggle,
    remove,
    clear,
  };
}
