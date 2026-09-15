// ==========================================
// Hack-Key Tech Store — domain model
//
// camelCase everywhere, in Firestore and in TypeScript. The spreadsheet's
// Product_ID / Price_GHS style is mapped exactly once, in
// scripts/migrate-sheet-to-firestore.ts. There are deliberately no legacy
// alias fields: one field per concept, so two halves can never disagree.
//
// Money is always a number in whole Ghana cedis, never a string.
// ==========================================

export type CustomerInputType = 'Lock Code' | 'Hardware ID';

/** What the customer must supply before an activation can be completed. */
export type MachineCodeType = 'lock-code' | 'hardware-id' | 'none' | 'service';

/** What a catalogue entry actually is. Products, bundles, services and laptops
 *  all appear in the catalogue; the frontend renders them by `kind`. */
export type CatalogueItemKind = 'product' | 'bundle' | 'service' | 'laptop';

// ==========================================
// Categories
// ==========================================

export interface Category {
  categoryId: string; // e.g. 'DATA', 'SERVICE', 'DESIGN', 'BUNDLE', 'LAPTOP'
  name: string;
  tagline: string;
  icon: string;
  sortOrder: number;
  active: boolean;
  /** Derived at read time from the catalogue entries in this category.
   *  Never stored — it would go stale the moment a product is added. */
  representativeItems?: string[];
}

// ==========================================
// Products and variants
// ==========================================

/** Embedded in its product. 48 variants across 19 products, at most 8 on any
 *  one product, and the catalogue always wants them together, so embedding
 *  turns an N+1 read into a single query. The licence pool references variants
 *  by id string, so no join is needed. */
export interface Variant {
  variantId: string;
  /** Always a string. Excel coerced the AMOS versions to floats (31.0), and
   *  "4.1.1.8" must survive untouched. Normalised during migration. */
  versionOrPlan: string;
  priceGhs: number;
  latest: boolean;
  available: boolean;
  licenceTerm: string;
  os: string;
  macViaParallels: boolean;
  fulfilmentType: string;
  deliverableType: string;
  activationMode: string;
  autoFulfil: boolean;
  manualDelivery: boolean;
  licenceRequiredForSelfActivation: boolean;
  prerequisiteBeforeActivationCode?: string;
  customerInputRequired?: string; // 'Lock Code' | 'Hardware ID' | blank
  sellerOutput?: string;
  activationCodeOrKey?: string;
  activationWebsiteUrl?: string;
  activationLink?: string;
  activationLinkLive: boolean;
  windowsInstallerUrl?: string;
  guideUrl?: string;
  learningResourcesUrl?: string;
  notes?: string;

  // Resolved at read time by the pricing engine and OS resolver.
  listPriceGhs?: number;
  payablePriceGhs?: number;
  promoLabel?: string;
  promoPercent?: number;
  osList?: string[];
  requiresOsChoice?: boolean;
}

export interface Product {
  productId: string;
  productName: string; // customer-facing, always wins
  categoryId: string;
  defaultContact?: string;
  imageUrl?: string;
  active: boolean;
  sortOrder?: number;
  variants: Variant[];
}

// ==========================================
// Bundles
// ==========================================

export interface BundleItem {
  itemId: string;
  productId: string;
  variantId: string;
  /** Blank means a fixed item. Rows sharing a value are alternatives —
   *  "choose one of these" — and must survive migration intact. */
  altGroup?: string;
  altLabel?: string;
  sortOrder: number;
  notes?: string;
}

export interface Bundle {
  bundleId: string;
  name: string;
  description: string;
  priceGhs: number; // a fixed bundle price, not a sum of its items
  categoryId: string;
  sortOrder: number;
  active: boolean;
  items: BundleItem[];
}

// ==========================================
// Services
// ==========================================

export type ServiceFieldType =
  | 'text'
  | 'tel'
  | 'email'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'datetime';

export interface ServiceFieldCondition {
  field: string;
  equals: string;
}

/** Parsed from the Services tab's `Fields` column at import time, never stored
 *  as a raw string. A service whose Fields column does not parse fails the
 *  migration loudly rather than arriving half-formed. */
export interface ServiceField {
  key: string;
  label: string;
  type: ServiceFieldType;
  required: boolean;
  helper?: string;
  placeholder?: string;
  options?: string[];
  showIf?: ServiceFieldCondition;
}

export interface Service {
  serviceId: string;
  name: string;
  tagline: string;
  description: string;
  categoryId: string;
  instructions?: string;
  fields: ServiceField[];
  ctaLabel: string;
  ctaNote?: string;
  priceGhs?: number;
  active: boolean; // Status: 'Published' -> true
  sortOrder: number;
}

// ==========================================
// Laptops
// ==========================================

export interface Laptop {
  laptopId: string;
  title: string;
  priceGhs?: number; // absent means "ask for price" — never treat as free
  categoryId: string;
  brand: string;
  model: string;
  processor: string;
  ram: string;
  storage: string;
  screen: string;
  colour: string;
  graphics: string;
  graphicsDetails?: string;
  ports: string;
  operatingSystem: string;
  freebies?: string;
  /** The sheet's Pictures_URL may hold several URLs. */
  picturesUrl: string[];
  availability: string; // 'Available' | 'Preorder'
  notes?: string;
  active: boolean; // Status: 'Published' -> true
  sortOrder: number;
}

// ==========================================
// Catalogue assembly
// ==========================================

/** One renderable catalogue entry. Products, bundles, services and laptops are
 *  normalised onto this shape so a category page can show everything in it —
 *  this is what stops the Services, Bundles and Laptops categories rendering
 *  empty. `kind` tells the frontend how to render and what the CTA should do.
 *  The raw typed record is carried alongside for consumers that need it. */
export interface CatalogueItem {
  kind: CatalogueItemKind;
  itemId: string;
  name: string;
  categoryId: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  /** Absent means there is no single price to show — a service priced on
   *  enquiry, or a laptop with a blank price. Never rendered as 0. */
  priceGhs?: number;
  listPriceGhs?: number;
  promoLabel?: string;
  promoPercent?: number;
  availabilitySentence?: string;
  /** Display name of the item's category, resolved from the category document
   *  so the card does not have to look it up. */
  categoryName?: string;
  /** Operating systems this item can be delivered for, merged across variants. */
  osList?: string[];
  /** Derived from the variants: what the customer must supply to activate. */
  machineCodeType?: MachineCodeType;
  /** Products only. */
  variants?: Variant[];
  bundle?: Bundle;
  service?: Service;
  laptop?: Laptop;
}

// ==========================================
// Pricing
// ==========================================

export interface SilentAdjustmentRule {
  active: boolean;
  percent: number;
  targetIds: string[]; // empty means all
}

export interface PromotionRule {
  active: boolean;
  percent: number;
  label: string;
  targetIds: string[];
  endsAt?: string;
}

export interface PricingConfig {
  silentAdjustment: SilentAdjustmentRule;
  globalPromotion: PromotionRule;
  itemSpecificPromotion: PromotionRule;
}

// ==========================================
// Orders
// ==========================================

export type PaymentStatus = 'pending' | 'paid';

export type FulfilmentStatus =
  | 'pending-payment'
  | 'awaiting-customer-input'
  /** Paid, but the licence pool held no available key for the variant. The
   *  order is valid and owed a licence; the owner must issue one. */
  | 'awaiting-licence'
  | 'awaiting-seller-activation'
  | 'ready';

export type FulfilmentMethod = 'automatic' | 'manual';

export interface Order {
  orderId: string;
  cartId: string;
  orderDate: string;
  lastUpdated: string;
  customerName: string;
  phone: string;
  email: string;
  variantId: string;
  productId?: string;
  productName: string;
  versionOrPlan: string;
  deliveryOs: string;
  amountGhs: number;
  originalAmountGhs?: number;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  fulfilmentType?: string;
  fulfilmentMethod?: FulfilmentMethod;
  customerInputType?: CustomerInputType;
  customerInputValue?: string;
  salesCode?: string;
  activationCodeOrKey?: string;
  licenceId?: string;
  /** Set when a paid auto-fulfil order found no available licence, so the gap
   *  is visible rather than silent. */
  licenceIssueNote?: string;
  activationWebsiteUrl?: string;
  paystackReference?: string;
  receiptSent?: boolean;
  emailStatus?: string;
  fulfilledAt?: string;
  notes?: string;
  windowsInstallerUrl?: string;
  guideUrl?: string;
  learningResourcesUrl?: string;
  macViaParallels?: boolean;
}

// ==========================================
// Licence pool
// ==========================================

/** Schema only for this phase. The collection is created empty and populated
 *  through the admin portal in Phase 2 — see docs/phase-1-firestore-spec.md §3
 *  for the source-data defects that must be resolved before any key is loaded. */
export interface LicencePoolEntry {
  licenceId: string;
  variantId: string;
  licenceCode: string;
  codeType?: string;
  status: 'available' | 'assigned';
  assignedOrderId?: string;
  dateAdded?: string;
  dateAssigned?: string;
  notes?: string;
}

// ==========================================
// Requests — one inbox, four kinds
// ==========================================

export type RequestKind =
  | 'laptop-request'
  | 'laptop-enquiry'
  | 'custom-bundle'
  | 'humanizing'
  | 'software-request'
  | 'service-enquiry';

export interface CustomerRequest {
  requestId: string;
  kind: RequestKind;
  requestDate: string;
  customerName: string;
  phone: string;
  email?: string;
  status: string;
  notes?: string;
  /** Everything specific to this kind of request. */
  details: Record<string, unknown>;
}

// ==========================================
// Announcements
// ==========================================

export interface Announcement {
  announcementId: string;
  title: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
  showOnce: boolean;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt?: string;
}

// ==========================================
// Reviews — schema only, unused until Phase 3
// ==========================================

export interface Review {
  reviewId: string;
  itemId: string;
  kind: CatalogueItemKind;
  customerName: string;
  rating: number;
  comment?: string;
  published: boolean;
  createdAt?: string;
}

// ==========================================
// API responses
// ==========================================

export interface CatalogResponse {
  categories: Category[];
  /** The merged catalogue: products, bundles, services and laptops, each
   *  tagged with `kind`. */
  products: CatalogueItem[];
  bundles: Bundle[];
  services: Service[];
  laptops: Laptop[];
  totalProducts: number;
  source: string;
  timestamp: string;
  announcement?: Announcement;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
  environment: string;
  dataSource: string;
  currency: 'GHS';
  timezone: 'Africa/Accra';
}
