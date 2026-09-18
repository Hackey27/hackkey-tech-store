import { Variant } from '../src/types';

/**
 * Compatibility defaults for the one-time migration from the former store.
 * Saved Firestore booleans always win; this mapping only prevents the two
 * legacy promises disappearing while an older document is being migrated.
 */
const LEGACY_ENABLED_VARIANTS = new Set(['MXQ01', 'EV01']);

export function resolvedDeliveryNotice(variant: Pick<Variant, 'variantId' | 'showDeliveryNotice'>): boolean {
  return variant.showDeliveryNotice ?? LEGACY_ENABLED_VARIANTS.has(variant.variantId);
}

export function fulfilmentNoticeKind(fulfilmentType?: string): 'licence' | 'account' {
  return /account/i.test(fulfilmentType || '') ? 'account' : 'licence';
}
