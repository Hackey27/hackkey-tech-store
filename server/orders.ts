import { Firestore } from '@google-cloud/firestore';
import {
  CustomerInputType,
  CustomerRequest,
  FulfilmentStatus,
  LicencePoolEntry,
  Order,
  Product,
  RequestKind,
  Variant
} from '../src/types';
import { COLLECTIONS, getFirestore } from './firestore';
import { findVariant } from './catalogue';

/** Ghana numbers are written as 0542638979 or +233542638979; both must match. */
export function normalisePhone(phone: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '');
  if (digits.startsWith('233')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  return digits;
}

function newId(prefix: string): string {
  return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface CheckoutItem {
  variantId: string;
  selectedOs?: string;
  quantity?: number;
}

export interface CheckoutRequest {
  customerName: string;
  phone: string;
  email: string;
  items: CheckoutItem[];
}

/**
 * Where an order sits once payment has landed, before any licence is issued.
 *
 * A variant that is not auto-fulfilled is always the seller's to activate; one
 * that needs a lock code or hardware ID cannot proceed until the customer
 * supplies it.
 */
function statusAfterPayment(variant: Variant, customerInputValue?: string): FulfilmentStatus {
  if (variant.customerInputRequired && !customerInputValue) {
    return 'awaiting-customer-input';
  }
  if (!variant.autoFulfil) {
    return 'awaiting-seller-activation';
  }
  return 'ready';
}

export async function createOrders(request: CheckoutRequest): Promise<Order[]> {
  const db = getFirestore();
  const cartId = newId('CART');
  const orders: Order[] = [];

  for (const item of request.items) {
    const found = await findVariant(item.variantId);
    if (!found) {
      throw new Error(`Unknown variant: ${item.variantId}`);
    }
    const { product, variant } = found;
    const quantity = Math.max(1, item.quantity || 1);

    for (let i = 0; i < quantity; i += 1) {
      const order: Order = {
        orderId: newId('HK'),
        cartId,
        orderDate: nowIso(),
        lastUpdated: nowIso(),
        customerName: request.customerName.trim(),
        phone: normalisePhone(request.phone),
        email: request.email.trim(),
        variantId: variant.variantId,
        productId: product.productId,
        productName: product.productName,
        versionOrPlan: variant.versionOrPlan,
        deliveryOs: item.selectedOs || variant.osList?.[0] || variant.os || '',
        amountGhs: variant.payablePriceGhs ?? variant.priceGhs,
        originalAmountGhs: variant.listPriceGhs ?? variant.priceGhs,
        paymentStatus: 'pending',
        fulfilmentStatus: 'pending-payment',
        fulfilmentType: variant.fulfilmentType,
        fulfilmentMethod: variant.autoFulfil ? 'automatic' : 'manual',
        customerInputType: (variant.customerInputRequired as CustomerInputType) || undefined,
        activationWebsiteUrl: variant.activationWebsiteUrl,
        windowsInstallerUrl: variant.windowsInstallerUrl,
        guideUrl: variant.guideUrl,
        learningResourcesUrl: variant.learningResourcesUrl,
        macViaParallels: variant.macViaParallels,
        receiptSent: false
      };

      await db.collection(COLLECTIONS.orders).doc(order.orderId).set(order);
      orders.push(order);
    }
  }

  return orders;
}

export interface FulfilmentOutcome {
  order: Order;
  /** True when a licence key was taken from the pool and attached. */
  licenceIssued: boolean;
}

/**
 * Mark an order paid and, where the variant is auto-fulfilled, take one licence
 * from the pool — atomically.
 *
 * The read of an available licence, its transition to `assigned`, and its
 * attachment to the order all happen inside one Firestore transaction.
 * Without that, two orders paid at the same moment can be handed the same key.
 *
 * The licence pool is empty for the whole of Phase 1, so "no licence available"
 * is the normal path, not an edge case. When the pool has nothing for this
 * variant the order stays valid and paid and moves to `awaiting-licence`, with
 * a note recording why, so the owner can issue one. This never throws, never
 * marks the order fulfilled, and never implies a licence is on its way when
 * none exists.
 */
export async function markOrderPaidAndFulfil(orderId: string): Promise<FulfilmentOutcome | null> {
  const db: Firestore = getFirestore();
  const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);

  // The variant is read before the transaction opens: it is catalogue data,
  // never contended, and a transaction body can be retried several times.
  const existing = await orderRef.get();
  if (!existing.exists) return null;
  const variant = (await findVariant((existing.data() as Order).variantId))?.variant;

  return db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return null;

    const order = orderSnap.data() as Order;

    // Already paid: report the current state rather than issuing a second key.
    if (order.paymentStatus === 'paid') {
      return { order, licenceIssued: false };
    }

    const patch: Partial<Order> = {
      paymentStatus: 'paid',
      lastUpdated: nowIso()
    };

    if (!variant) {
      // The variant vanished from the catalogue after the order was placed.
      // The customer has still paid, so the order is the seller's to resolve.
      patch.fulfilmentStatus = 'awaiting-seller-activation';
      patch.licenceIssueNote = `Variant ${order.variantId} is no longer in the catalogue; needs manual review.`;
      tx.update(orderRef, patch);
      return { order: { ...order, ...patch } as Order, licenceIssued: false };
    }

    const baseStatus = statusAfterPayment(variant, order.customerInputValue);

    if (!variant.autoFulfil) {
      patch.fulfilmentStatus = baseStatus;
      tx.update(orderRef, patch);
      return { order: { ...order, ...patch } as Order, licenceIssued: false };
    }

    // Auto-fulfilled: try to claim exactly one available licence for this
    // variant. All reads must precede writes inside a transaction.
    const licenceQuery = db
      .collection(COLLECTIONS.licencePool)
      .where('variantId', '==', order.variantId)
      .where('status', '==', 'available')
      .limit(1);

    const licenceSnap = await tx.get(licenceQuery);

    if (licenceSnap.empty) {
      patch.fulfilmentStatus = 'awaiting-licence';
      patch.licenceIssueNote =
        `No licence key was available in the pool for variant ${order.variantId} ` +
        `at ${nowIso()}. The order is paid and owed a licence.`;
      tx.update(orderRef, patch);
      return { order: { ...order, ...patch } as Order, licenceIssued: false };
    }

    const licenceDoc = licenceSnap.docs[0];
    const licence = licenceDoc.data() as LicencePoolEntry;

    tx.update(licenceDoc.ref, {
      status: 'assigned',
      assignedOrderId: order.orderId,
      dateAssigned: nowIso()
    });

    patch.licenceId = licence.licenceId;
    patch.activationCodeOrKey = licence.licenceCode;
    patch.fulfilmentStatus = baseStatus;
    if (baseStatus === 'ready') {
      patch.fulfilledAt = nowIso();
    }

    tx.update(orderRef, patch);
    return { order: { ...order, ...patch } as Order, licenceIssued: true };
  });
}

export async function lookupOrdersByPhone(phone: string): Promise<Order[]> {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.orders)
    .where('phone', '==', normalisePhone(phone))
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as Order)
    .sort((a, b) => (b.orderDate || '').localeCompare(a.orderDate || ''));
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
  return snap.exists ? (snap.data() as Order) : null;
}

/** The customer supplies a lock code or hardware ID the activation needs. */
export async function submitCustomerInput(
  orderId: string,
  inputValue: string
): Promise<{ success: boolean; message: string; order?: Order }> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { success: false, message: 'Order not found.' };
  }

  const order = snap.data() as Order;
  if (!order.customerInputType) {
    return { success: false, message: 'This order does not require any input.' };
  }

  // Supplying the input never completes the order on its own: a paid order
  // still needs its licence, and an unpaid one still needs payment.
  const nextStatus: FulfilmentStatus =
    order.paymentStatus !== 'paid'
      ? 'pending-payment'
      : order.licenceId
        ? 'ready'
        : order.fulfilmentMethod === 'automatic'
          ? 'awaiting-licence'
          : 'awaiting-seller-activation';

  const patch: Partial<Order> = {
    customerInputValue: inputValue.trim(),
    fulfilmentStatus: nextStatus,
    lastUpdated: nowIso()
  };
  if (nextStatus === 'ready') patch.fulfilledAt = nowIso();

  await ref.update(patch);
  return { success: true, message: 'Input received.', order: { ...order, ...patch } as Order };
}

export async function createRequest(
  kind: RequestKind,
  payload: {
    customerName: string;
    phone: string;
    email?: string;
    notes?: string;
    details: Record<string, unknown>;
  }
): Promise<CustomerRequest> {
  const db = getFirestore();
  const request: CustomerRequest = {
    requestId: newId('REQ'),
    kind,
    requestDate: nowIso(),
    customerName: payload.customerName.trim(),
    phone: normalisePhone(payload.phone),
    email: payload.email?.trim(),
    status: 'new',
    notes: payload.notes,
    details: payload.details
  };

  await db.collection(COLLECTIONS.requests).doc(request.requestId).set(request);
  return request;
}

export async function listRequests(): Promise<CustomerRequest[]> {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.requests).get();
  return snapshot.docs
    .map((doc) => doc.data() as CustomerRequest)
    .sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
}

export async function listOrders(): Promise<Order[]> {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.orders).get();
  return snapshot.docs.map((doc) => doc.data() as Order);
}

export async function listLicencePool(): Promise<LicencePoolEntry[]> {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.licencePool).get();
  return snapshot.docs.map((doc) => doc.data() as LicencePoolEntry);
}

export type { Product };
