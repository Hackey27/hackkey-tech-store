import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { ServiceField } from '../src/types';

/**
 * Customer document uploads.
 *
 * These are unpublished academic documents, so three rules hold throughout:
 *
 * 1. An upload is only ever issued against an existing **paid** order. The
 *    browser never holds broad write access — it gets a short-lived signed URL
 *    for one object. Without this the bucket is an open drop box for anyone who
 *    finds the endpoint.
 * 2. The size and type limits are enforced here before authorization and are
 *    verified again against the stored object. Client checks are convenience,
 *    never the security control.
 * 3. Retrieval is server-mediated through a signed download URL. `storage.rules`
 *    denies all client access, matching Firestore.
 */

const configuredUploadMb = Number(process.env.MAX_DOCUMENT_UPLOAD_MB || 20);
export const MAX_UPLOAD_BYTES = Math.max(1, Number.isFinite(configuredUploadMb) ? configuredUploadMb : 20) * 1024 * 1024;
export const MAX_CATALOGUE_IMAGE_BYTES = 2 * 1024 * 1024; // resized browser output

/** PDF, DOC and DOCX only. */
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

export const ALLOWED_CATALOGUE_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const UPLOAD_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DOWNLOAD_URL_TTL_MS = 10 * 60 * 1000;

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined
    });
  }
  return storage;
}

export function validateCatalogueImage(contentType: string, sizeBytes: number): UploadValidation {
  if (!ALLOWED_CATALOGUE_IMAGE_TYPES[contentType]) {
    return { ok: false, error: 'Use a JPEG, PNG, WebP, or GIF image.' };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: 'The image is empty.' };
  }
  if (sizeBytes > MAX_CATALOGUE_IMAGE_BYTES) {
    return { ok: false, error: 'The resized image must be 2 MB or smaller.' };
  }
  return { ok: true };
}

function safeProductId(productId: string): string {
  return productId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'product';
}

export function catalogueImageObjectPath(
  productId: string,
  role: 'icon' | 'banner' | 'mobile-banner' | 'gallery' | 'desktop' | 'mobile' | 'card',
  contentType: string
): string {
  const extension = ALLOWED_CATALOGUE_IMAGE_TYPES[contentType] || 'bin';
  return `catalogue/${safeProductId(productId)}/${role}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export function isCatalogueImagePath(objectPath: string): boolean {
  return objectPath.startsWith('catalogue/') && !objectPath.includes('..');
}

export async function saveCatalogueImage(
  objectPath: string,
  bytes: Buffer,
  contentType: string
): Promise<void> {
  if (!isCatalogueImagePath(objectPath)) throw new Error('Invalid catalogue image path.');
  const validation = validateCatalogueImage(contentType, bytes.length);
  if (!validation.ok) throw new Error(validation.error);
  await getStorage().bucket(bucketName()).file(objectPath).save(bytes, {
    resumable: false,
    contentType,
    metadata: { cacheControl: 'public, max-age=31536000, immutable' }
  });
}

export async function deleteCatalogueImage(objectPath: string): Promise<void> {
  if (!isCatalogueImagePath(objectPath)) throw new Error('Invalid catalogue image path.');
  await getStorage().bucket(bucketName()).file(objectPath).delete({ ignoreNotFound: true });
}

export async function catalogueImageFile(objectPath: string) {
  if (!isCatalogueImagePath(objectPath)) throw new Error('Invalid catalogue image path.');
  const file = getStorage().bucket(bucketName()).file(objectPath);
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType || 'application/octet-stream');
  if (!ALLOWED_CATALOGUE_IMAGE_TYPES[contentType]) throw new Error('Stored object is not a catalogue image.');
  return { file, contentType };
}

/** Defaults to the project's own bucket; override for a dedicated one. */
export function bucketName(): string {
  const explicit = process.env.DOCUMENTS_BUCKET;
  if (explicit) return explicit;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error(
      'Set DOCUMENTS_BUCKET (or GOOGLE_CLOUD_PROJECT) so uploads have a destination.'
    );
  }
  return `${project}.appspot.com`;
}

export interface UploadValidation {
  ok: boolean;
  error?: string;
}

/**
 * Validate an upload request before any URL is issued.
 *
 * Size and type are checked before authorization and then checked again from
 * the stored object's metadata after upload. The signed URL is bound to the
 * requested content type.
 */
export function validateUpload(contentType: string, sizeBytes: number): UploadValidation {
  if (!ALLOWED_UPLOAD_TYPES[contentType]) {
    return {
      ok: false,
      error: 'Only PDF and Word documents (.pdf, .doc, .docx) can be uploaded.'
    };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: 'A file size is required.' };
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `That file is larger than the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit.` };
  }
  return { ok: true };
}

/** Objects are namespaced by order, so one customer's path is not another's. */
export function documentObjectPath(orderId: string, contentType: string, randomId = crypto.randomUUID()): string {
  const extension = ALLOWED_UPLOAD_TYPES[contentType] || 'bin';
  const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  const safeRandomId = randomId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  return `orders/${safeOrderId}/${safeRandomId}.${extension}`;
}

export function isDocumentObjectPathForOrder(objectPath: string, orderId: string): boolean {
  const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  const prefix = `orders/${safeOrderId}/`;
  return objectPath.startsWith(prefix) && !objectPath.startsWith(`${prefix}reports/`) && !objectPath.includes('..');
}

export function reportObjectPath(orderId: string, contentType: string, randomId = crypto.randomUUID()): string {
  const extension = ALLOWED_UPLOAD_TYPES[contentType] || 'bin';
  const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  const safeRandomId = randomId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  return `orders/${safeOrderId}/reports/${safeRandomId}.${extension}`;
}

export function isReportObjectPathForOrder(objectPath: string, orderId: string): boolean {
  const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  return objectPath.startsWith(`orders/${safeOrderId}/reports/`) && !objectPath.includes('..');
}

export function safeOriginalFilename(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/]/g, '-').trim().slice(0, 180) || 'document';
}

export function safeDocumentLabel(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || 'Turnitin report';
}

export interface SignedUpload {
  uploadUrl: string;
  objectPath: string;
  expiresAt: string;
  maxBytes: number;
}

/**
 * A short-lived URL for uploading exactly one object.
 *
 * The signature covers the content type. The file size is checked before this
 * URL is issued and independently against Cloud Storage metadata afterward.
 */
export async function createSignedUpload(
  orderId: string,
  contentType: string,
  sizeBytes: number
): Promise<SignedUpload> {
  const objectPath = documentObjectPath(orderId, contentType);
  const expires = Date.now() + UPLOAD_URL_TTL_MS;

  const [uploadUrl] = await getStorage()
    .bucket(bucketName())
    .file(objectPath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires,
      contentType
    });

  return {
    uploadUrl,
    objectPath,
    expiresAt: new Date(expires).toISOString(),
    maxBytes: MAX_UPLOAD_BYTES
  };
}

export async function createSignedReportUpload(
  orderId: string,
  contentType: string
): Promise<SignedUpload> {
  const objectPath = reportObjectPath(orderId, contentType);
  const expires = Date.now() + UPLOAD_URL_TTL_MS;
  const [uploadUrl] = await getStorage().bucket(bucketName()).file(objectPath).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires,
    contentType
  });
  return { uploadUrl, objectPath, expiresAt: new Date(expires).toISOString(), maxBytes: MAX_UPLOAD_BYTES };
}

/**
 * Confirm the object really arrived, and that what landed is within the limits.
 *
 * The order is only advanced on the strength of this, never on the browser
 * saying the upload succeeded.
 */
export async function confirmUpload(
  objectPath: string
): Promise<{ ok: boolean; error?: string; sizeBytes?: number }> {
  const file = getStorage().bucket(bucketName()).file(objectPath);

  const [exists] = await file.exists();
  if (!exists) return { ok: false, error: 'No file was received.' };

  const [metadata] = await file.getMetadata();
  const sizeBytes = Number(metadata.size || 0);
  const contentType = String(metadata.contentType || '');

  const validation = validateUpload(contentType, sizeBytes);
  if (!validation.ok) {
    // Something outside the limits got through: remove it rather than leaving
    // it in the bucket.
    await file.delete({ ignoreNotFound: true });
    return { ok: false, error: validation.error };
  }

  const [header] = await file.download({ start: 0, end: 7 });
  const isPdf = contentType === 'application/pdf' && header.subarray(0, 5).toString() === '%PDF-';
  const isDoc = contentType === 'application/msword' && header.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  const isDocx = contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (!isPdf && !isDoc && !isDocx) {
    await file.delete({ ignoreNotFound: true });
    return { ok: false, error: 'The uploaded file contents do not match a PDF or Word document.' };
  }

  return { ok: true, sizeBytes };
}

/** A short-lived read URL. Documents are never public. */
export async function createSignedDownload(objectPath: string, originalName?: string): Promise<string> {
  const [url] = await getStorage()
    .bucket(bucketName())
    .file(objectPath)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + DOWNLOAD_URL_TTL_MS,
      ...(originalName ? { responseDisposition: `attachment; filename="${safeOriginalFilename(originalName).replace(/"/g, '')}"` } : {})
    });
  return url;
}

/**
 * Validate answers against a service's form, honouring `showIf`.
 *
 * A field hidden by its condition is not required: an upload the customer never
 * saw, because they chose WhatsApp, must not be reported as missing.
 */
export function validateServiceAnswers(
  fields: ServiceField[],
  answers: Record<string, unknown>
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const field of fields) {
    if (field.showIf) {
      const actual = answers[field.showIf.field];
      if (String(actual ?? '') !== field.showIf.equals) continue; // hidden
    }
    if (!field.required) continue;

    const value = answers[field.key];
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.push(field.label || field.key);
    }
  }

  return { ok: missing.length === 0, missing };
}
