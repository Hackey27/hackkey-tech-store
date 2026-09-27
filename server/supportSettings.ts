import { SupportSettings, SupportTool } from '../src/types';
import { AdminActor } from './adminAuth';
import { buildAdminAuditEntry } from './adminAudit';
import { COLLECTIONS, getFirestore, toIsoString } from './firestore';

/**
 * Remote-support programs, owned by the seller rather than by a deploy.
 *
 * Vendors move their download URLs and rename their products, and the seller
 * should be able to follow that from the admin portal instead of waiting for a
 * release.
 */
export const DEFAULT_SUPPORT_SETTINGS: SupportSettings = { tools: [] };

export const MAX_SUPPORT_TOOLS = 8;
const MAX_LABEL_LENGTH = 60;
const MAX_NOTE_LENGTH = 160;

const CACHE_TTL_MS = 30_000;
let cache: { value: SupportSettings; expiresAt: number } | null = null;
let lastWarning = '';

function warnOnce(message: string): void {
  if (lastWarning === message) return;
  lastWarning = message;
  console.warn(`[support] ${message}`);
}

/** A slug that stays stable across edits to the label. */
function toolIdFrom(label: string, index: number): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `tool-${index + 1}`;
}

/**
 * Only http(s) survives.
 *
 * These links are rendered to customers as anchors, so `javascript:` or `data:`
 * here would be a stored cross-site scripting hole with the admin portal as its
 * delivery mechanism. Parsing rather than pattern-matching means no scheme is
 * missed, and it rejects a malformed URL at the same time.
 */
function cleanUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('Every support tool needs a link.');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`"${raw}" is not a complete link. Include https://`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('A support link must start with https:// or http://');
  }
  return parsed.toString();
}

export function validateSupportSettings(input: unknown): SupportSettings {
  const value = (input && typeof input === 'object' ? input : {}) as Partial<SupportSettings>;
  const rows = Array.isArray(value.tools) ? value.tools : [];
  if (rows.length > MAX_SUPPORT_TOOLS) {
    throw new Error(`Keep the list to ${MAX_SUPPORT_TOOLS} support tools or fewer.`);
  }

  const seen = new Set<string>();
  const tools: SupportTool[] = rows.map((row, index) => {
    const source = (row && typeof row === 'object' ? row : {}) as Partial<SupportTool>;
    const label = String(source.label ?? '').trim();
    if (!label) throw new Error('Every support tool needs a label.');
    if (label.length > MAX_LABEL_LENGTH) throw new Error(`"${label}" is too long for a label.`);
    const note = String(source.note ?? '').trim();
    if (note.length > MAX_NOTE_LENGTH) throw new Error(`The note for "${label}" is too long.`);

    const requested = String(source.toolId ?? '').trim() || toolIdFrom(label, index);
    // A duplicate id would make two rows the same row on the next save.
    if (seen.has(requested)) throw new Error(`Two support tools share the id "${requested}". Rename one.`);
    seen.add(requested);

    return {
      toolId: requested,
      label,
      url: cleanUrl(source.url),
      ...(note ? { note } : {}),
      active: source.active !== false
    };
  });

  return { tools };
}

/** Malformed stored settings fail closed to an empty list rather than throwing
 *  the admin portal or the storefront. */
export function normaliseSupportSettings(raw: unknown): SupportSettings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<SupportSettings> & { updatedAt?: unknown };
  try {
    const valid = validateSupportSettings(value);
    lastWarning = '';
    return {
      ...valid,
      updatedAt: toIsoString(value.updatedAt),
      updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : undefined
    };
  } catch (error) {
    warnOnce(`settings/support is invalid (${error instanceof Error ? error.message : 'unknown error'}); serving no tools.`);
    return { ...DEFAULT_SUPPORT_SETTINGS };
  }
}

export function invalidateSupportSettingsCache(): void {
  cache = null;
}

export async function getSupportSettings(): Promise<SupportSettings> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  const snap = await getFirestore().collection(COLLECTIONS.settings).doc('support').get();
  const value = normaliseSupportSettings(snap.exists ? snap.data() : undefined);
  cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/** Only the tools a customer should see. */
export function publicSupportTools(settings: SupportSettings): SupportTool[] {
  return settings.tools.filter((tool) => tool.active);
}

export async function saveSupportSettings(
  input: unknown,
  actor: AdminActor
): Promise<{ oldValue: SupportSettings; newValue: SupportSettings }> {
  const validated = validateSupportSettings(input);
  const oldValue = await getSupportSettings();
  const newValue: SupportSettings = {
    ...validated,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email || actor.uid
  };
  const db = getFirestore();
  const audit = buildAdminAuditEntry(actor, {
    action: 'settings.support-update',
    targetType: 'settings',
    targetId: 'support',
    details: {
      oldTools: oldValue.tools.map((tool) => tool.toolId),
      newTools: newValue.tools.map((tool) => tool.toolId)
    }
  });
  // The live setting and its audit record commit together: a link customers are
  // told to download from never changes without a trail saying who changed it.
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.settings).doc('support'), newValue);
  batch.set(db.collection(COLLECTIONS.adminAudit).doc(audit.auditId), audit);
  await batch.commit();
  cache = { value: newValue, expiresAt: Date.now() + CACHE_TTL_MS };
  return { oldValue, newValue };
}
