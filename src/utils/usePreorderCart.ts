import { useCallback, useMemo, useState } from 'react';
import { PreorderDelivery } from '../../shared/types';

/**
 * The pre-order basket.
 *
 * SEPARATE FROM THE SOFTWARE CART ON PURPOSE. They share no state, no storage
 * and no line type. A pre-order is a physical thing shipped from China over
 * weeks, priced per delivery speed and paid for against a different flow; a
 * licence key is issued in minutes. Merging them would mean one checkout that
 * has to ask which half of the basket it is dealing with at every step, and a
 * total that adds two things a customer never pays for together. Holding both
 * at once is normal and must keep working, which a shared cart would break.
 *
 * A line is shaped like `PreorderItem` so that submitting an order is a field
 * copy rather than a translation — the prices and labels the customer agreed
 * to are the ones that get stored.
 */

export interface PreorderCartLine {
  /** Product, combination and delivery together: picking Express and Two
   *  months of the same shirt is two lines, because they are two prices. */
  id: string;
  productId: string;
  productName: string;
  combinationId: string;
  /** "Black, XL", resolved once when the line is added. Copied rather than
   *  re-derived so a later axis rename cannot silently relabel a basket. */
  selectionLabel: string;
  delivery: PreorderDelivery;
  /** Integer pesewas, as everywhere else in the store. */
  pricePesewas: number;
  quantity: number;
  imageUrl?: string;
}

/** What a product page hands over. The id is derived here, so no caller can
 *  invent one that collides. */
export type PreorderCartAddition = Omit<PreorderCartLine, 'id' | 'quantity'> & {
  quantity?: number;
};

export interface PreorderCart {
  lines: PreorderCartLine[];
  /** Units, not lines: the badge counts things being ordered. */
  count: number;
  totalPesewas: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (addition: PreorderCartAddition) => void;
  remove: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
}

const MAX_QUANTITY = 99;

export function preorderLineId(
  productId: string,
  combinationId: string,
  delivery: PreorderDelivery
): string {
  return `${productId}__${combinationId}__${delivery}`;
}

/**
 * The basket's rules, as plain functions over a list of lines.
 *
 * They live outside the hook so they can be tested directly. A basket that
 * silently drops a line or doubles a quantity is the kind of defect nobody
 * reports — they just do not finish the order — so it is worth asserting
 * rather than clicking through.
 */

export function addPreorderLine(
  lines: PreorderCartLine[],
  addition: PreorderCartAddition
): PreorderCartLine[] {
  const id = preorderLineId(addition.productId, addition.combinationId, addition.delivery);
  const quantity = Math.max(1, Math.trunc(addition.quantity ?? 1));
  const index = lines.findIndex((line) => line.id === id);

  if (index === -1) return [...lines, { ...addition, id, quantity }];

  // The same thing again adds to the line rather than appearing twice: two
  // rows of "Black, XL — Express" in a basket reads as a bug.
  const updated = [...lines];
  updated[index] = {
    ...updated[index],
    // The price is re-taken from the addition, not kept from the old line. The
    // catalogue refreshes every 60 seconds, and a basket quietly holding
    // yesterday's price is one the server will reject at submission.
    pricePesewas: addition.pricePesewas,
    quantity: Math.min(MAX_QUANTITY, updated[index].quantity + quantity),
  };
  return updated;
}

export function removePreorderLine(lines: PreorderCartLine[], id: string): PreorderCartLine[] {
  return lines.filter((line) => line.id !== id);
}

export function setPreorderLineQuantity(
  lines: PreorderCartLine[],
  id: string,
  quantity: number
): PreorderCartLine[] {
  const wanted = Math.trunc(quantity);
  // Stepping down past one removes the line, which is what the minus button at
  // a quantity of one is expected to do.
  if (wanted < 1) return removePreorderLine(lines, id);
  return lines.map((line) =>
    line.id === id ? { ...line, quantity: Math.min(MAX_QUANTITY, wanted) } : line
  );
}

/** Units, not lines: the badge counts things being ordered. */
export function preorderCartCount(lines: PreorderCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function preorderCartTotalPesewas(lines: PreorderCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.pricePesewas * line.quantity, 0);
}

export function usePreorderCart(): PreorderCart {
  const [lines, setLines] = useState<PreorderCartLine[]>([]);
  const [open, setOpen] = useState(false);

  const add = useCallback((addition: PreorderCartAddition) => {
    setLines((current) => addPreorderLine(current, addition));
    // Adding opens the panel, so the customer sees the thing land rather than
    // only a number ticking over in the corner.
    setOpen(true);
  }, []);

  const remove = useCallback((id: string) => {
    setLines((current) => removePreorderLine(current, id));
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setLines((current) => setPreorderLineQuantity(current, id, quantity));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const count = useMemo(() => preorderCartCount(lines), [lines]);
  const totalPesewas = useMemo(() => preorderCartTotalPesewas(lines), [lines]);

  return { lines, count, totalPesewas, open, setOpen, add, remove, setQuantity, clear };
}
