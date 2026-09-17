import { Order } from '../src/types';

/** The phone lookup is public. Seller notes, documents and sales codes never
 * cross this boundary, even if a future UI accidentally tries to render them. */
export function publicOrder(order: Order): Order {
  const {
    internalNotes: _internalNotes,
    offlinePaymentReason: _offlinePaymentReason,
    documentPath: _documentPath,
    fulfilmentHistory: _fulfilmentHistory,
    salesCode: _salesCode,
    ...safe
  } = order;
  return safe as Order;
}
