import type { CatalogueItem } from '../../shared/types';
import type { CartItem } from '../components/CartView';

/** Refresh only variant laptop lines from the authoritative public catalogue. */
export function refreshLaptopCart(items: CartItem[], catalogue: CatalogueItem[]): CartItem[] {
  return items.map(line => {
    if (!line.product.laptopVariant) return line;
    const selection = line.product.laptopVariant;
    const current = catalogue.find(item => item.laptopVariant?.laptopId === selection.laptopId && item.laptopVariant.rowId === selection.rowId);
    if (!current) return { ...line, product: { ...line.product, pricePesewas: undefined } };
    const delivery = line.product.laptopDelivery;
    const price = current.laptopVariant?.currencyBasis === 'RMB' ? (delivery ? current.preorderPricesPesewas?.[delivery] : undefined) : current.pricePesewas;
    return { ...line, product: { ...current, pricePesewas: price, ...(current.laptopVariant?.currencyBasis === 'RMB' && delivery ? { laptopDelivery: delivery } : {}) } };
  });
}
export function unavailableLaptopLine(items: CartItem[]): boolean {
  return items.some(line => line.product.kind === 'laptop' && (!line.product.pricePesewas || line.product.pricePesewas <= 0));
}
