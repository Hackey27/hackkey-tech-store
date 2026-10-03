import { Product, Variant } from './types';
import { defaultCustomerInputType, defaultDeliveryCodeType } from './softwareFulfilment';

const idPart = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** IDs identify a saved version forever; latest is a separate recommendation. */
export function suggestSoftwareVariantId(productId: string, version: string, os: string, usedIds: string[]): string {
  const base = `${idPart(productId)}-V${idPart(version) || 'NEW'}-${idPart(os) || 'ALL'}`.slice(0, 110);
  const used = new Set(usedIds.map(id => id.toUpperCase()));
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toUpperCase())) candidate = `${base}-${suffix++}`;
  return candidate;
}

export function newSoftwareProduct(categoryId: string): Product {
  return { productId: '', productName: '', categoryId, description: '', active: false, sortOrder: 100, variants: [] };
}

export function newSoftwareVariant(product: Product, usedIds: string[]): Variant {
  const sales = defaultDeliveryCodeType(product.productId) === 'sales-code';
  return {
    variantId: suggestSoftwareVariantId(product.productId, '', 'Windows', usedIds),
    versionOrPlan: '', os: 'Windows', priceGhs: 0, latest: true, available: false,
    licenceTerm: product.licenceTerm || '', macViaParallels: false,
    fulfilmentType: sales ? 'Seller Activation' : 'Licence', deliverableType: 'Licence',
    activationMode: sales ? 'Seller Activation' : 'Self Activation', autoFulfil: true,
    deliveryCodeType: defaultDeliveryCodeType(product.productId),
    customerInputRequired: defaultCustomerInputType(product.productId),
    manualDelivery: false, licenceRequiredForSelfActivation: !sales, activationLinkLive: false,
    showDeliveryNotice: false,
  };
}

export function validateSoftwareVariant(variant: Variant): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(variant.variantId || '')) throw new Error('Version ID must use letters, numbers, hyphens or underscores (up to 120 characters).');
  if (!variant.versionOrPlan?.trim()) throw new Error('Version is required.');
  if (!variant.os?.trim()) throw new Error('Operating system is required.');
  if (typeof variant.priceGhs !== 'number' || !Number.isFinite(variant.priceGhs) || variant.priceGhs < 0) throw new Error('Enter a valid non-negative price.');
  if (variant.available && variant.priceGhs <= 0) throw new Error('Enter a price before publishing this version.');
}

/** Only the recommendation for the same OS moves; identities and other OSs stay intact. */
export function saveVariantInProduct(product: Product, variant: Variant, creating: boolean): Product {
  validateSoftwareVariant(variant);
  variant = { ...variant, versionOrPlan: variant.versionOrPlan.trim(), os: variant.os.trim() };
  const exists = product.variants.some(entry => entry.variantId === variant.variantId);
  if (creating && exists) throw new Error('This version ID already exists. Choose another ID.');
  if (!creating && !exists) throw new Error('Version not found. Version IDs cannot be renamed.');
  const os = variant.os.trim().toLowerCase();
  const others = product.variants.filter(entry => entry.variantId !== variant.variantId).map(entry =>
    variant.latest && entry.os.trim().toLowerCase() === os ? { ...entry, latest: false } : entry
  );
  const variants = creating ? [variant, ...others] : product.variants.map(entry =>
    entry.variantId === variant.variantId ? variant : others.find(other => other.variantId === entry.variantId)!
  );
  return { ...product, variants };
}

/** Reorder permanent identities without changing version fields or recommendations. */
export function reorderSoftwareVariants(product: Product, orderedIds: unknown, expectedIds: unknown): Product {
  const currentIds = product.variants.map(variant => variant.variantId);
  if (!Array.isArray(expectedIds) || expectedIds.length !== currentIds.length || expectedIds.some((id, index) => id !== currentIds[index])) {
    throw new Error('The version list has changed. Reload before moving versions.');
  }
  if (!Array.isArray(orderedIds) || orderedIds.length !== currentIds.length || new Set(orderedIds).size !== currentIds.length || orderedIds.some(id => typeof id !== 'string' || !currentIds.includes(id))) {
    throw new Error('Version order must contain every saved version ID exactly once.');
  }
  const byId = new Map(product.variants.map(variant => [variant.variantId, variant]));
  return { ...product, variants: orderedIds.map(id => byId.get(id)!) };
}
