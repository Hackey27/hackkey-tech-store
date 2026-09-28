import { Transaction } from '@google-cloud/firestore';
import { COLLECTIONS, getFirestore } from './firestore';
import {
  Preorder,
  PreorderCategory,
  PreorderItem,
  PreorderPackage,
  PreorderPackageStatus,
  PreorderProduct,
} from '../shared/types';
import { combinationSlug, validatePreorderProduct } from '../shared/preorderCombinations';

/**
 * Every Firestore read and write the pre-order feature makes.
 *
 * Nothing else in this feature calls getFirestore(). That function is already
 * the most connected node in the codebase; routes, seeds and admin handlers
 * calling it directly would roughly double that, and the collection names would
 * end up spelled out in a dozen places.
 */

function now(): string {
  return new Date().toISOString();
}

/* -- categories ---------------------------------------------------------- */

export async function listPreorderCategories(): Promise<PreorderCategory[]> {
  const snapshot = await getFirestore().collection(COLLECTIONS.preorderCategories).get();
  return snapshot.docs
    .map((doc) => doc.data() as PreorderCategory)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

export async function savePreorderCategory(category: PreorderCategory): Promise<void> {
  await getFirestore()
    .collection(COLLECTIONS.preorderCategories)
    .doc(category.categoryId)
    .set({ ...category, parentId: category.parentId ?? null }, { merge: true });
}

/* -- products ------------------------------------------------------------ */

export async function listPreorderProducts(includeInactive = false): Promise<PreorderProduct[]> {
  const snapshot = await getFirestore().collection(COLLECTIONS.preorderProducts).get();
  return snapshot.docs
    .map((doc) => doc.data() as PreorderProduct)
    .filter((product) => includeInactive || product.active)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

export async function getPreorderProduct(productId: string): Promise<PreorderProduct | null> {
  const doc = await getFirestore().collection(COLLECTIONS.preorderProducts).doc(productId).get();
  return doc.exists ? (doc.data() as PreorderProduct) : null;
}

/**
 * Writes a product, refusing anything validatePreorderProduct calls an error.
 *
 * The check runs here rather than only in the admin UI because this is the last
 * point before the data becomes real: a duplicate selection saved by any route
 * makes the price of that selection ambiguous for every customer afterwards.
 * Warnings are returned rather than thrown — a deliberate gap in the variant
 * grid is legitimate.
 */
export async function savePreorderProduct(product: PreorderProduct): Promise<{ warnings: string[] }> {
  const withIds: PreorderProduct = {
    ...product,
    combinations: product.combinations.map((combination) => ({
      ...combination,
      combinationId:
        combination.combinationId || combinationSlug(combination.selections, product.variantAxes),
    })),
  };

  const { errors, warnings } = validatePreorderProduct(withIds);
  if (errors.length) {
    throw new Error(`Pre-order product ${withIds.productId} is not valid: ${errors.join(' ')}`);
  }

  await getFirestore()
    .collection(COLLECTIONS.preorderProducts)
    .doc(withIds.productId)
    .set(withIds, { merge: true });

  return { warnings };
}

/* -- pre-orders ---------------------------------------------------------- */

export async function createPreorder(preorder: Preorder): Promise<void> {
  await getFirestore()
    .collection(COLLECTIONS.preorders)
    .doc(preorder.preorderId)
    .create(preorder);
}

export async function getPreorder(preorderId: string): Promise<Preorder | null> {
  const doc = await getFirestore().collection(COLLECTIONS.preorders).doc(preorderId).get();
  return doc.exists ? (doc.data() as Preorder) : null;
}

export async function listPreorders(): Promise<Preorder[]> {
  const snapshot = await getFirestore()
    .collection(COLLECTIONS.preorders)
    .orderBy('submittedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => doc.data() as Preorder);
}

export async function recordPreorderAlert(
  preorderId: string,
  status: NonNullable<Preorder['sellerAlertStatus']>,
  error?: string
): Promise<void> {
  await getFirestore().collection(COLLECTIONS.preorders).doc(preorderId).set(
    {
      sellerAlertStatus: status,
      sellerAlertSentAt: status === 'sent' ? now() : undefined,
      sellerAlertError: error,
      lastUpdated: now(),
    },
    { merge: true }
  );
}

/** Sets one item's status, leaving the rest of the order alone. */
export async function setPreorderItemStatus(
  preorderId: string,
  itemId: string,
  status: PreorderItem['status']
): Promise<void> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.preorders).doc(preorderId);
  await db.runTransaction(async (transaction: Transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) throw new Error(`Pre-order ${preorderId} not found.`);
    const preorder = doc.data() as Preorder;
    const items = preorder.items.map((item) =>
      item.itemId === itemId ? { ...item, status } : item
    );
    transaction.set(ref, { items, lastUpdated: now() }, { merge: true });
  });
}

/* -- packages ------------------------------------------------------------ */

export async function listPreorderPackages(): Promise<PreorderPackage[]> {
  const snapshot = await getFirestore()
    .collection(COLLECTIONS.preorderPackages)
    .orderBy('createdAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => doc.data() as PreorderPackage);
}

export async function createPreorderPackage(pkg: PreorderPackage): Promise<void> {
  await getFirestore().collection(COLLECTIONS.preorderPackages).doc(pkg.packageId).create(pkg);
}

/**
 * Puts one item in a package.
 *
 * Refused once the package has left China: a box already with the shipper
 * cannot gain contents, and an item added afterwards would inherit a status
 * describing a journey it never made.
 */
export async function assignItemToPackage(
  preorderId: string,
  itemId: string,
  packageId: string
): Promise<void> {
  const db = getFirestore();
  const preorderRef = db.collection(COLLECTIONS.preorders).doc(preorderId);
  const packageRef = db.collection(COLLECTIONS.preorderPackages).doc(packageId);

  await db.runTransaction(async (transaction: Transaction) => {
    const [preorderDoc, packageDoc] = await transaction.getAll(preorderRef, packageRef);
    if (!preorderDoc.exists) throw new Error(`Pre-order ${preorderId} not found.`);
    if (!packageDoc.exists) throw new Error(`Package ${packageId} not found.`);

    const pkg = packageDoc.data() as PreorderPackage;
    if (pkg.closed || pkg.status !== 'delivered-in-china') {
      throw new Error(`Package ${packageId} has left China and is closed to new items.`);
    }

    const preorder = preorderDoc.data() as Preorder;
    const items = preorder.items.map((item) =>
      item.itemId === itemId ? { ...item, packageId, status: pkg.status } : item
    );
    transaction.set(preorderRef, { items, lastUpdated: now() }, { merge: true });
  });
}

/**
 * Moves a package on, cascading to every item inside it.
 *
 * One transaction over the package and every pre-order holding one of its
 * items. A partial write would leave some items claiming to be in Ghana and
 * others still with the shipper, with nothing to show which is right — and
 * nobody would notice until a customer asked where their order was.
 */
export async function setPackageStatus(
  packageId: string,
  status: PreorderPackageStatus
): Promise<{ itemsUpdated: number }> {
  const db = getFirestore();
  const packageRef = db.collection(COLLECTIONS.preorderPackages).doc(packageId);

  return db.runTransaction(async (transaction: Transaction) => {
    const packageDoc = await transaction.get(packageRef);
    if (!packageDoc.exists) throw new Error(`Package ${packageId} not found.`);

    // Read every pre-order inside the transaction, so an item added to this
    // package concurrently either lands before this read or retries after it.
    const preorderDocs = await transaction.get(db.collection(COLLECTIONS.preorders));

    let itemsUpdated = 0;
    const timestamp = now();

    for (const doc of preorderDocs.docs) {
      const preorder = doc.data() as Preorder;
      if (!preorder.items.some((item) => item.packageId === packageId)) continue;

      const items = preorder.items.map((item) => {
        if (item.packageId !== packageId) return item;
        itemsUpdated += 1;
        return { ...item, status };
      });
      transaction.set(doc.ref, { items, lastUpdated: timestamp }, { merge: true });
    }

    transaction.set(
      packageRef,
      {
        status,
        // Closed the moment it leaves China, in the same write that moves it.
        closed: status !== 'delivered-in-china',
        lastUpdated: timestamp,
      },
      { merge: true }
    );

    return { itemsUpdated };
  });
}
