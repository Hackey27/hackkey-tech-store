import type { Firestore } from '@google-cloud/firestore';
import type { RmbPricingSettings } from '../shared/types';
import { emptyRmbPricingSettings, validateRmbPricingSettings } from '../shared/rmbPricing';
import { COLLECTIONS, getFirestore } from './firestore';
import { buildAdminAuditEntry } from './adminAudit';
import type { AdminActor } from './adminAuth';

export const RMB_SETTINGS_ID = 'preorderRmbPricing';
export function storedRmbSettings(value?: Record<string, unknown>): RmbPricingSettings {
  return { ...emptyRmbPricingSettings(), ...value } as RmbPricingSettings;
}
/** No instance-local cache: a save on any Cloud Run instance affects the next
 * catalogue request and checkout on every instance. */
export async function getRmbPricingSettings(db: Firestore = getFirestore()): Promise<RmbPricingSettings> {
  const snapshot = await db.collection(COLLECTIONS.settings).doc(RMB_SETTINGS_ID).get();
  return storedRmbSettings(snapshot.data());
}
export async function saveRmbPricingSettings(input: RmbPricingSettings, actor: AdminActor, db: Firestore = getFirestore()) {
  const settings = { ...validateRmbPricingSettings(input), updatedAt: new Date().toISOString(), updatedBy: actor.email || actor.uid };
  const audit = buildAdminAuditEntry(actor, { action: 'settings.rmb-pricing-update', targetType: 'settings', targetId: RMB_SETTINGS_ID, details: { settings } });
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.settings).doc(RMB_SETTINGS_ID), settings);
  batch.set(db.collection(COLLECTIONS.adminAudit).doc(audit.auditId), audit);
  await batch.commit();
  return settings;
}
