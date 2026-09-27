import { Order } from '../../shared/types';

function submittedNameValues(order: Pick<Order, 'customerName' | 'serviceAnswers'>): string[] {
  const answerNames = Object.entries(order.serviceAnswers || {})
    .filter(([field, value]) => /name/i.test(field) && typeof value === 'string')
    .map(([, value]) => String(value));
  return [order.customerName, ...answerNames];
}

export function adminOrderMatchesSearch(
  order: Pick<Order, 'customerName' | 'serviceAnswers' | 'phone' | 'orderId' | 'email'> & Partial<Pick<Order, 'cartId'>>,
  query: string
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const haystack = [
    ...submittedNameValues(order),
    order.phone,
    order.orderId,
    // The cart id is what the customer is shown at checkout and quotes on
    // WhatsApp, so it has to be the thing the seller can search for. It also
    // pulls up every line of one multi-item checkout at once.
    order.cartId,
    order.email,
  ].filter(Boolean).join(' ').toLocaleLowerCase();
  return haystack.includes(needle);
}
