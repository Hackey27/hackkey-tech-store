import type { CatalogueItem, Variant } from '../types';
import { isVariantSellable, resolveVariantOperatingSystem } from './pricingEngine';

export interface CustomBundleChoice {
  itemId: string;
  name: string;
  variantId: string;
  versionOrPlan: string;
  os: string;
}

export function selectableBundleVariants(item: CatalogueItem): Variant[] {
  return (item.variants || []).filter(isVariantSellable);
}

export function bundleVariantOs(variant: Variant): string[] {
  return variant.osList?.length
    ? variant.osList
    : resolveVariantOperatingSystem(variant.os, variant.fulfilmentType, variant.variantId, variant.macViaParallels).osList;
}

export function bundleOperatingSystems(item: CatalogueItem): string[] {
  return [...new Set(selectableBundleVariants(item).flatMap(bundleVariantOs))];
}

export function bundleVariantsForOs(item: CatalogueItem, os: string): Variant[] {
  return selectableBundleVariants(item).filter((variant) => bundleVariantOs(variant).includes(os));
}

/** Resolve customer selections against today's public catalogue, never client-supplied names. */
export function resolveCustomBundleChoices(
  catalogue: CatalogueItem[],
  submitted: unknown
): { choices: CustomBundleChoice[]; error?: never } | { choices?: never; error: string } {
  if (!Array.isArray(submitted) || submitted.length < 2 || submitted.length > 25) {
    return { error: 'Choose between 2 and 25 software titles.' };
  }
  const products = new Map(catalogue.filter((item) => item.kind === 'product').map((item) => [item.itemId, item]));
  const seen = new Set<string>();
  const choices: CustomBundleChoice[] = [];

  for (const raw of submitted) {
    if (!raw || typeof raw !== 'object') return { error: 'One software selection is incomplete.' };
    const input = raw as Record<string, unknown>;
    if (typeof input.itemId !== 'string' || typeof input.variantId !== 'string' || typeof input.os !== 'string') {
      return { error: 'Choose a version and operating system for every software title.' };
    }
    const item = products.get(input.itemId);
    if (!item || seen.has(item.itemId)) return { error: 'A software title is unavailable or selected twice. Refresh and try again.' };
    const variant = selectableBundleVariants(item).find((candidate) => candidate.variantId === input.variantId);
    if (!variant || !bundleVariantOs(variant).includes(input.os)) {
      return { error: `The selected version or operating system for ${item.name} is unavailable. Refresh and try again.` };
    }
    seen.add(item.itemId);
    choices.push({ itemId: item.itemId, name: item.name, variantId: variant.variantId, versionOrPlan: variant.versionOrPlan, os: input.os });
  }
  return { choices };
}
