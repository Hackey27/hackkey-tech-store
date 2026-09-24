import { Order, Product } from '../src/types';
import { COLLECTIONS, getFirestore } from './firestore';

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
    customerAccessTokenHashes: _customerAccessTokenHashes,
    paymentReminderDate: _paymentReminderDate,
    paymentReminderScheduledAt: _paymentReminderScheduledAt,
    paymentReminderScheduledBy: _paymentReminderScheduledBy,
    paymentReminderSentAt: _paymentReminderSentAt,
    paymentReminderProcessingAt: _paymentReminderProcessingAt,
    paymentReminderPrimary: _paymentReminderPrimary,
    sellerSubmissionAlertStatus: _sellerSubmissionAlertStatus,
    sellerSubmissionAlertSentAt: _sellerSubmissionAlertSentAt,
    sellerSubmissionAlertProviderId: _sellerSubmissionAlertProviderId,
    sellerSubmissionAlertError: _sellerSubmissionAlertError,
    sellerSubmissionAlertAttempts: _sellerSubmissionAlertAttempts,
    ...safe
  } = order;
  return {
    ...safe,
    reportDocuments: safe.reportDocuments?.map(({ storagePath: _storagePath, ...report }) => report)
  } as Order;
}

export function publicOrderWithProductGuide(order: Order, product: Product | null): Order {
  const safe = publicOrder(order);
  if (!product) return safe;
  return {
    ...safe,
    installationButtonLabel: product.installationButtonLabel,
    installationGuides: product.installationGuides,
    showInstallationGuideFallback: product.showInstallationGuideFallback === true
  };
}

/** Fetch only the current customer-facing installation settings for a buyer
 * who has already located their order by phone or secure link. This still
 * works when the product is temporarily hidden from the public catalogue. */
export async function publicOrderWithCurrentGuide(order: Order, productCache = new Map<string, Promise<Product | null>>()): Promise<Order> {
  if (!order.productId) return publicOrder(order);
  let pending = productCache.get(order.productId);
  if (!pending) {
    pending = getFirestore().collection(COLLECTIONS.products).doc(order.productId).get()
      .then((snapshot) => snapshot.exists ? snapshot.data() as Product : null);
    productCache.set(order.productId, pending);
  }
  try {
    return publicOrderWithProductGuide(order, await pending);
  } catch {
    // Product metadata must not make an otherwise valid order lookup fail.
    return publicOrder(order);
  }
}
