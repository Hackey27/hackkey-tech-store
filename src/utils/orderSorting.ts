import { Order } from '../types';

export function newestOrderFirst(a: Pick<Order, 'orderDate'>, b: Pick<Order, 'orderDate'>): number {
  return (b.orderDate || '').localeCompare(a.orderDate || '');
}
