import { Order } from '../src/types';

/** The phone lookup is public. Seller notes, private storage paths and sales
 * codes never cross this boundary. Safe document receipt metadata does, so a
 * returning Turnitin customer is not asked to upload twice. */
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
