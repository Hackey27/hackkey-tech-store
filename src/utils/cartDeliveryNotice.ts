import type { CartItem } from '../components/CartView';

export type StoreNoticeKind = 'licence' | 'account' | 'report';

export function cartDeliveryNotice(item: CartItem): { enabled: boolean; kind: StoreNoticeKind; customerInputLabel?: string } {
  const enabled = item.product.kind === 'service'
    ? item.product.showDeliveryNotice === true
    : item.variant?.showDeliveryNotice === true;
  const kind: StoreNoticeKind = item.product.itemId.toUpperCase() === 'TURNITIN'
    ? 'report'
    : /account/i.test(item.variant?.fulfilmentType || '') ? 'account' : 'licence';
  const machineCodeType = item.product.machineCodeType;
  const customerInputLabel = item.variant?.customerInputRequired?.trim()
    || (machineCodeType === 'lock-code' ? 'Lock Code' : machineCodeType === 'hardware-id' ? 'Hardware ID' : undefined);
  return { enabled, kind, customerInputLabel };
}
