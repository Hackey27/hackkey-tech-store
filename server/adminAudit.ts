import { AdminAuditEntry } from '../src/types';
import { AdminActor } from './adminAuth';
import { COLLECTIONS, getFirestore } from './firestore';

function auditId(): string {
  return `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildAdminAuditEntry(
  actor: AdminActor,
  event: Omit<AdminAuditEntry, 'auditId' | 'actorUid' | 'actorEmail' | 'createdAt'>
): AdminAuditEntry {
  return {
    auditId: auditId(),
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: new Date().toISOString(),
    ...event
  };
}

export async function writeAdminAudit(
  actor: AdminActor,
  event: Omit<AdminAuditEntry, 'auditId' | 'actorUid' | 'actorEmail' | 'createdAt'>
): Promise<AdminAuditEntry> {
  const entry = buildAdminAuditEntry(actor, event);
  await getFirestore().collection(COLLECTIONS.adminAudit).doc(entry.auditId).set(entry);
  return entry;
}
