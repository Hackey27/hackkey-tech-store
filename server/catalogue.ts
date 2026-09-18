import { Firestore } from '@google-cloud/firestore';
import {
  Announcement,
  Bundle,
  CatalogResponse,
  CatalogueItem,
  Category,
  LandingSettings,
  Laptop,
  MachineCodeType,
  Product,
  PricingConfig,
  Service,
  Variant
} from '../src/types';
import { COLLECTIONS, getFirestore, toIsoString } from './firestore';
import { getPricingConfig } from './pricingConfig';
import {
  applyPricingRules,
  cedisToPesewas,
  pesewasToCedis,
  serviceTargetIds
} from '../src/utils/money';
import {
  isProductSellable,
  isVariantSellable,
  resolveVariantOperatingSystem
} from '../src/utils/pricingEngine';
import {
  defaultCustomerInputType,
  defaultDeliveryCodeType,
  effectiveActivationWebsiteUrl
} from '../src/utils/softwareFulfilment';
import { resolvedDeliveryNotice } from './deliveryNotice';

/** The catalogue changes rarely and every page load reads it. */
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  response: CatalogResponse;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

/** Exposed so tests and the admin portal can force a re-read. */
export function invalidateCatalogueCache(): void {
  cache = null;
}

async function readCollection<T>(db: Firestore, name: string): Promise<T[]> {
  const snapshot = await db.collection(name).get();
  return snapshot.docs.map((doc) => doc.data() as T);
}

/** Resolve pricing and OS options for one variant. */
function hydrateVariant(variant: Variant, productId: string, categoryId: string, config: PricingConfig): Variant {
  // The workbook price is cedis; it becomes pesewas here, at the single
  // boundary, and every calculation downstream is integer arithmetic.
  const pricing = applyPricingRules(
    cedisToPesewas(variant.priceGhs),
    [productId, variant.variantId, `CATEGORY:${categoryId}`],
    config
  );
  const os = resolveVariantOperatingSystem(
    variant.os,
    variant.fulfilmentType,
    variant.variantId,
    variant.macViaParallels
  );

  return {
    ...variant,
    customerInputRequired: variant.customerInputRequired || defaultCustomerInputType(productId),
    deliveryCodeType: variant.deliveryCodeType || defaultDeliveryCodeType(productId),
    activationWebsiteUrl: effectiveActivationWebsiteUrl(variant),
    listPricePesewas: pricing.listPesewas,
    payablePricePesewas: pricing.payablePesewas,
    promoLabel: pricing.promoLabel,
    promoPercent: pricing.promoPercent,
    promoEndsAt: pricing.promoEndsAt,
    showDeliveryNotice: resolvedDeliveryNotice(variant),
    osList: os.osList,
    requiresOsChoice: os.requiresChoice
  };
}

/** What the customer must supply before this item can be activated. */
function machineCodeType(variants: Variant[]): MachineCodeType {
  const required = variants.find((v) => v.customerInputRequired)?.customerInputRequired;
  if (!required) return 'none';
  return required.toLowerCase().includes('hardware') ? 'hardware-id' : 'lock-code';
}

/** Storage-backed catalogue images stay private in the bucket. The stable
 *  application URL validates the prefix before streaming them to a customer. */
function catalogueImageUrl(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith('catalogue/')) return undefined;
  return `/api/catalog/images?path=${encodeURIComponent(value)}`;
}

function productToCatalogueItem(product: Product, config: PricingConfig): CatalogueItem {
  const variants = (product.variants || []).map((v) => hydrateVariant(v, product.productId, product.categoryId, config));
  const sellable = variants.filter(isVariantSellable);

  // The cheapest sellable variant is what the card advertises. A product with
  // no sellable variant has no price rather than a price of zero.
  const cheapest = sellable.reduce<Variant | undefined>(
    (min, v) => (!min || (v.payablePricePesewas ?? 0) < (min.payablePricePesewas ?? 0) ? v : min),
    undefined
  );

  const osSentence = variants.length
    ? resolveVariantOperatingSystem(
        variants[0].os,
        variants[0].fulfilmentType,
        variants[0].variantId,
        variants[0].macViaParallels
      ).sentence
    : undefined;

  return {
    kind: 'product',
    itemId: product.productId,
    name: product.productName,
    categoryId: product.categoryId,
    description: product.description,
    imageUrl: catalogueImageUrl(product.imagePath) || product.imageUrl,
    cardImageUrl: catalogueImageUrl(product.cardImagePath),
    bannerImageUrl: catalogueImageUrl(product.bannerImagePath),
    mobileBannerImageUrl: catalogueImageUrl(product.mobileBannerImagePath),
    screenshots: (product.screenshots || [])
      .map((image) => catalogueImageUrl(image))
      .filter((image): image is string => Boolean(image)),
    sortOrder: product.sortOrder ?? 0,
    featuredOrder: product.featuredOrder,
    pricePesewas: cheapest?.payablePricePesewas,
    listPricePesewas: cheapest?.listPricePesewas,
    promoLabel: cheapest?.promoLabel,
    promoPercent: cheapest?.promoPercent,
    promoEndsAt: cheapest?.promoEndsAt,
    showDeliveryNotice: variants.some((variant) => variant.showDeliveryNotice),
    availabilitySentence: osSentence,
    osList: [...new Set(variants.flatMap((v) => v.osList || []))],
    machineCodeType: machineCodeType(variants),
    variants
  };
}

function bundleToCatalogueItem(bundle: Bundle, products: Product[], config: PricingConfig): CatalogueItem {
  const pricing = applyPricingRules(
    cedisToPesewas(bundle.priceGhs),
    [bundle.bundleId, `CATEGORY:${bundle.categoryId}`],
    config
  );

  const productMap = new Map(products.map((product) => [product.productId, product]));
  const bundleContents = (bundle.items || [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => {
      const product = productMap.get(item.productId);
      const variant = product?.variants?.find((candidate) => candidate.variantId === item.variantId);
      return {
        ...item,
        productName: product?.productName || item.productId,
        versionOrPlan: variant?.versionOrPlan || item.variantId
      };
    });

  return {
    kind: 'bundle',
    itemId: bundle.bundleId,
    name: bundle.name,
    categoryId: bundle.categoryId,
    description: bundle.description,
    imageUrl: catalogueImageUrl(bundle.imagePath),
    cardImageUrl: catalogueImageUrl(bundle.cardImagePath),
    bannerImageUrl: catalogueImageUrl(bundle.bannerImagePath),
    mobileBannerImageUrl: catalogueImageUrl(bundle.mobileBannerImagePath),
    screenshots: (bundle.screenshots || []).map(catalogueImageUrl).filter((value): value is string => Boolean(value)),
    sortOrder: bundle.sortOrder ?? 0,
    pricePesewas: pricing.payablePesewas,
    listPricePesewas: pricing.listPesewas,
    promoLabel: pricing.promoLabel,
    promoPercent: pricing.promoPercent,
    promoEndsAt: pricing.promoEndsAt,
    bundleContents,
    bundle
  };
}

function serviceToCatalogueItem(service: Service, config: PricingConfig): CatalogueItem {
  // A service with options is purchasable and advertises a "from" price taken
  // from its cheapest option. A service without them is quote-only and has no
  // price at all, which must stay absent rather than become 0.
  const pricedOptions = service.options?.map((option) => {
    const targets = [...serviceTargetIds(service.serviceId, option.optionId), `CATEGORY:${service.categoryId}`];
    const unit = applyPricingRules(cedisToPesewas(option.unitPriceGhs), targets, config);
    const bulk = option.bulkPriceGhs != null
      ? applyPricingRules(cedisToPesewas(option.bulkPriceGhs), targets, config)
      : undefined;
    return {
      option: {
        ...option,
        unitPriceGhs: pesewasToCedis(unit.payablePesewas),
        ...(bulk ? { bulkPriceGhs: pesewasToCedis(bulk.payablePesewas) } : {})
      },
      pricing: unit
    };
  }) || [];
  const cheapest = pricedOptions.reduce<typeof pricedOptions[number] | undefined>(
    (minimum, entry) => !minimum || entry.pricing.payablePesewas < minimum.pricing.payablePesewas ? entry : minimum,
    undefined
  );
  const pricing = cheapest?.pricing;

  return {
    kind: 'service',
    itemId: service.serviceId,
    name: service.name,
    categoryId: service.categoryId,
    description: service.description || service.tagline,
    imageUrl: catalogueImageUrl(service.imagePath),
    cardImageUrl: catalogueImageUrl(service.cardImagePath),
    bannerImageUrl: catalogueImageUrl(service.bannerImagePath),
    mobileBannerImageUrl: catalogueImageUrl(service.mobileBannerImagePath),
    screenshots: (service.screenshots || []).map(catalogueImageUrl).filter((value): value is string => Boolean(value)),
    sortOrder: service.sortOrder ?? 0,
    pricePesewas: pricing?.payablePesewas,
    listPricePesewas: pricing?.listPesewas,
    promoLabel: pricing?.promoLabel,
    promoPercent: pricing?.promoPercent,
    promoEndsAt: pricing?.promoEndsAt,
    showDeliveryNotice: service.showDeliveryNotice === true,
    // A service is never licence-delivered, so the fulfilment workflow must not
    // offer a licence step for it.
    machineCodeType: 'service',
    // Carried to the frontend so the option picker, quantity selector and the
    // disclaimer can all render before purchase.
    options: pricedOptions.map((entry) => entry.option).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    minQty: service.minQty ?? 1,
    maxQty: service.maxQty ?? 50,
    disclaimer: service.disclaimer,
    service
  };
}

function laptopToCatalogueItem(laptop: Laptop, config: PricingConfig): CatalogueItem {
  const pricing =
    typeof laptop.priceGhs === 'number' && laptop.priceGhs > 0
      ? applyPricingRules(cedisToPesewas(laptop.priceGhs), [laptop.laptopId, `CATEGORY:${laptop.categoryId}`], config)
      : undefined;

  const spec = [laptop.processor, laptop.ram, laptop.storage, laptop.screen]
    .filter(Boolean)
    .join(' · ');

  return {
    kind: 'laptop',
    itemId: laptop.laptopId,
    name: laptop.title,
    categoryId: laptop.categoryId,
    description: spec,
    imageUrl: catalogueImageUrl(laptop.imagePath) || laptop.picturesUrl?.[0],
    cardImageUrl: catalogueImageUrl(laptop.cardImagePath),
    bannerImageUrl: catalogueImageUrl(laptop.bannerImagePath),
    mobileBannerImageUrl: catalogueImageUrl(laptop.mobileBannerImagePath),
    screenshots: [
      ...(laptop.screenshots || []).map(catalogueImageUrl),
      ...(laptop.picturesUrl || [])
    ].filter((value): value is string => Boolean(value)),
    sortOrder: laptop.sortOrder ?? 0,
    pricePesewas: pricing?.payablePesewas,
    listPricePesewas: pricing?.listPesewas,
    promoLabel: pricing?.promoLabel,
    promoPercent: pricing?.promoPercent,
    promoEndsAt: pricing?.promoEndsAt,
    availabilitySentence: laptop.availability,
    laptop
  };
}

/** Announcements are returned only while active and inside their window. */
function selectAnnouncement(announcements: Announcement[], now: Date): Announcement | undefined {
  return announcements
    .filter((a) => {
      if (!a.active) return false;
      const startsAt = toIsoString(a.startsAt);
      const endsAt = toIsoString(a.endsAt);
      if (startsAt && new Date(startsAt) > now) return false;
      if (endsAt && new Date(endsAt) < now) return false;
      return true;
    })
    .sort((a, b) =>
      (toIsoString(b.updatedAt) || toIsoString(b.createdAt) || '').localeCompare(
        toIsoString(a.updatedAt) || toIsoString(a.createdAt) || ''
      )
    )[0];
}

function matchesSearch(item: CatalogueItem, query: string): boolean {
  const haystack = [
    item.name,
    item.description,
    item.categoryId,
    ...(item.variants || []).map((v) => v.versionOrPlan)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

async function buildCatalogue(): Promise<CatalogResponse> {
  const db = getFirestore();

  const [categories, products, bundles, services, laptops, announcements, landingSnap, pricingConfig] = await Promise.all([
    readCollection<Category>(db, COLLECTIONS.categories),
    readCollection<Product>(db, COLLECTIONS.products),
    readCollection<Bundle>(db, COLLECTIONS.bundles),
    readCollection<Service>(db, COLLECTIONS.services),
    readCollection<Laptop>(db, COLLECTIONS.laptops),
    readCollection<Announcement>(db, COLLECTIONS.announcements),
    db.collection(COLLECTIONS.storeSettings).doc('landing').get(),
    getPricingConfig()
  ]);

  const activeProducts = products.filter((p) => p.active);
  const activeBundles = bundles.filter((b) => b.active);
  const activeServices = services.filter((s) => s.active);
  const activeLaptops = laptops.filter((l) => l.active);

  // Bundles, services and laptops join products in one catalogue, each tagged
  // with its kind. Without this the Services, Bundles and Laptops categories
  // render empty however much data Firestore holds.
  const items: CatalogueItem[] = [
    ...activeProducts.map((product) => productToCatalogueItem(product, pricingConfig)).filter((item) =>
      isProductSellable({
        productId: item.itemId,
        productName: item.name,
        categoryId: item.categoryId,
        active: true,
        variants: item.variants || []
      })
    ),
    ...activeBundles.map((bundle) => bundleToCatalogueItem(bundle, activeProducts, pricingConfig)),
    ...activeServices.map((service) => serviceToCatalogueItem(service, pricingConfig)),
    ...activeLaptops.map((laptop) => laptopToCatalogueItem(laptop, pricingConfig))
  ].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const categoryNames = new Map(categories.map((c) => [c.categoryId, c.name]));
  items.forEach((item) => {
    item.categoryName = categoryNames.get(item.categoryId);
  });

  const activeCategories = categories
    .filter((c) => c.active)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((category) => ({
      ...category,
      imageUrl: catalogueImageUrl(category.imagePath),
      iconImageUrl: catalogueImageUrl(category.iconImagePath),
      // Derived, never stored: a stored copy goes stale as soon as the
      // catalogue changes.
      representativeItems: items
        .filter((item) => item.categoryId === category.categoryId)
        .slice(0, 8)
        .map((item) => item.name)
    }));

  return {
    categories: activeCategories,
    products: items,
    bundles: activeBundles,
    services: activeServices,
    laptops: activeLaptops,
    totalProducts: items.length,
    source: 'Firestore',
    timestamp: new Date().toISOString(),
    announcement: selectAnnouncement(announcements, new Date()),
    landing: landingSnap.exists
      ? {
          desktopImageUrl: catalogueImageUrl((landingSnap.data() as LandingSettings).desktopImagePath),
          mobileImageUrl: catalogueImageUrl((landingSnap.data() as LandingSettings).mobileImagePath)
        }
      : undefined,
    activePromotion: pricingConfig.globalPromotion.active && pricingConfig.globalPromotion.percent > 0 &&
      (!pricingConfig.globalPromotion.endsAt || new Date(pricingConfig.globalPromotion.endsAt).getTime() > Date.now())
      ? {
          label: pricingConfig.globalPromotion.label || 'Limited-time promotion',
          percent: pricingConfig.globalPromotion.percent,
          endsAt: pricingConfig.globalPromotion.endsAt
        }
      : undefined
  };
}

/**
 * The catalogue response, cached in memory for 60 seconds.
 *
 * Filtering is applied to the cached copy rather than the query, so a search
 * never costs a Firestore read.
 */
export async function getCatalogue(
  categoryFilter?: string,
  searchQuery?: string
): Promise<CatalogResponse> {
  const now = Date.now();
  if (!cache || cache.expiresAt <= now) {
    cache = { response: await buildCatalogue(), expiresAt: now + CACHE_TTL_MS };
  }

  const base = cache.response;
  const category = categoryFilter?.trim();
  const query = searchQuery?.trim().toLowerCase();

  if (!category && !query) return base;

  let items = base.products;
  if (category && category !== 'all') {
    items = items.filter((item) => item.categoryId === category);
  }
  if (query) {
    items = items.filter((item) => matchesSearch(item, query));
  }

  const keptIds = new Set(items.map((item) => item.itemId));

  return {
    ...base,
    products: items,
    bundles: base.bundles.filter((b) => keptIds.has(b.bundleId)),
    services: base.services.filter((s) => keptIds.has(s.serviceId)),
    laptops: base.laptops.filter((l) => keptIds.has(l.laptopId)),
    totalProducts: items.length,
    timestamp: new Date().toISOString()
  };
}

/** Look up one bundle, for order placement. */
export async function findBundle(bundleId: string): Promise<Bundle | null> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.bundles).doc(bundleId).get();
  return snap.exists ? (snap.data() as Bundle) : null;
}

/** Look up one laptop, for order placement. */
export async function findLaptop(laptopId: string): Promise<Laptop | null> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.laptops).doc(laptopId).get();
  return snap.exists ? (snap.data() as Laptop) : null;
}

/** Look up one service, for order placement. */
export async function findService(serviceId: string): Promise<Service | null> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.services).doc(serviceId).get();
  return snap.exists ? (snap.data() as Service) : null;
}

/** Look up one variant, with its product, for order placement. */
export async function findVariant(
  variantId: string
): Promise<{ product: Product; variant: Variant } | null> {
  const db = getFirestore();
  const [products, pricingConfig] = await Promise.all([
    readCollection<Product>(db, COLLECTIONS.products),
    getPricingConfig()
  ]);

  for (const product of products) {
    const variant = (product.variants || []).find((v) => v.variantId === variantId);
    if (variant) {
      return { product, variant: hydrateVariant(variant, product.productId, product.categoryId, pricingConfig) };
    }
  }
  return null;
}
