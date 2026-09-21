import { CheckoutPaymentMode, MomoPaymentDetails, PaymentSettings, PublicPaymentOptions } from '../src/types';
import { AdminActor } from './adminAuth';
import { buildAdminAuditEntry } from './adminAudit';
import { COLLECTIONS, getFirestore, toIsoString } from './firestore';

export const DEFAULT_MOMO_DETAILS: MomoPaymentDetails = {
  merchantId: '722657',
  merchantName: 'Hack Key Tech Ventures',
  transferNumber: '0559306223',
  transferName: 'LAWRENCE HACKEY JORHOWIE HACK KEY TECH VENTURES',
  whatsappNumber: '0542638979'
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  mode: 'paystack',
  momo: DEFAULT_MOMO_DETAILS
};

const CACHE_TTL_MS = 30_000;
let cache: { value: PaymentSettings; expiresAt: number } | null = null;
let lastWarning = '';

function cleanMomo(value: unknown): MomoPaymentDetails {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<MomoPaymentDetails>;
  return {
    merchantId: String(source.merchantId || '').trim(),
    merchantName: String(source.merchantName || '').trim(),
    transferNumber: String(source.transferNumber || '').trim(),
    transferName: String(source.transferName || '').trim(),
    whatsappNumber: String(source.whatsappNumber || '').trim()
  };
}

function warnOnce(message: string): void {
  if (lastWarning === message) return;
  lastWarning = message;
  console.warn(`[payments] ${message}`);
}

export function validatePaymentSettings(input: unknown): PaymentSettings {
  const value = (input && typeof input === 'object' ? input : {}) as Partial<PaymentSettings>;
  if (!['paystack', 'momo', 'both'].includes(String(value.mode))) {
    throw new Error('Choose Paystack, MoMo, or both payment methods.');
  }
  const momo = cleanMomo(value.momo);
  if (!/^\d+$/.test(momo.merchantId)) throw new Error('The MoMo Pay Merchant ID must contain digits only.');
  if (!/^\d+$/.test(momo.transferNumber)) throw new Error('The MoMo transfer number must contain digits only.');
  if (!/^(?:0\d{9}|233\d{9})$/.test(momo.whatsappNumber)) throw new Error('Enter a valid Ghana WhatsApp number, such as 0542638979.');
  if (!momo.merchantName) throw new Error('The MoMo merchant name is required.');
  if (!momo.transferName) throw new Error('The MoMo transfer account name is required.');
  return { mode: value.mode as CheckoutPaymentMode, momo };
}

/** Converts a Firestore value to the safe runtime setting. Missing or malformed
 * documents always fail closed to the existing Paystack checkout. */
export function normalisePaymentSettings(raw: unknown): PaymentSettings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<PaymentSettings> & { updatedAt?: unknown };
  if (!['paystack', 'momo', 'both'].includes(String(value.mode))) {
    warnOnce('settings/payments is missing or has an invalid mode; defaulting to Paystack.');
    return { ...DEFAULT_PAYMENT_SETTINGS, momo: { ...DEFAULT_MOMO_DETAILS } };
  }
  try {
    const valid = validatePaymentSettings(value);
    lastWarning = '';
    return {
      ...valid,
      updatedAt: toIsoString(value.updatedAt),
      updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : undefined
    };
  } catch (error) {
    warnOnce(`settings/payments is invalid (${error instanceof Error ? error.message : 'unknown error'}); defaulting to Paystack.`);
    return { ...DEFAULT_PAYMENT_SETTINGS, momo: { ...DEFAULT_MOMO_DETAILS } };
  }
}

export function invalidatePaymentSettingsCache(): void {
  cache = null;
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  const snap = await getFirestore().collection(COLLECTIONS.settings).doc('payments').get();
  const value = normalisePaymentSettings(snap.exists ? snap.data() : undefined);
  cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

export function publicPaymentOptions(settings: PaymentSettings): PublicPaymentOptions {
  return { mode: settings.mode, momo: { ...settings.momo }, updatedAt: settings.updatedAt };
}

export function paymentModeUsesPaystack(mode: CheckoutPaymentMode): boolean {
  return mode === 'paystack' || mode === 'both';
}

export async function getPublicPaymentOptions(): Promise<PublicPaymentOptions> {
  return publicPaymentOptions(await getPaymentSettings());
}

export async function savePaymentSettings(input: unknown, actor: AdminActor): Promise<{ oldValue: PaymentSettings; newValue: PaymentSettings }> {
  const validated = validatePaymentSettings(input);
  const oldValue = await getPaymentSettings();
  const newValue: PaymentSettings = {
    ...validated,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email || actor.uid
  };
  const db = getFirestore();
  const audit = buildAdminAuditEntry(actor, {
    action: 'settings.payments-update',
    targetType: 'settings',
    targetId: 'payments',
    details: { oldMode: oldValue.mode, newMode: newValue.mode }
  });
  // The live setting and its audit record commit together: there is no state
  // in which customers see a changed payment mode without an audit trail.
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.settings).doc('payments'), newValue);
  batch.set(db.collection(COLLECTIONS.adminAudit).doc(audit.auditId), audit);
  await batch.commit();
  invalidatePaymentSettingsCache();
  cache = { value: newValue, expiresAt: Date.now() + CACHE_TTL_MS };
  return { oldValue, newValue };
}
