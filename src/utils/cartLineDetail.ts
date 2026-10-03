import type { CartItem } from '../components/CartView';

type CartLine = Pick<CartItem, 'variant' | 'selectedOs' | 'serviceOption'> & Partial<Pick<CartItem, 'product'>>;

/**
 * The one-line description shown under a cart entry's name.
 *
 * Version and operating system are both shown. The previous `||` chain printed
 * whichever came first, so a line with a version never showed its OS — and the
 * OS is the part that decides which installer the customer is sent. Two lines
 * differing only by OS were indistinguishable in the cart preview.
 *
 * A service is described by its chosen option instead; it has no OS.
 */
export function cartLineDetail(item: CartLine): string {
  if (item.product?.laptopVariant) { const v = item.product.laptopVariant; return [v.cpu, v.ram, v.storage, v.currencyBasis === 'GHS' ? 'GHS direct' : 'RMB conversion', item.product.laptopDelivery === 'express' ? '2–3 weeks' : item.product.laptopDelivery === 'two-months' ? '6–8 weeks' : ''].filter(Boolean).join(' · '); }
  if (item.serviceOption) return item.serviceOption.name;
  const os = item.selectedOs || item.variant?.os;
  return [item.variant?.versionOrPlan, os].filter(Boolean).join(' · ');
}
