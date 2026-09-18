import { Order } from '../types';

function submittedNameValues(order: Pick<Order, 'customerName' | 'serviceAnswers'>): string[] {
  const answerNames = Object.entries(order.serviceAnswers || {})
    .filter(([field, value]) => /name/i.test(field) && typeof value === 'string')
    .map(([, value]) => String(value));
  return [order.customerName, ...answerNames];
}

export function adminOrderMatchesSearch(
  order: Pick<Order, 'customerName' | 'serviceAnswers' | 'phone' | 'orderId' | 'email'>,
  query: string
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const haystack = [
    ...submittedNameValues(order),
    order.phone,
    order.orderId,
    order.email,
  ].join(' ').toLocaleLowerCase();
  return haystack.includes(needle);
}
