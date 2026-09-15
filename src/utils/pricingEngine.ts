import { Variant, Product, PricingConfig, PromotionRule } from '../types';

/**
 * Section 9.1: Currency format
 * Format as `GHS 1,200.00` — with the currency symbol GHS, a comma as the thousands separator,
 * and two decimal places (pesewas) where appropriate.
 */
export function formatCurrencyGHS(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 'GHS 0.00';
  }
  return `GHS ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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
 * Section 2: Pricing engine
 * Step 1: Base price -> Silent adjustment -> rounded UP to nearest whole cedi (min 1). This is list price.
 * Step 2: One promotion applied to list price (item-specific wins over global).
 */
export function calculateVariantPricing(
  basePrice: number,
  productId: string,
  variantId: string,
  pricingConfig: PricingConfig
): {
  listPriceGhs: number;
  payablePriceGhs: number;
  hasPromo: boolean;
  promoLabel?: string;
  promoPercent?: number;
} {
  if (typeof basePrice !== 'number' || isNaN(basePrice) || basePrice <= 0) {
    return { listPriceGhs: 0, payablePriceGhs: 0, hasPromo: false };
  }

  // Step 1: Silent Adjustment
  let listPrice = basePrice;
  const sa = pricingConfig.silentAdjustment;
  if (sa && sa.active && sa.percent !== 0) {
    const applies =
      sa.targetIds.length === 0 ||
      sa.targetIds.includes(productId) ||
      sa.targetIds.includes(variantId);
    if (applies) {
      listPrice = Math.ceil(basePrice * (1 + sa.percent / 100));
    }
  }
  // Ensure minimum list price is 1 cedi
  listPrice = Math.max(1, Math.ceil(listPrice));

  // Step 2: Promotions (Item-specific wins over global, never combined)
  let appliedPromo: PromotionRule | null = null;

  const isp = pricingConfig.itemSpecificPromotion;
  if (isp && isp.active && isp.percent > 0) {
    const applies =
      isp.targetIds.includes(productId) || isp.targetIds.includes(variantId);
    if (applies) {
      appliedPromo = isp;
    }
  }

  if (!appliedPromo) {
    const gp = pricingConfig.globalPromotion;
    if (gp && gp.active && gp.percent > 0) {
      const applies =
        gp.targetIds.length === 0 ||
        gp.targetIds.includes(productId) ||
        gp.targetIds.includes(variantId);
      if (applies) {
        appliedPromo = gp;
      }
    }
  }

  if (appliedPromo) {
    const discounted = Math.round(listPrice * (1 - appliedPromo.percent / 100) * 100) / 100;
    const payable = Math.max(1, discounted);
    return {
      listPriceGhs: listPrice,
      payablePriceGhs: payable,
      hasPromo: payable < listPrice,
      promoLabel: appliedPromo.label,
      promoPercent: appliedPromo.percent,
    };
  }

  return {
    listPriceGhs: listPrice,
    payablePriceGhs: listPrice,
    hasPromo: false,
  };
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
