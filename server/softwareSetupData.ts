import { Firestore } from '@google-cloud/firestore';
import { Product, Variant } from '../shared/types';
import { reorderSoftwareVariants, saveVariantInProduct, validateSoftwareVariant } from '../shared/softwareSetup';
import { normalizeProductConfiguration } from './adminData';
import { COLLECTIONS, getFirestore } from './firestore';
import { invalidateCatalogueCache } from './catalogue';

/** Create-only write: an existing software ID can never be overwritten here. */
export async function createSoftwareProduct(input: Product, db: Firestore = getFirestore()): Promise<Product> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(input.productId || '')) throw new Error('Software ID must use letters, numbers, hyphens or underscores (up to 80 characters).');
  if (input.variants?.length) throw new Error('Save the software first, then use Add version.');
  const product = normalizeProductConfiguration(input.productId, { ...input, variants: [] });
  if (!product.categoryId) throw new Error('Category is required.');
  await db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.products).doc(product.productId);
    const [existing, category, orders] = await Promise.all([
      tx.get(ref), tx.get(db.collection(COLLECTIONS.categories).doc(product.categoryId)),
      tx.get(db.collection(COLLECTIONS.orders).where('productId', '==', product.productId).limit(1)),
    ]);
    if (existing.exists || !orders.empty) throw new Error('Software ID is already in use, including historical orders. Choose another ID.');
    if (!category.exists) throw new Error('Category not found.');
    tx.create(ref, product);
  });
  invalidateCatalogueCache();
  return product;
}

/** Append/edit against the current record, so adding a version keeps concurrent
 * changes, images and other versions. Historical IDs are never reassigned. */
export async function saveSoftwareVariant(productId: string, input: Variant, creating: boolean, db: Firestore = getFirestore()): Promise<Product> {
  validateSoftwareVariant(input);
  const product = await db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.products).doc(productId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Software not found.');
    const current = snap.data() as Product;
    if (creating) {
      const [products, orders, licences, bundles] = await Promise.all([
        tx.get(db.collection(COLLECTIONS.products)),
        tx.get(db.collection(COLLECTIONS.orders).where('variantId', '==', input.variantId).limit(1)),
        tx.get(db.collection(COLLECTIONS.licencePool).where('variantId', '==', input.variantId).limit(1)),
        tx.get(db.collection(COLLECTIONS.bundles)),
      ]);
      const used = products.docs.some(doc => (doc.data().variants || []).some((v: Variant) => v.variantId.toLowerCase() === input.variantId.toLowerCase())) ||
        bundles.docs.some(doc => (doc.data().items || []).some((item: { variantId?: string }) => item.variantId === input.variantId));
      if (used || !orders.empty || !licences.empty) throw new Error('Version ID is already used by software, orders, stock or a bundle. Choose a new permanent ID.');
    }
    const next = normalizeProductConfiguration(productId, saveVariantInProduct(current, input, creating));
    tx.update(ref, { variants: next.variants });
    return next;
  });
  invalidateCatalogueCache();
  return product;
}

export async function saveSoftwareVersionOrder(productId: string, orderedIds: unknown, expectedIds: unknown, db: Firestore = getFirestore()): Promise<Product> {
  const product = await db.runTransaction(async tx => {
    const ref = db.collection(COLLECTIONS.products).doc(productId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Software not found.');
    const next = reorderSoftwareVariants(snap.data() as Product, orderedIds, expectedIds);
    // Read fresh fields inside the transaction; only array position changes.
    tx.update(ref, { variants: next.variants });
    return next;
  });
  invalidateCatalogueCache();
  return product;
}
