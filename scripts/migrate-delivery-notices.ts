/** One-time, idempotent migration of the previous storefront's enabled notices. */
import { Firestore } from '@google-cloud/firestore';
import { Product, Service } from '../src/types';

const dryRun = process.argv.includes('--dry-run');
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw new Error('Set GOOGLE_CLOUD_PROJECT before running this migration.');
const db = new Firestore({ projectId, databaseId: process.env.FIRESTORE_DATABASE_ID || undefined });

const enabledVariantIds = new Set(['MXQ01', 'EV01']);
const products = await db.collection('products').get();
const batch = db.batch();

for (const document of products.docs) {
  const product = document.data() as Product;
  const variants = (product.variants || []).map((variant) => ({
    ...variant,
    showDeliveryNotice: variant.showDeliveryNotice ?? enabledVariantIds.has(variant.variantId)
  }));
  console.log(`${product.productName}: ${variants.filter((variant) => variant.showDeliveryNotice).map((variant) => variant.versionOrPlan).join(', ') || 'off'}`);
  batch.update(document.ref, { variants });
}

const turnitinRef = db.collection('services').doc('TURNITIN');
const turnitinSnapshot = await turnitinRef.get();
if (!turnitinSnapshot.exists) throw new Error('TURNITIN service was not found.');
const turnitin = turnitinSnapshot.data() as Service;
console.log(`${turnitin.name}: on`);
batch.update(turnitinRef, { showDeliveryNotice: true });

if (!dryRun) await batch.commit();
console.log(dryRun ? 'Dry run only; no documents changed.' : 'Delivery-notice settings migrated.');
