import { Variant, Product } from '../types';

// Money arithmetic and formatting live in src/utils/money.ts, in integer
// pesewas. This module resolves operating systems and sellability only.

/**
 * Section 1.3: Operating system resolution
 * Resolves the OS options available for a variant based on the exact priority rules:
 * 1. Contains both "win" and "mac" -> Windows + macOS (choice required)
 * 2. Contains "mac" -> macOS (choice required)
 * 3. Contains "win" -> Windows (choice required)
 * 4. Contains "web" or "cloud" -> Web / Cloud (no OS choice asked)
 * 5. Contains "linux" -> Linux (choice required)
 * 6. Blank, and fulfilmentType contains "account" -> Any device (no OS choice asked)
 * 7. Otherwise fall back on variant ID prefix: starts with MAC -> macOS, else Windows
 * Finally: if macViaParallels is true and macOS not in list, add macOS and require choice.
 */
export function resolveVariantOperatingSystem(
  osRaw: string = '',
  fulfilmentType: string = '',
  variantId: string = '',
  macViaParallels: boolean = false
): { osList: string[]; requiresChoice: boolean; sentence: string } {
  const normOs = (osRaw || '').toLowerCase();
  const normFulfilment = (fulfilmentType || '').toLowerCase();
  const normId = (variantId || '').toUpperCase();

  let osList: string[] = [];
  let requiresChoice = true;

  if (normOs.includes('win') && normOs.includes('mac')) {
    osList = ['Windows', 'macOS'];
    requiresChoice = true;
  } else if (normOs.includes('mac')) {
    osList = ['macOS'];
    requiresChoice = true;
  } else if (normOs.includes('win')) {
    osList = ['Windows'];
    requiresChoice = true;
  } else if (normOs.includes('web') || normOs.includes('cloud')) {
    osList = ['Web / Cloud'];
    requiresChoice = false;
  } else if (normOs.includes('linux')) {
    osList = ['Linux'];
    requiresChoice = true;
  } else if (!normOs.trim() && normFulfilment.includes('account')) {
    osList = ['Any device'];
    requiresChoice = false;
  } else {
    if (normId.startsWith('MAC')) {
      osList = ['macOS'];
    } else {
      osList = ['Windows'];
    }
    requiresChoice = true;
  }

  // Section 1.3: If macViaParallels is true and macOS not in list, add macOS and require choice
  if (macViaParallels && !osList.includes('macOS')) {
    osList.push('macOS (via Parallels)');
    requiresChoice = true;
  }

  // Section 1.3: Availability sentence
  let sentence = 'Available for Windows';
  const hasWin = osList.some((o) => o.toLowerCase().includes('win'));
  const hasMac = osList.some((o) => o.toLowerCase().includes('mac'));

  if (hasWin && hasMac) {
    sentence = 'Available for Windows and macOS';
  } else if (hasMac && !hasWin) {
    sentence = 'Available for macOS only';
  } else if (hasWin && !hasMac) {
    sentence = 'Available for Windows only';
  } else if (osList.includes('Web / Cloud')) {
    sentence = 'Delivered online, works on any device';
  } else if (osList.includes('Any device')) {
    sentence = 'Delivered as an account, works on any device';
  } else if (osList.includes('Linux')) {
    sentence = 'Available for Linux';
  }

  return { osList, requiresChoice, sentence };
}

/**
 * Determine if a variant is sellable (Section 1.1)
 * "A variant is sellable only if available is TRUE and priceGhs is a non-empty, non-null value.
 *  A blank or null price means the variant is not sellable. It must never be treated as free (0.00)."
 */
export function isVariantSellable(v: Variant): boolean {
  return (
    v.available === true &&
    typeof v.priceGhs === 'number' &&
    !isNaN(v.priceGhs) &&
    v.priceGhs > 0
  );
}

/**
 * Determine if a product is active and sellable (Section 1.1)
 * "A product is only shown if it is active AND has at least one sellable variant."
 */
export function isProductSellable(p: Product): boolean {
  if (!p.active) return false;
  if (!p.variants || p.variants.length === 0) return false;
  return p.variants.some(isVariantSellable);
}
