import { Firestore, Settings } from '@google-cloud/firestore';

/**
 * Firestore client, initialised from Application Default Credentials.
 *
 * On Cloud Run the runtime service account supplies these automatically: there
 * is no key file and no GOOGLE_SERVICE_ACCOUNT_* environment variable to set.
 * Those variables are obsolete and should be removed from the Cloud Run
 * service.
 *
 * Locally, `gcloud auth application-default login` provides the same thing, or
 * set FIRESTORE_EMULATOR_HOST to point at an emulator.
 */

export const COLLECTIONS = {
  categories: 'categories',
  products: 'products',
  bundles: 'bundles',
  services: 'services',
  laptops: 'laptops',
  licencePool: 'licencePool',
  orders: 'orders',
  requests: 'requests',
  announcements: 'announcements',
  reviews: 'reviews'
} as const;

let db: Firestore | null = null;

export function getFirestore(): Firestore {
  if (db) return db;

  const settings: Settings = {
    // Leave undefined outside GCP and let ADC resolve the project.
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || undefined,
    ignoreUndefinedProperties: true
  };

  if (process.env.FIRESTORE_DATABASE_ID) {
    settings.databaseId = process.env.FIRESTORE_DATABASE_ID;
  }

  db = new Firestore(settings);
  return db;
}

/** Firestore Timestamps and Dates both reach the API as ISO strings. */
export function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  const ts = value as { toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  return undefined;
}
