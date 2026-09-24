import { Firestore } from '@google-cloud/firestore';
import { createHash, randomBytes } from 'node:crypto';
import {
  CheckoutPaymentMode,
  CustomerInputType,
  BundleItem,
  CustomerRequest,
  FulfilmentStatus,
  LicencePoolEntry,
  Order,
  Product,
  RequestKind,
  Variant
} from '../src/types';
import { COLLECTIONS, getFirestore } from './firestore';
import { findBundle, findLaptop, findService, findVariant } from './catalogue';
import {
  allocateProportionally,
  applyPricingRules,
  cedisToPesewas,
  priceServiceLine,
  serviceTargetIds
} from '../src/utils/money';
import { getPricingConfig } from './pricingConfig';
import { fulfilmentNoticeKind } from './deliveryNotice';
import { sendSellerRequestAlert } from './email';

/** Orders for a service are fulfilled by hand and never touch the licence pool. */
export const SERVICE_FULFILMENT_TYPE = 'Service';

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

function compactOrderCode(value: string, fallback: string, length: number, fromEnd = false): string {
  const code = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (fromEnd ? code.slice(-length) : code.slice(0, length)) || fallback;
}

function orderOptionCode(productId: string, versionOrPlan: string): string {
  if (productId.toUpperCase() === 'TURNITIN') {
    if (versionOrPlan.toUpperCase() === 'PLAG_AI') return 'AI';
    if (versionOrPlan.toUpperCase() === 'PLAG') return 'PL';
  }
  return compactOrderCode(versionOrPlan, 'GEN', 3, true);
}

/**
 * Human-readable order references. The date and time make the order easy to
 * recognise, while the final segments identify the item/version and add enough
 * cryptographic entropy for several lines created in the same second.
 */
export function buildOrderId(
  productId: string,
  versionOrPlan: string,
  date = new Date(),
  entropy = randomBytes(3).toString('hex').toUpperCase()
): string {
  const stamp = date.toISOString().replace(/[-:]/g, '');
  const day = stamp.slice(0, 8);
  const time = stamp.slice(9, 15);
  const productCode = compactOrderCode(productId.replace(/[^a-zA-Z]/g, ''), 'ITE', 3);
  const versionCode = orderOptionCode(productId, versionOrPlan);
  const uniqueCode = compactOrderCode(entropy, '000000', 6).padEnd(6, '0');
  return `HKT-${day}-${time}-${productCode}-${versionCode}-${uniqueCode}`;
}

function orderAccessTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

/** A cart line names WHAT WAS CHOSEN, by its kind. Never what it costs. */
export interface CheckoutItem {
  variantId?: string;
  selectedOs?: string;
  quantity?: number;
  serviceId?: string;
  optionId?: string;
  bundleId?: string;
  laptopId?: string;
  /** Maps an alternative group to the one variant the customer selected. */
  bundleSelections?: Record<string, string>;
}

export interface CheckoutRequest {
  customerName: string;
  phone: string;
  email: string;
  items: CheckoutItem[];
  checkoutMode?: CheckoutPaymentMode;
}

/** Keep every fixed bundle row and exactly one row from each alternative group. */
export function resolveBundleItems(items: BundleItem[], selections: Record<string, string> = {}): BundleItem[] {
  const fixedItems = items.filter((entry) => !entry.altGroup);
  const alternativeGroups = new Map<string, BundleItem[]>();
  for (const entry of items) {
    if (!entry.altGroup) continue;
    alternativeGroups.set(entry.altGroup, [...(alternativeGroups.get(entry.altGroup) || []), entry]);
  }
  const selectedAlternatives = [...alternativeGroups.entries()].map(([group, choices]) => {
    const requested = selections[group];
    const selected = requested
      ? choices.find((choice) => choice.variantId === requested)
      : choices.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0];
    if (!selected) throw new Error(`Invalid selection for bundle option ${group}.`);
    return selected;
  });
  return [...fixedItems, ...selectedAlternatives].sort((a, b) => a.sortOrder - b.sortOrder);
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

/**
 * One order for a purchasable service.
 *
 * A service goes through the same cart and checkout as software; only its
 * pricing and fulfilment differ. Quantity stays on the single order rather than
 * becoming N orders, because the customer buys "three checks", not three
 * separate jobs, and the historical rows are one row per purchase.
 */
async function createServiceOrder(
  request: CheckoutRequest,
  item: CheckoutItem,
  cartId: string
): Promise<Order> {
  const service = await findService(item.serviceId as string);
  if (!service) throw new Error(`Unknown service: ${item.serviceId}`);
  if (!service.options?.length) {
    throw new Error(`Service ${service.serviceId} is quote-only and cannot be bought.`);
  }

  const option = service.options.find((o) => o.optionId === item.optionId);
  if (!option) {
    throw new Error(`Unknown option "${item.optionId}" for service ${service.serviceId}.`);
  }

  const minQty = service.minQty ?? 1;
  const maxQty = service.maxQty ?? 50;
  const quantity = Math.min(maxQty, Math.max(minQty, Math.floor(item.quantity || 1) || 1));

  // Priced in integer pesewas; the store's pricing rules apply on top of the
  // resolved total, the same way variant targets work.
  const line = priceServiceLine(option, quantity);
  const pricingConfig = await getPricingConfig();
  const applied = applyPricingRules(
    line.unitPricePesewas,
    [...serviceTargetIds(service.serviceId, option.optionId), `CATEGORY:${service.categoryId}`],
    pricingConfig
  );

  return {
    orderId: buildOrderId(service.serviceId, option.optionId || option.name),
    cartId,
    orderDate: nowIso(),
    lastUpdated: nowIso(),
    customerName: request.customerName.trim(),
    phone: normalisePhone(request.phone),
    email: request.email.trim(),
    // Matches the historical Turnitin orders.
    variantId: service.serviceId,
    productId: service.serviceId,
    productName: service.name,
    // Historical rows put "Service" here and recorded no option, so which check
    // was bought is unrecoverable from them. Recording the option name from now
    // on is a deliberate improvement rather than reproducing that ambiguity.
    versionOrPlan: option.name,
    serviceOptionId: option.optionId,
    quantity,
    deliveryOs: '',
    amountPesewas: applied.payablePesewas * quantity,
    originalAmountPesewas: applied.listPesewas * quantity,
    paymentStatus: 'pending',
    checkoutMode: request.checkoutMode || 'paystack',
    fulfilmentStatus: 'pending-payment',
    fulfilmentType: SERVICE_FULFILMENT_TYPE,
    fulfilmentMethod: 'manual',
    showDeliveryNotice: service.showDeliveryNotice === true,
    fulfilmentNoticeKind: service.serviceId === 'TURNITIN' ? 'report' : undefined,
    receiptSent: false
  };
}

/**
 * A bundle becomes one order row per included item, sharing a cart id.
 *
 * The bundle price is fixed and deliberately not the sum of its parts, so it is
 * spread across the rows in proportion to each item's list price with the last
 * row absorbing the remainder — in integer pesewas the parts therefore sum to
 * the bundle price exactly, with no pesewa lost or invented.
 */
async function createBundleOrders(
  request: CheckoutRequest,
  item: CheckoutItem,
  cartId: string
): Promise<Order[]> {
  const bundle = await findBundle(item.bundleId as string);
  if (!bundle) throw new Error(`Unknown bundle: ${item.bundleId}`);
  if (!bundle.active) throw new Error(`Bundle ${bundle.bundleId} is not available.`);

  const quantity = Math.max(1, Math.floor(item.quantity || 1) || 1);
  const pricingConfig = await getPricingConfig();
  const applied = applyPricingRules(
    cedisToPesewas(bundle.priceGhs),
    [bundle.bundleId, `CATEGORY:${bundle.categoryId}`],
    pricingConfig
  );
  const totalPesewas = applied.payablePesewas * quantity;

  const selectedBundleItems = resolveBundleItems(bundle.items || [], item.bundleSelections);

  // Resolve each included item so the allocation can be weighted by real list
  // prices rather than split blindly.
  const resolved = await Promise.all(
    selectedBundleItems.map(async (bundleItem) => {
      const found = bundleItem.variantId ? await findVariant(bundleItem.variantId) : null;
      return { bundleItem, found };
    })
  );

  // A bundle with no items is still a sellable thing: it becomes one row.
  if (!resolved.length) {
    return [
      {
        orderId: buildOrderId(bundle.bundleId, 'BUNDLE'),
        cartId,
        orderDate: nowIso(),
        lastUpdated: nowIso(),
        customerName: request.customerName.trim(),
        phone: normalisePhone(request.phone),
        email: request.email.trim(),
        variantId: bundle.bundleId,
        productId: bundle.bundleId,
        productName: bundle.name,
        versionOrPlan: 'Bundle',
        quantity,
        deliveryOs: '',
        amountPesewas: totalPesewas,
        originalAmountPesewas: applied.listPesewas * quantity,
        paymentStatus: 'pending',
        checkoutMode: request.checkoutMode || 'paystack',
        fulfilmentStatus: 'pending-payment',
        fulfilmentType: 'Bundle',
        fulfilmentMethod: 'manual',
        receiptSent: false
      }
    ];
  }

  const weights = resolved.map(
    ({ found }) => found?.variant.payablePricePesewas ?? cedisToPesewas(found?.variant.priceGhs ?? 0)
  );
  const parts = allocateProportionally(totalPesewas, weights);

  return resolved.map(({ bundleItem, found }, i) => ({
    orderId: buildOrderId(found?.product.productId || bundleItem.productId || bundle.bundleId, found?.variant.versionOrPlan || bundleItem.variantId || 'BUNDLE'),
    cartId,
    orderDate: nowIso(),
    lastUpdated: nowIso(),
    customerName: request.customerName.trim(),
    phone: normalisePhone(request.phone),
    email: request.email.trim(),
    variantId: bundleItem.variantId || bundle.bundleId,
    productId: found?.product.productId || bundleItem.productId || bundle.bundleId,
    productName: found?.product.productName || bundle.name,
    versionOrPlan: found?.variant.versionOrPlan || 'Bundle',
    quantity,
    deliveryOs: found?.variant.osList?.[0] || found?.variant.os || '',
    amountPesewas: parts[i],
    paymentStatus: 'pending' as const,
    checkoutMode: request.checkoutMode || 'paystack',
    fulfilmentStatus: 'pending-payment' as const,
    // Part of a bundle, so the seller sees the whole purchase together.
    fulfilmentType: found?.variant.fulfilmentType || 'Bundle',
    fulfilmentMethod: (found?.variant.autoFulfil ? 'automatic' : 'manual') as 'automatic' | 'manual',
    deliveryCodeType: found?.variant.deliveryCodeType || 'licence',
    customerInputType: (found?.variant.customerInputRequired as CustomerInputType) || undefined,
    activationWebsiteUrl: found?.variant.activationWebsiteUrl,
    windowsInstallerUrl: found?.variant.windowsInstallerUrl,
    parallelsInstallerUrl: found?.variant.parallelsInstallerUrl,
    windows11DownloadUrl: found?.variant.windows11DownloadUrl,
    guideUrl: found?.variant.guideUrl,
    learningResourcesUrl: found?.variant.learningResourcesUrl,
    showDeliveryNotice: found?.variant.showDeliveryNotice === true,
    fulfilmentNoticeKind: fulfilmentNoticeKind(found?.variant.fulfilmentType),
    macViaParallels: false,
    notes: `Part of bundle ${bundle.bundleId} (${bundle.name}).`,
    receiptSent: false
  }));
}

/** A laptop is a single manually-fulfilled line. */
async function createLaptopOrder(
  request: CheckoutRequest,
  item: CheckoutItem,
  cartId: string
): Promise<Order> {
  const laptop = await findLaptop(item.laptopId as string);
  if (!laptop) throw new Error(`Unknown laptop: ${item.laptopId}`);
  if (!laptop.active) throw new Error(`Laptop ${laptop.laptopId} is not available.`);
  // A blank price means "ask for price"; it must never be sold as free.
  if (typeof laptop.priceGhs !== 'number' || laptop.priceGhs <= 0) {
    throw new Error(`${laptop.title} is priced on enquiry and cannot be bought online.`);
  }

  const quantity = Math.max(1, Math.floor(item.quantity || 1) || 1);
  const pricingConfig = await getPricingConfig();
  const applied = applyPricingRules(
    cedisToPesewas(laptop.priceGhs),
    [laptop.laptopId, `CATEGORY:${laptop.categoryId}`],
    pricingConfig
  );

  return {
    orderId: buildOrderId(laptop.laptopId, laptop.model || 'LAPTOP'),
    cartId,
    orderDate: nowIso(),
    lastUpdated: nowIso(),
    customerName: request.customerName.trim(),
    phone: normalisePhone(request.phone),
    email: request.email.trim(),
    variantId: laptop.laptopId,
    productId: laptop.laptopId,
    productName: laptop.title,
    versionOrPlan: [laptop.processor, laptop.ram, laptop.storage].filter(Boolean).join(' · ') || 'Laptop',
    quantity,
    deliveryOs: laptop.operatingSystem || '',
    amountPesewas: applied.payablePesewas * quantity,
    originalAmountPesewas: applied.listPesewas * quantity,
    paymentStatus: 'pending',
    checkoutMode: request.checkoutMode || 'paystack',
    fulfilmentStatus: 'pending-payment',
    fulfilmentType: 'Laptop',
    fulfilmentMethod: 'manual',
    receiptSent: false
  };
}

export async function createOrders(request: CheckoutRequest): Promise<Order[]> {
  const db = getFirestore();
  const cartId = newId('CART');
  const orders: Order[] = [];

  for (const item of request.items) {
    if (item.serviceId) {
      const order = await createServiceOrder(request, item, cartId);
      await db.collection(COLLECTIONS.orders).doc(order.orderId).set(order);
      orders.push(order);
      continue;
    }

    if (item.bundleId) {
      const bundleOrders = await createBundleOrders(request, item, cartId);
      for (const order of bundleOrders) {
        await db.collection(COLLECTIONS.orders).doc(order.orderId).set(order);
        orders.push(order);
      }
      continue;
    }

    if (item.laptopId) {
      const order = await createLaptopOrder(request, item, cartId);
      await db.collection(COLLECTIONS.orders).doc(order.orderId).set(order);
      orders.push(order);
      continue;
    }

    if (!item.variantId) {
      throw new Error(
        'Each cart line must name a variantId, serviceId, bundleId or laptopId.'
      );
    }

    const found = await findVariant(item.variantId);
    if (!found) {
      throw new Error(`Unknown variant: ${item.variantId}`);
    }
    const { product, variant } = found;
    const quantity = Math.max(1, item.quantity || 1);

    for (let i = 0; i < quantity; i += 1) {
      const selectedOs = item.selectedOs || variant.osList?.[0] || variant.os || '';
      const macViaParallels = /via parallels/i.test(selectedOs);
      const order: Order = {
        orderId: buildOrderId(product.productId, variant.versionOrPlan),
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
        deliveryOs: selectedOs,
        amountPesewas: variant.payablePricePesewas ?? cedisToPesewas(variant.priceGhs),
        originalAmountPesewas: variant.listPricePesewas ?? cedisToPesewas(variant.priceGhs),
        paymentStatus: 'pending',
        checkoutMode: request.checkoutMode || 'paystack',
        fulfilmentStatus: 'pending-payment',
        fulfilmentType: variant.fulfilmentType,
        fulfilmentMethod: variant.autoFulfil ? 'automatic' : 'manual',
        deliveryCodeType: variant.deliveryCodeType || 'licence',
        customerInputType: (variant.customerInputRequired as CustomerInputType) || undefined,
        activationWebsiteUrl: variant.activationWebsiteUrl,
        windowsInstallerUrl: variant.windowsInstallerUrl,
        parallelsInstallerUrl: variant.parallelsInstallerUrl,
        windows11DownloadUrl: variant.windows11DownloadUrl,
        guideUrl: variant.guideUrl,
        learningResourcesUrl: variant.learningResourcesUrl,
        showDeliveryNotice: variant.showDeliveryNotice === true,
        fulfilmentNoticeKind: fulfilmentNoticeKind(variant.fulfilmentType),
        macViaParallels,
        quantity: 1,
        receiptSent: false
      };

      await db.collection(COLLECTIONS.orders).doc(order.orderId).set(order);
      orders.push(order);
    }
  }

  // Only the primary row carries the cart-level alert state. This keeps a
  // multi-item checkout from producing one seller email per line.
  if (orders[0]) {
    orders[0].sellerSubmissionAlertStatus = 'pending';
    orders[0].sellerSubmissionAlertAttempts = 0;
    await db.collection(COLLECTIONS.orders).doc(orders[0].orderId).update({
      sellerSubmissionAlertStatus: 'pending',
      sellerSubmissionAlertAttempts: 0
    });
  }

  return orders;
}

/**
 * Store the Paystack reference on every order in the cart.
 *
 * One checkout is one Paystack transaction, so a multi-line cart shares a
 * reference; the lookup in applyVerifiedPayment finds the order whose id is the
 * reference, and the rest of the cart carries it for tracing.
 */
export async function recordPaystackReference(
  orders: Order[],
  reference: string
): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();
  for (const order of orders) {
    batch.update(db.collection(COLLECTIONS.orders).doc(order.orderId), {
      paystackReference: reference,
      lastUpdated: nowIso()
    });
    order.paystackReference = reference;
  }
  await batch.commit();
}

/** Record the payment choices shown for a retry from Find Order. */
export async function recordCheckoutMode(orders: Order[], checkoutMode: CheckoutPaymentMode): Promise<void> {
  const batch = getFirestore().batch();
  const lastUpdated = nowIso();
  for (const order of orders) {
    order.checkoutMode = checkoutMode;
    order.lastUpdated = lastUpdated;
    batch.update(getFirestore().collection(COLLECTIONS.orders).doc(order.orderId), { checkoutMode, lastUpdated });
  }
  await batch.commit();
}

export interface FulfilmentOutcome {
  order: Order;
  /** True when a licence key was taken from the pool and attached. */
  licenceIssued: boolean;
  /** True when the order was already paid when the transaction ran, so this
   *  call changed nothing. The webhook and the customer's return race each
   *  other; exactly one of them wins and only that one sends email. */
  alreadyPaid: boolean;
}

/**
 * Mark an order paid and, where the variant is auto-fulfilled, take one licence
 * from the pool — atomically.
 *
 * NOT A PUBLIC ENTRY POINT. Paystack verification and the authenticated,
 * audited offline-payment admin action both converge here so their fulfilment
 * behavior cannot drift.
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
export async function fulfilPaidOrder(
  orderId: string,
  payment:
    | { method: 'paystack'; paystackReference: string; paidAt?: string }
    | { method: 'offline'; reference: string; reason: string; paidAt?: string }
): Promise<FulfilmentOutcome | null> {
  const db: Firestore = getFirestore();
  const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);

  // The variant is read before the transaction opens: it is catalogue data,
  // never contended, and a transaction body can be retried several times.
  const existing = await orderRef.get();
  if (!existing.exists) return null;
  const existingOrder = existing.data() as Order;
  const variant =
    existingOrder.fulfilmentType === SERVICE_FULFILMENT_TYPE
      ? undefined
      : (await findVariant(existingOrder.variantId))?.variant;

  return db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return null;

    const order = orderSnap.data() as Order;

    // Idempotency, inside the transaction. Without this check here, the
    // webhook and the customer's return can both pass it and one payment
    // issues two licences.
    if (order.paymentStatus === 'paid') {
      return { order, licenceIssued: false, alreadyPaid: true };
    }

    const patch: Partial<Order> = {
      paymentStatus: 'paid',
      paymentMethod: payment.method,
      paidAt: payment.paidAt || nowIso(),
      lastUpdated: nowIso()
    };
    const recordHistory = (status: FulfilmentStatus, note: string) => {
      patch.fulfilmentHistory = [
        ...(order.fulfilmentHistory || []),
        { status, at: patch.paidAt as string, note }
      ];
    };
    if (payment.method === 'paystack') {
      patch.paystackReference = payment.paystackReference;
    } else {
      patch.offlinePaymentReference = payment.reference;
      patch.offlinePaymentReason = payment.reason;
    }

    // A service is fulfilled by hand and must never touch the licence pool.
    // Landing one in awaiting-licence would be meaningless and would hide it
    // from the queue the seller actually watches. Checked before the variant
    // lookup, because a service order has no variant to find.
    if (order.fulfilmentType === SERVICE_FULFILMENT_TYPE) {
      // Paid but nothing received yet, unless the customer already uploaded.
      patch.fulfilmentStatus = order.documentPath
        ? 'awaiting-seller-activation'
        : 'awaiting-document';
      recordHistory(patch.fulfilmentStatus, `${payment.method === 'offline' ? 'Offline' : 'Paystack'} payment confirmed.`);
      tx.update(orderRef, patch);
      return { order: { ...order, ...patch } as Order, licenceIssued: false, alreadyPaid: false };
    }

    if (!variant) {
      // The variant vanished from the catalogue after the order was placed.
      // The customer has still paid, so the order is the seller's to resolve.
      patch.fulfilmentStatus = 'awaiting-seller-activation';
      patch.licenceIssueNote = `Variant ${order.variantId} is no longer in the catalogue; needs manual review.`;
      recordHistory('awaiting-seller-activation', 'Payment confirmed; catalogue variant requires manual review.');
      tx.update(orderRef, patch);
      return { order: { ...order, ...patch } as Order, licenceIssued: false, alreadyPaid: false };
    }

    const baseStatus = statusAfterPayment(variant, order.customerInputValue);

    if (!variant.autoFulfil) {
      patch.fulfilmentStatus = baseStatus;
      recordHistory(baseStatus, 'Payment confirmed; seller fulfilment required.');
      tx.update(orderRef, patch);
      return { order: { ...order, ...patch } as Order, licenceIssued: false, alreadyPaid: false };
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
      recordHistory('awaiting-licence', 'Payment confirmed; no licence was available in stock.');
      tx.update(orderRef, patch);
      return { order: { ...order, ...patch } as Order, licenceIssued: false, alreadyPaid: false };
    }

    const licenceDoc = licenceSnap.docs[0];
    const licence = licenceDoc.data() as LicencePoolEntry;

    tx.update(licenceDoc.ref, {
      status: 'assigned',
      assignedOrderId: order.orderId,
      dateAssigned: nowIso()
    });

    patch.licenceId = licence.licenceId;
    const isSalesCode = variant.deliveryCodeType === 'sales-code';
    if (isSalesCode) patch.salesCode = licence.licenceCode;
    else patch.activationCodeOrKey = licence.licenceCode;
    patch.fulfilmentStatus = isSalesCode
      ? (variant.customerInputRequired && !order.customerInputValue ? 'awaiting-customer-input' : 'awaiting-seller-activation')
      : baseStatus;
    recordHistory(patch.fulfilmentStatus, isSalesCode
      ? 'Payment confirmed and an internal sales code was assigned automatically.'
      : 'Payment confirmed and a licence was assigned automatically.');
    if (patch.fulfilmentStatus === 'ready') {
      patch.fulfilledAt = nowIso();
    }

    tx.update(orderRef, patch);
    return { order: { ...order, ...patch } as Order, licenceIssued: true, alreadyPaid: false };
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

/** Create a bearer link token for one order. Only its hash is retained. Keep a
 * small rolling set so sending a new notification does not break older links. */
export async function createOrderAccessToken(orderId: string): Promise<{ order: Order; token: string }> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Order not found.');
  const order = snap.data() as Order;
  const token = randomBytes(24).toString('base64url');
  const hashes = [...new Set([...(order.customerAccessTokenHashes || []), orderAccessTokenHash(token)])].slice(-5);
  const customerAccessLinkCreatedAt = nowIso();
  await ref.update({ customerAccessTokenHashes: hashes, customerAccessLinkCreatedAt, lastUpdated: customerAccessLinkCreatedAt });
  return { order: { ...order, customerAccessTokenHashes: hashes, customerAccessLinkCreatedAt }, token };
}

/** Resolve a single customer order from a high-entropy bearer token. */
export async function getOrderByAccessToken(orderId: string, token: string): Promise<Order | null> {
  if (!token || token.length < 24) return null;
  const order = await getOrder(orderId);
  if (!order) return null;
  const requested = orderAccessTokenHash(token);
  return (order.customerAccessTokenHashes || []).includes(requested) ? order : null;
}

export async function getOrdersByCartId(cartId: string): Promise<Order[]> {
  const snapshot = await getFirestore().collection(COLLECTIONS.orders).where('cartId', '==', cartId).get();
  return snapshot.docs.map((doc) => doc.data() as Order);
}

export async function getOrderByPaystackReference(reference: string): Promise<Order | null> {
  const snapshot = await getFirestore().collection(COLLECTIONS.orders).where('paystackReference', '==', reference).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0].data() as Order;
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
      : order.licenceId && order.deliveryCodeType !== 'sales-code'
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

/**
 * Attach an uploaded document to a paid order and move it on.
 *
 * `awaiting-document` means paid with nothing received; once a file lands the
 * order is ready for the seller to run. The WhatsApp route has no upload, so it
 * stays in `awaiting-document` until the seller marks it received, which is a
 * Phase 2 admin action — remaining visible as outstanding in the meantime,
 * which is correct.
 */
export async function attachDocument(
  orderId: string,
  documentPath: string,
  originalName: string,
  sizeBytes?: number
): Promise<{ success: boolean; message: string; order?: Order }> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();

  if (!snap.exists) return { success: false, message: 'Order not found.' };

  const order = snap.data() as Order;
  if (order.paymentStatus !== 'paid') {
    // Uploads are only ever accepted against an order that has been paid for.
    return { success: false, message: 'This order has not been paid for.' };
  }

  const receivedAt = nowIso();
  const patch: Partial<Order> = {
    documentPath,
    documentUploadedAt: receivedAt,
    documentReceivedAt: receivedAt,
    documentUploadStatus: 'uploaded',
    documentSubmissionMethod: 'upload',
    documentOriginalName: originalName,
    documentSizeBytes: sizeBytes,
    fulfilmentStatus: 'awaiting-seller-activation',
    lastUpdated: nowIso()
  };

  await ref.update(patch);
  return { success: true, message: 'Document received.', order: { ...order, ...patch } as Order };
}

export async function markDocumentUploadPending(orderId: string): Promise<void> {
  await getFirestore().collection(COLLECTIONS.orders).doc(orderId).update({
    documentUploadStatus: 'pending',
    lastUpdated: nowIso()
  });
}

/** Store the customer's answers to a service's submission form. */
export async function saveServiceAnswers(
  orderId: string,
  answers: Record<string, unknown>
): Promise<Order | null> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const patch: Partial<Order> = { serviceAnswers: answers, lastUpdated: nowIso() };
  await ref.update(patch);
  return { ...(snap.data() as Order), ...patch } as Order;
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
    details: payload.details,
    sellerSubmissionAlertStatus: 'pending',
    sellerSubmissionAlertAttempts: 0
  };

  const ref = db.collection(COLLECTIONS.requests).doc(request.requestId);
  await ref.set(request);
  try {
    const receipt = await sendSellerRequestAlert(request);
    const sentAt = nowIso();
    await ref.update({
      sellerSubmissionAlertStatus: 'sent',
      sellerSubmissionAlertSentAt: sentAt,
      sellerSubmissionAlertProviderId: receipt.providerId || null,
      sellerSubmissionAlertError: null,
      sellerSubmissionAlertAttempts: 1
    });
    Object.assign(request, {
      sellerSubmissionAlertStatus: 'sent',
      sellerSubmissionAlertSentAt: sentAt,
      sellerSubmissionAlertProviderId: receipt.providerId,
      sellerSubmissionAlertAttempts: 1
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[MAIL] Request alert failed for ${request.requestId}:`, error);
    await ref.update({
      sellerSubmissionAlertStatus: 'failed',
      sellerSubmissionAlertError: message.slice(0, 500),
      sellerSubmissionAlertAttempts: 1
    }).catch(() => undefined);
    Object.assign(request, {
      sellerSubmissionAlertStatus: 'failed',
      sellerSubmissionAlertError: message.slice(0, 500),
      sellerSubmissionAlertAttempts: 1
    });
  }
  const {
    sellerSubmissionAlertStatus: _sellerSubmissionAlertStatus,
    sellerSubmissionAlertSentAt: _sellerSubmissionAlertSentAt,
    sellerSubmissionAlertProviderId: _sellerSubmissionAlertProviderId,
    sellerSubmissionAlertError: _sellerSubmissionAlertError,
    sellerSubmissionAlertAttempts: _sellerSubmissionAlertAttempts,
    ...publicRequest
  } = request;
  return publicRequest as CustomerRequest;
}

export async function recordOrderSubmissionAlert(
  orderId: string,
  result: { status: 'pending' | 'sent' | 'failed'; providerId?: string; error?: string; incrementAttempt?: boolean }
): Promise<void> {
  const ref = getFirestore().collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const current = snap.data() as Order;
  await ref.update({
    sellerSubmissionAlertStatus: result.status,
    sellerSubmissionAlertSentAt: result.status === 'sent' ? nowIso() : current.sellerSubmissionAlertSentAt || null,
    sellerSubmissionAlertProviderId: result.providerId || current.sellerSubmissionAlertProviderId || null,
    sellerSubmissionAlertError: result.error ? result.error.slice(0, 500) : null,
    sellerSubmissionAlertAttempts: (current.sellerSubmissionAlertAttempts || 0) + (result.incrementAttempt ? 1 : 0),
    lastUpdated: nowIso()
  });
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
