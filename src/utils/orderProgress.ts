import { Order } from '../types';

export function isTurnitinOrder(order: Pick<Order, 'productId' | 'variantId'>): boolean {
  return order.productId === 'TURNITIN' || order.variantId === 'TURNITIN';
}

export function turnitinOrderStep(order: Order): number {
  if (order.paymentStatus !== 'paid') return 3;
  if (order.fulfilmentStatus === 'ready') return 6;
  if (order.documentUploadedAt || order.documentUploadStatus === 'uploaded') return 5;
  return 4;
}
