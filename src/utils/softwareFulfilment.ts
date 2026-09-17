import { CustomerInputType, Variant } from '../types';

function normalizedProductId(productId?: string): string {
  return String(productId || '').trim().toUpperCase();
}

/** Defaults for legacy catalogue rows that pre-date the admin setup fields. */
export function defaultCustomerInputType(productId?: string): CustomerInputType | undefined {
  const id = normalizedProductId(productId);
  if (id === 'AMOS' || id === 'SPSS') return 'Lock Code';
  if (['MP', 'MPLUS', 'MXQ', 'MAXQDA', 'EV', 'EVIEWS'].includes(id)) return 'Hardware ID';
  return undefined;
}

/** SPSS, AMOS and MPlus pool entries are seller-only Sales IDs. */
export function defaultDeliveryCodeType(productId?: string): NonNullable<Variant['deliveryCodeType']> {
  return ['AMOS', 'SPSS', 'MP', 'MPLUS'].includes(normalizedProductId(productId)) ? 'sales-code' : 'licence';
}

/** The workbook stores these links in Activation_Link; newer admin edits use
 * activationWebsiteUrl. Keeping one resolver prevents older imports from
 * losing their version-specific activation sites. */
export function effectiveActivationWebsiteUrl(variant?: Pick<Variant, 'activationWebsiteUrl' | 'activationLink'>): string | undefined {
  return variant?.activationWebsiteUrl || variant?.activationLink;
}
