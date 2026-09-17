import type { CartItem } from '../components/CartView';

/** Convert a customer selection into identifiers only. Pricing always remains server-side. */
export function cartItemToCheckoutItem(item: CartItem) {
  if (item.product.kind === 'service' || item.serviceOption) {
    return {
      serviceId: item.product.itemId,
      optionId: item.serviceOption?.optionId ?? item.product.options?.[0]?.optionId,
      quantity: item.quantity
    };
  }
  if (item.product.kind === 'bundle') {
    return {
      bundleId: item.product.itemId,
      quantity: item.quantity,
      bundleSelections: item.bundleSelections
    };
  }
  return {
    variantId: item.variant?.variantId || item.product.variants?.[0]?.variantId,
    selectedOs: item.selectedOs || item.variant?.os || item.product.osList?.[0],
    quantity: item.quantity
  };
}
