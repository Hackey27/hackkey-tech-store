import { Firestore } from '@google-cloud/firestore';
import {
  Announcement,
  Bundle,
  Category,
  FulfilmentStatus,
  LicencePoolEntry,
  Order,
  Product,
  Service,
  Laptop,
  LandingSettings,
  CatalogueItemKind,
  CustomerRequest,
  PricingConfig,
  TurnitinReportDocument
} from '../src/types';
import { invalidateCatalogueCache } from './catalogue';
import { AdminActor } from './adminAuth';
import { LicenceImportRow, validateLicenceRows, validateServiceDefinition } from './adminValidation';
import { COLLECTIONS, getFirestore } from './firestore';
import {
  defaultCustomerInputType,
  defaultDeliveryCodeType,
  effectiveActivationWebsiteUrl
} from '../src/utils/softwareFulfilment';
import { getPricingConfig, persistPricingConfig } from './pricingConfig';
import { resolvedDeliveryNotice } from './deliveryNotice';
import { newestOrderFirst } from '../src/utils/orderSorting';
import { getPaymentSettings } from './paymentSettings';

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export interface VariantSummary {
  variantId: string;
  productName: string;
  versionOrPlan: string;
}

export interface MaskedLicence extends Omit<LicencePoolEntry, 'licenceCode'> {
  maskedCode: string;
  integrityWarning?: string;
}

function maskCode(code: string): string {
  const tail = code.slice(-4);
  return `••••••••${tail ? ` ${tail}` : ''}`;
}

function maskOrder(order: Order): Order {
  const { customerAccessTokenHashes: _customerAccessTokenHashes, ...safe } = order;
  return order.activationCodeOrKey
    ? { ...safe, activationCodeOrKey: maskCode(order.activationCodeOrKey) } as Order
    : safe as Order;
}

export async function listVariantSummaries(): Promise<VariantSummary[]> {
  const snapshot = await getFirestore().collection(COLLECTIONS.products).get();
  return snapshot.docs
    .flatMap((doc) => {
      const product = doc.data() as Product;
      return (product.variants || []).map((variant) => ({
        variantId: variant.variantId,
        productName: product.productName,
        versionOrPlan: variant.versionOrPlan
      }));
    })
    .sort((a, b) => `${a.productName} ${a.versionOrPlan}`.localeCompare(`${b.productName} ${b.versionOrPlan}`));
}

export async function adminBootstrap() {
  const db = getFirestore();
  const [ordersSnap, requestsSnap, licencesSnap, servicesSnap, announcementsSnap, productsSnap, bundlesSnap, laptopsSnap, categoriesSnap, landingSnap, variants, pricing, payments] = await Promise.all([
    db.collection(COLLECTIONS.orders).get(),
    db.collection(COLLECTIONS.requests).get(),
    db.collection(COLLECTIONS.licencePool).get(),
    db.collection(COLLECTIONS.services).get(),
    db.collection(COLLECTIONS.announcements).get(),
    db.collection(COLLECTIONS.products).get(),
    db.collection(COLLECTIONS.bundles).get(),
    db.collection(COLLECTIONS.laptops).get(),
    db.collection(COLLECTIONS.categories).get(),
    db.collection(COLLECTIONS.storeSettings).doc('landing').get(),
    listVariantSummaries(),
    getPricingConfig(),
    getPaymentSettings()
  ]);

  const orders = ordersSnap.docs
    .map((doc) => maskOrder(doc.data() as Order))
    .sort(newestOrderFirst);
  const requests = requestsSnap.docs
    .map((doc) => doc.data() as CustomerRequest)
    .sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
  const licences: MaskedLicence[] = licencesSnap.docs.map((doc) => {
    const entry = doc.data() as LicencePoolEntry;
    return {
      licenceId: entry.licenceId || doc.id,
      variantId: entry.variantId,
      maskedCode: maskCode(entry.licenceCode || ''),
      codeType: entry.codeType,
      status: entry.status,
      assignedOrderId: entry.assignedOrderId,
      dateAdded: entry.dateAdded,
      dateAssigned: entry.dateAssigned,
      notes: entry.notes,
      integrityWarning:
        entry.status === 'assigned' && !entry.licenceId
          ? 'Assigned row has a blank licence id.'
          : !entry.licenceCode
            ? 'Licence row has a blank key.'
            : undefined
    };
  });
  const services = servicesSnap.docs.map((doc) => doc.data() as Service);
  const announcements = announcementsSnap.docs
    .map((doc) => doc.data() as Announcement)
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
  const products = productsSnap.docs
    .map((doc) => {
      const product = doc.data() as Product;
      return { ...product, variants: (product.variants || []).map((variant) => ({ ...variant, customerInputRequired: variant.customerInputRequired || defaultCustomerInputType(product.productId), deliveryCodeType: variant.deliveryCodeType || defaultDeliveryCodeType(product.productId), activationWebsiteUrl: effectiveActivationWebsiteUrl(variant), showDeliveryNotice: resolvedDeliveryNotice(variant) })) };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName));

  const bundles = bundlesSnap.docs.map((doc) => doc.data() as Bundle).sort((a, b) => a.name.localeCompare(b.name));
  const laptops = laptopsSnap.docs.map((doc) => doc.data() as Laptop);
  const categories = categoriesSnap.docs.map((doc) => doc.data() as Category);
  const mediaItems = [
    ...products.map((item) => ({ kind: 'product' as const, itemId: item.productId, name: item.productName, categoryId: item.categoryId, imageUrl: item.imageUrl, imagePath: item.imagePath, cardImagePath: item.cardImagePath, bannerImagePath: item.bannerImagePath, mobileBannerImagePath: item.mobileBannerImagePath, screenshots: item.screenshots, sortOrder: item.sortOrder, featuredOrder: item.featuredOrder })),
    ...bundles.map((item) => ({ kind: 'bundle' as const, itemId: item.bundleId, name: item.name, categoryId: item.categoryId, imagePath: item.imagePath, cardImagePath: item.cardImagePath, bannerImagePath: item.bannerImagePath, mobileBannerImagePath: item.mobileBannerImagePath, screenshots: item.screenshots, sortOrder: item.sortOrder })),
    ...services.map((item) => ({ kind: 'service' as const, itemId: item.serviceId, name: item.name, categoryId: item.categoryId, imagePath: item.imagePath, cardImagePath: item.cardImagePath, bannerImagePath: item.bannerImagePath, mobileBannerImagePath: item.mobileBannerImagePath, screenshots: item.screenshots, sortOrder: item.sortOrder })),
    ...laptops.map((item) => ({ kind: 'laptop' as const, itemId: item.laptopId, name: item.title, categoryId: item.categoryId, imageUrl: item.picturesUrl?.[0], imagePath: item.imagePath, cardImagePath: item.cardImagePath, bannerImagePath: item.bannerImagePath, mobileBannerImagePath: item.mobileBannerImagePath, screenshots: item.screenshots, sortOrder: item.sortOrder })),
    ...categories.map((item) => ({ kind: 'category' as const, itemId: item.categoryId, name: item.name, imagePath: item.imagePath, iconImagePath: item.iconImagePath, sortOrder: item.sortOrder }))
  ].sort((a, b) => a.name.localeCompare(b.name));

  return { orders, requests, licences, services, announcements, products, bundles, laptops, variants, mediaItems, categories, landing: landingSnap.exists ? landingSnap.data() as LandingSettings : {}, pricing, payments };
}

export async function savePricingConfiguration(input: Partial<PricingConfig>): Promise<PricingConfig> {
  const pricing = await persistPricingConfig(input);
  invalidateCatalogueCache();
  return pricing;
}

const mediaCollection: Record<CatalogueItemKind | 'category', string> = {
  product: COLLECTIONS.products,
  bundle: COLLECTIONS.bundles,
  service: COLLECTIONS.services,
  laptop: COLLECTIONS.laptops,
  category: COLLECTIONS.categories
};

export async function updateCatalogueMedia(
  kind: CatalogueItemKind | 'category',
  itemId: string,
  change: { role: 'icon' | 'card' | 'banner' | 'mobile-banner' | 'gallery' | 'remove'; objectPath: string }
) {
  const ref = getFirestore().collection(mediaCollection[kind]).doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Catalogue item not found.');
  const current = snap.data() as { imagePath?: string; cardImagePath?: string; iconImagePath?: string; bannerImagePath?: string; mobileBannerImagePath?: string; screenshots?: string[] };
  let patch: Record<string, unknown> = {};
  let replacedPath: string | undefined;
  if (change.role === 'icon') {
    const field = kind === 'category' ? 'iconImagePath' : 'imagePath';
    replacedPath = current[field]?.startsWith('catalogue/') ? current[field] : undefined;
    patch = { [field]: change.objectPath };
  } else if (change.role === 'card') {
    const field = kind === 'category' ? 'imagePath' : 'cardImagePath';
    replacedPath = current[field]?.startsWith('catalogue/') ? current[field] : undefined;
    patch = { [field]: change.objectPath };
  } else if (change.role === 'banner') {
    replacedPath = current.bannerImagePath?.startsWith('catalogue/') ? current.bannerImagePath : undefined;
    patch = { bannerImagePath: change.objectPath };
  } else if (change.role === 'mobile-banner') {
    replacedPath = current.mobileBannerImagePath?.startsWith('catalogue/') ? current.mobileBannerImagePath : undefined;
    patch = { mobileBannerImagePath: change.objectPath };
  } else if (change.role === 'gallery') {
    const screenshots = [...new Set([...(current.screenshots || []), change.objectPath])];
    if (screenshots.length > 12) throw new Error('An item can have up to 12 gallery images.');
    patch = { screenshots };
  } else {
    patch = {
      imagePath: current.imagePath === change.objectPath ? '' : current.imagePath,
      cardImagePath: current.cardImagePath === change.objectPath ? '' : current.cardImagePath,
      iconImagePath: current.iconImagePath === change.objectPath ? '' : current.iconImagePath,
      bannerImagePath: current.bannerImagePath === change.objectPath ? '' : current.bannerImagePath,
      mobileBannerImagePath: current.mobileBannerImagePath === change.objectPath ? '' : current.mobileBannerImagePath,
      screenshots: (current.screenshots || []).filter((value) => value !== change.objectPath)
    };
  }
  await ref.update(patch);
  invalidateCatalogueCache();
  return { item: { ...current, ...patch }, replacedPath };
}

export async function updateLandingImage(role: 'desktop' | 'mobile' | 'remove', objectPath: string) {
  const ref = getFirestore().collection(COLLECTIONS.storeSettings).doc('landing');
  const snap = await ref.get();
  const current = (snap.data() || {}) as LandingSettings;
  const field = role === 'mobile' ? 'mobileImagePath' : 'desktopImagePath';
  const replacedPath = role === 'remove'
    ? undefined
    : current[field]?.startsWith('catalogue/') ? current[field] : undefined;
  const patch = role === 'remove'
    ? { desktopImagePath: current.desktopImagePath === objectPath ? '' : current.desktopImagePath, mobileImagePath: current.mobileImagePath === objectPath ? '' : current.mobileImagePath }
    : { [field]: objectPath };
  await ref.set(patch, { merge: true });
  invalidateCatalogueCache();
  return { landing: { ...current, ...patch }, replacedPath };
}

export async function updateCatalogueOrder(updates: Array<{ kind: CatalogueItemKind; itemId: string; sortOrder: number; featuredOrder?: number | null }>) {
  const db = getFirestore();
  const batch = db.batch();
  updates.forEach((entry) => {
    const patch: Record<string, unknown> = { sortOrder: Math.max(0, Math.floor(entry.sortOrder || 0)) };
    if (entry.kind === 'product') patch.featuredOrder = entry.featuredOrder == null ? null : Math.max(0, Math.floor(entry.featuredOrder));
    batch.update(db.collection(mediaCollection[entry.kind]).doc(entry.itemId), patch);
  });
  await batch.commit();
  invalidateCatalogueCache();
}

export async function updateProductImages(
  productId: string,
  change:
    | { role: 'banner'; objectPath: string }
    | { role: 'gallery'; objectPath: string }
    | { role: 'remove'; objectPath: string }
): Promise<{ product: Product; replacedPath?: string }> {
  const ref = getFirestore().collection(COLLECTIONS.products).doc(productId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Product not found.');
  const product = snap.data() as Product;
  let patch: Partial<Product>;
  let replacedPath: string | undefined;

  if (change.role === 'banner') {
    replacedPath = product.bannerImagePath?.startsWith('catalogue/') ? product.bannerImagePath : undefined;
    patch = { bannerImagePath: change.objectPath };
  } else if (change.role === 'gallery') {
    const screenshots = [...new Set([...(product.screenshots || []), change.objectPath])];
    if (screenshots.length > 12) throw new Error('A product can have up to 12 gallery images.');
    patch = { screenshots };
  } else {
    patch = {
      bannerImagePath: product.bannerImagePath === change.objectPath ? '' : product.bannerImagePath,
      screenshots: (product.screenshots || []).filter((image) => image !== change.objectPath)
    };
  }

  await ref.update(patch);
  invalidateCatalogueCache();
  return { product: { ...product, ...patch }, replacedPath };
}

export async function revealLicence(licenceId: string): Promise<LicencePoolEntry | null> {
  const snap = await getFirestore().collection(COLLECTIONS.licencePool).doc(licenceId).get();
  return snap.exists ? (snap.data() as LicencePoolEntry) : null;
}

export async function importLicences(rows: LicenceImportRow[]) {
  const db = getFirestore();
  const [variants, existingSnap] = await Promise.all([
    listVariantSummaries(),
    db.collection(COLLECTIONS.licencePool).get()
  ]);
  const errors = validateLicenceRows(
    rows,
    new Set(variants.map((variant) => variant.variantId)),
    new Set(existingSnap.docs.map((doc) => String((doc.data() as LicencePoolEntry).licenceCode || '').trim()))
  );
  if (errors.length) return { imported: 0, errors };

  const batch = db.batch();
  const created: LicencePoolEntry[] = rows.map((row) => ({
    licenceId: id('LIC'),
    variantId: row.variantId.trim(),
    licenceCode: row.licenceCode.trim(),
    codeType: row.codeType?.trim() || undefined,
    notes: row.notes?.trim() || undefined,
    status: 'available',
    dateAdded: now()
  }));
  created.forEach((entry) => {
    batch.create(db.collection(COLLECTIONS.licencePool).doc(entry.licenceId), entry);
  });
  await batch.commit();
  return { imported: created.length, errors: [], licenceIds: created.map((entry) => entry.licenceId) };
}

function nextStatusAfterLicence(order: Order): FulfilmentStatus {
  return order.customerInputType && !order.customerInputValue ? 'awaiting-customer-input' : 'ready';
}

export async function assignLicence(
  orderId: string,
  input: { licenceId?: string; manualKey?: string; codeType?: string },
  actor: AdminActor
): Promise<Order> {
  const db: Firestore = getFirestore();
  const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);

  return db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error('Order not found.');
    const order = orderSnap.data() as Order;
    if (order.paymentStatus !== 'paid') throw new Error('A licence can only be assigned to a paid order.');
    if (order.licenceId) throw new Error('This order already has a licence.');

    let licenceRef;
    let licence: LicencePoolEntry;
    const manualKey = input.manualKey?.trim();

    if (manualKey) {
      const duplicate = await tx.get(
        db.collection(COLLECTIONS.licencePool).where('licenceCode', '==', manualKey).limit(1)
      );
      if (!duplicate.empty) throw new Error('That licence key already exists in stock.');
      licence = {
        licenceId: id('LIC-MANUAL'),
        variantId: order.variantId,
        licenceCode: manualKey,
        codeType: input.codeType?.trim() || undefined,
        status: 'assigned',
        assignedOrderId: order.orderId,
        dateAdded: now(),
        dateAssigned: now(),
        notes: 'Added during manual order assignment.'
      };
      licenceRef = db.collection(COLLECTIONS.licencePool).doc(licence.licenceId);
    } else {
      const licenceSnap = input.licenceId
        ? await tx.get(db.collection(COLLECTIONS.licencePool).doc(input.licenceId))
        : await tx.get(
            db
              .collection(COLLECTIONS.licencePool)
              .where('variantId', '==', order.variantId)
              .where('status', '==', 'available')
              .limit(1)
          );
      const doc = 'docs' in licenceSnap ? licenceSnap.docs[0] : licenceSnap;
      if (!doc?.exists) throw new Error(`No available licence for ${order.variantId}.`);
      licence = doc.data() as LicencePoolEntry;
      if (licence.status !== 'available' || licence.variantId !== order.variantId) {
        throw new Error('That licence is no longer available for this order.');
      }
      licenceRef = doc.ref;
    }

    const status = nextStatusAfterLicence(order);
    const at = now();
    const updated: Order = {
      ...order,
      licenceId: licence.licenceId,
      activationCodeOrKey: licence.licenceCode,
      fulfilmentStatus: status,
      fulfilledAt: status === 'ready' ? at : order.fulfilledAt,
      licenceIssueNote: undefined,
      lastUpdated: at,
      fulfilmentHistory: [
        ...(order.fulfilmentHistory || []),
        { status, at, actorUid: actor.uid, note: 'Licence assigned by administrator.' }
      ]
    };

    if (manualKey) tx.create(licenceRef, licence);
    else {
      tx.update(licenceRef, {
        status: 'assigned',
        assignedOrderId: order.orderId,
        dateAssigned: at
      });
    }
    tx.update(orderRef, updated);
    return updated;
  });
}

export async function assignSalesCode(
  orderId: string,
  input: { licenceId?: string },
  actor: AdminActor
): Promise<Order> {
  const db: Firestore = getFirestore();
  const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
  return db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error('Order not found.');
    const order = orderSnap.data() as Order;
    if (order.paymentStatus !== 'paid') throw new Error('A Sales ID can only be assigned to a paid order.');
    if (order.salesCode) throw new Error('This order already has a Sales ID.');
    const licenceSnap = input.licenceId
      ? await tx.get(db.collection(COLLECTIONS.licencePool).doc(input.licenceId))
      : await tx.get(db.collection(COLLECTIONS.licencePool).where('variantId', '==', order.variantId).where('status', '==', 'available').limit(1));
    const doc = 'docs' in licenceSnap ? licenceSnap.docs[0] : licenceSnap;
    if (!doc?.exists) throw new Error(`No available Sales ID for ${order.variantId}.`);
    const licence = doc.data() as LicencePoolEntry;
    if (licence.status !== 'available' || licence.variantId !== order.variantId) {
      throw new Error('That Sales ID is no longer available for this order.');
    }
    const customerInputType = order.customerInputType || defaultCustomerInputType(order.productId);
    const status: FulfilmentStatus = customerInputType && !order.customerInputValue
      ? 'awaiting-customer-input'
      : 'awaiting-seller-activation';
    const at = now();
    const updated: Order = {
      ...order,
      customerInputType,
      deliveryCodeType: 'sales-code',
      licenceId: licence.licenceId,
      salesCode: licence.licenceCode,
      fulfilmentStatus: status,
      lastUpdated: at,
      fulfilmentHistory: [...(order.fulfilmentHistory || []), { status, at, actorUid: actor.uid, note: 'Sales ID assigned from stock by administrator.' }]
    };
    tx.update(doc.ref, { status: 'assigned', assignedOrderId: order.orderId, dateAssigned: at });
    tx.update(orderRef, updated);
    return updated;
  });
}

export async function markDocumentReceived(orderId: string, actor: AdminActor): Promise<Order> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Order not found.');
  const order = snap.data() as Order;
  if (order.paymentStatus !== 'paid') throw new Error('The order is not paid.');
  if (order.fulfilmentStatus !== 'awaiting-document') throw new Error('This order is not awaiting a document.');
  const at = now();
  const patch: Partial<Order> = {
    documentSubmissionMethod: 'whatsapp',
    documentReceivedAt: at,
    fulfilmentStatus: 'awaiting-seller-activation',
    lastUpdated: at,
    fulfilmentHistory: [
      ...(order.fulfilmentHistory || []),
      { status: 'awaiting-seller-activation', at, actorUid: actor.uid, note: 'Document received outside the portal.' }
    ]
  };
  await ref.update(patch);
  return { ...order, ...patch } as Order;
}

export function turnitinReportReadyPatch(
  order: Order,
  report: TurnitinReportDocument,
  actor: AdminActor,
  uploadedAt: string
): Partial<Order> {
  return {
    reportDocuments: [...(order.reportDocuments || []), report],
    fulfilmentStatus: 'ready',
    fulfilledAt: uploadedAt,
    lastUpdated: uploadedAt,
    fulfilmentHistory: [
      ...(order.fulfilmentHistory || []),
      { status: 'ready', at: uploadedAt, actorUid: actor.uid, note: 'Turnitin report uploaded and order marked ready.' }
    ],
    internalNotes: [
      ...(order.internalNotes || []),
      { text: `Uploaded Turnitin report: ${report.label}`, actorUid: actor.uid, actorEmail: actor.email, createdAt: uploadedAt }
    ]
  };
}

export async function addTurnitinReport(
  orderId: string,
  input: { storagePath: string; originalName: string; label: string; sizeBytes?: number },
  actor: AdminActor
): Promise<Order> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Order not found.');
  const order = snap.data() as Order;
  if (order.paymentStatus !== 'paid') throw new Error('The order is not paid.');
  if (order.productId !== 'TURNITIN' && order.variantId !== 'TURNITIN') throw new Error('Reports can only be attached to Turnitin orders.');
  const uploadedAt = now();
  const report: TurnitinReportDocument = {
    reportId: id('REP'),
    label: input.label,
    originalName: input.originalName,
    storagePath: input.storagePath,
    sizeBytes: input.sizeBytes,
    uploadedAt
  };
  const patch = turnitinReportReadyPatch(order, report, actor, uploadedAt);
  await ref.update(patch);
  return { ...order, ...patch } as Order;
}

export async function markFulfilled(
  orderId: string,
  input: { activationCodeOrKey?: string; note?: string },
  actor: AdminActor
): Promise<Order> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Order not found.');
  const order = snap.data() as Order;
  if (order.paymentStatus !== 'paid') throw new Error('The order is not paid.');
  const at = now();
  const patch: Partial<Order> = {
    fulfilmentStatus: 'ready',
    activationCodeOrKey: input.activationCodeOrKey?.trim() || order.activationCodeOrKey,
    fulfilledAt: at,
    lastUpdated: at,
    fulfilmentHistory: [
      ...(order.fulfilmentHistory || []),
      { status: 'ready', at, actorUid: actor.uid, note: input.note?.trim() || 'Marked fulfilled.' }
    ]
  };
  await ref.update(patch);
  return { ...order, ...patch } as Order;
}

export async function addInternalNote(orderId: string, text: string, actor: AdminActor): Promise<Order> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Order not found.');
  const order = snap.data() as Order;
  const note = { text: text.trim(), actorUid: actor.uid, actorEmail: actor.email, createdAt: now() };
  const patch: Partial<Order> = { internalNotes: [...(order.internalNotes || []), note], lastUpdated: now() };
  await ref.update(patch);
  return { ...order, ...patch } as Order;
}

const fulfilmentStatuses: FulfilmentStatus[] = [
  'pending-payment', 'awaiting-customer-input', 'awaiting-document',
  'awaiting-licence', 'awaiting-seller-activation', 'ready'
];

export function assertWorkflowPaymentTransition(current: Order['paymentStatus'], requested?: Order['paymentStatus']): void {
  if (requested === 'paid' && current !== 'paid') {
    throw new Error('Use Record offline payment with the MoMo transaction reference. Payment status cannot be set directly.');
  }
}

/** Admin-only editor for the stepwise order workflow. */
export async function updateOrderWorkflow(
  orderId: string,
  input: Partial<Pick<Order,
    'paymentStatus' | 'fulfilmentStatus' | 'amountPesewas' | 'customerInputType' |
    'customerInputValue' | 'salesCode' | 'activationCodeOrKey'>>,
  actor: AdminActor
): Promise<Order> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Order not found.');
  const order = snap.data() as Order;
  assertWorkflowPaymentTransition(order.paymentStatus, input.paymentStatus);
  if (input.paymentStatus && !['pending', 'paid'].includes(input.paymentStatus)) throw new Error('Invalid payment status.');
  if (input.fulfilmentStatus && !fulfilmentStatuses.includes(input.fulfilmentStatus)) throw new Error('Invalid fulfilment status.');
  if (input.amountPesewas !== undefined && (!Number.isInteger(input.amountPesewas) || input.amountPesewas <= 0)) {
    throw new Error('The adjusted price must be greater than zero.');
  }
  const clean = (value: unknown) => typeof value === 'string' ? value.trim() : value;
  const patch: Partial<Order> = { lastUpdated: now() };
  if (input.paymentStatus !== undefined) patch.paymentStatus = input.paymentStatus;
  if (input.fulfilmentStatus !== undefined) patch.fulfilmentStatus = input.fulfilmentStatus;
  if (input.amountPesewas !== undefined) patch.amountPesewas = input.amountPesewas;
  if (input.customerInputType !== undefined) patch.customerInputType = input.customerInputType;
  if (input.customerInputValue !== undefined) patch.customerInputValue = clean(input.customerInputValue) as string;
  if (input.salesCode !== undefined) patch.salesCode = clean(input.salesCode) as string;
  // Admin order responses mask saved licence codes. A blank field means keep
  // the existing secret; only a newly entered value replaces it.
  if (String(input.activationCodeOrKey || '').trim()) patch.activationCodeOrKey = clean(input.activationCodeOrKey) as string;
  if (input.fulfilmentStatus && input.fulfilmentStatus !== order.fulfilmentStatus) {
    patch.fulfilmentHistory = [
      ...(order.fulfilmentHistory || []),
      { status: input.fulfilmentStatus, at: now(), actorUid: actor.uid, note: 'Status set by administrator.' }
    ];
    if (input.fulfilmentStatus === 'ready') patch.fulfilledAt = now();
  }
  await ref.update(patch);
  return { ...order, ...patch } as Order;
}

export async function deleteUnpaidOrder(orderId: string): Promise<void> {
  const ref = getFirestore().collection(COLLECTIONS.orders).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Order not found.');
  const order = snap.data() as Order;
  if (order.paymentStatus === 'paid') throw new Error('Paid orders cannot be deleted.');
  await ref.delete();
}

export async function saveProductConfiguration(productId: string, input: Product): Promise<Product> {
  if (!input.productName?.trim()) throw new Error('Product name is required.');
  const product: Product = {
    ...input,
    productId,
    productName: input.productName.trim(),
    licenceTerm: input.licenceTerm?.trim() || undefined,
    variants: (input.variants || []).map((variant) => ({
      ...variant,
      customerInputRequired: variant.customerInputRequired?.trim() || undefined,
      activationWebsiteUrl: variant.activationWebsiteUrl?.trim() || undefined,
      activationLink: variant.activationWebsiteUrl?.trim() || variant.activationLink?.trim() || undefined,
      windowsInstallerUrl: variant.windowsInstallerUrl?.trim() || undefined,
      parallelsInstallerUrl: variant.parallelsInstallerUrl?.trim() || undefined,
      windows11DownloadUrl: variant.windows11DownloadUrl?.trim() || undefined,
      guideUrl: variant.guideUrl?.trim() || undefined,
      learningResourcesUrl: variant.learningResourcesUrl?.trim() || undefined,
      deliveryCodeType: variant.deliveryCodeType || 'licence'
    }))
  };
  await getFirestore().collection(COLLECTIONS.products).doc(productId).set(product);
  invalidateCatalogueCache();
  return product;
}

export async function saveCategory(categoryId: string, input: Category): Promise<Category> {
  if (!input.name?.trim()) throw new Error('Category name is required.');
  const category: Category = {
    ...input,
    categoryId,
    name: input.name.trim(),
    tagline: input.tagline?.trim() || '',
    icon: input.icon?.trim() || '',
    active: input.active !== false,
    sortOrder: Number.isFinite(input.sortOrder) ? Math.max(0, Math.floor(input.sortOrder)) : 100
  };
  await getFirestore().collection(COLLECTIONS.categories).doc(categoryId).set(category, { merge: true });
  invalidateCatalogueCache();
  return category;
}

export async function saveBundle(bundleId: string, input: Bundle): Promise<Bundle> {
  if (!input.name?.trim()) throw new Error('Bundle name is required.');
  const bundle: Bundle = {
    ...input,
    bundleId,
    name: input.name.trim(),
    description: input.description?.trim() || '',
    priceGhs: Math.max(0, Number(input.priceGhs) || 0),
    categoryId: input.categoryId || 'BUNDLE',
    active: input.active !== false,
    sortOrder: Number.isFinite(input.sortOrder) ? Math.max(0, Math.floor(input.sortOrder)) : 100,
    items: input.items || []
  };
  await getFirestore().collection(COLLECTIONS.bundles).doc(bundleId).set(bundle, { merge: true });
  invalidateCatalogueCache();
  return bundle;
}

export async function saveLaptop(laptopId: string, input: Laptop): Promise<Laptop> {
  if (!input.title?.trim() || !input.brand?.trim() || !input.model?.trim()) {
    throw new Error('Laptop name, brand and model are required.');
  }
  const laptop: Laptop = {
    ...input,
    laptopId,
    title: input.title.trim(),
    availability: input.availability === 'Pre-order' || input.availability === 'Preorder' ? 'Pre-order' : 'Available',
    categoryId: input.categoryId || 'LAPTOP',
    picturesUrl: input.picturesUrl || [],
    active: input.active !== false,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 100
  };
  await getFirestore().collection(COLLECTIONS.laptops).doc(laptopId).set(laptop);
  invalidateCatalogueCache();
  return laptop;
}

export async function saveService(service: Service): Promise<Service> {
  const errors = validateServiceDefinition(service);
  if (errors.length) {
    const error = new Error('Service validation failed.') as Error & { validationErrors?: typeof errors };
    error.validationErrors = errors;
    throw error;
  }
  const clean: Service = {
    ...service,
    serviceId: service.serviceId.trim(),
    name: service.name.trim(),
    tagline: service.tagline?.trim() || service.name.trim(),
    description: service.description?.trim() || service.tagline?.trim() || service.name.trim(),
    fields: service.fields || [],
    options: service.options?.length ? service.options : undefined,
    minQty: service.options?.length ? service.minQty ?? 1 : undefined,
    maxQty: service.options?.length ? service.maxQty ?? 50 : undefined
  };
  await getFirestore().collection(COLLECTIONS.services).doc(clean.serviceId).set(clean);
  invalidateCatalogueCache();
  return clean;
}

export async function saveAnnouncement(input: Announcement): Promise<Announcement> {
  if (!input.title?.trim() || !input.message?.trim()) throw new Error('Title and message are required.');
  if ((input.buttonText && !input.buttonUrl) || (input.buttonUrl && !input.buttonText)) {
    throw new Error('Button text and URL must be supplied together.');
  }
  if (input.buttonUrl) {
    const url = new URL(input.buttonUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Button URL must use HTTP or HTTPS.');
  }
  if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) {
    throw new Error('The end time must be after the start time.');
  }
  const at = now();
  const announcement: Announcement = {
    ...input,
    announcementId: input.announcementId || id('ANN'),
    title: input.title.trim(),
    message: input.message.trim(),
    buttonText: input.buttonText?.trim() || undefined,
    buttonUrl: input.buttonUrl?.trim() || undefined,
    createdAt: input.createdAt || at,
    updatedAt: at
  };
  await getFirestore().collection(COLLECTIONS.announcements).doc(announcement.announcementId).set(announcement);
  invalidateCatalogueCache();
  return announcement;
}
