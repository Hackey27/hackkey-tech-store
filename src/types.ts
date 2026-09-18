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
export type MachineCodeType = 'lock-code' | 'hardware-id' | 'none' | 'service' | 'turnitin';

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
  /** Optional admin-uploaded artwork shown behind the category card. */
  imagePath?: string;
  /** Optional uploaded icon. Animated GIFs are revealed on hover. */
  iconImagePath?: string;
  /** Public, server-mediated URL derived from imagePath. */
  imageUrl?: string;
  iconImageUrl?: string;
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
  /** Determines whether an automatically assigned pool entry is the final
   * customer licence or an internal sales code used by the seller. */
  deliveryCodeType?: 'licence' | 'sales-code';
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
  /** Extra no-cost downloads included when a Windows build is ordered for a Mac through Parallels. */
  parallelsInstallerUrl?: string;
  windows11DownloadUrl?: string;
  guideUrl?: string;
  learningResourcesUrl?: string;
  /** Admin-controlled customer-facing 20–40 minute fulfilment notice. */
  showDeliveryNotice?: boolean;
  notes?: string;

  // Resolved at read time. Integer pesewas: `priceGhs` above is the
  // human-authored figure from the workbook and is converted exactly once,
  // here, by cedisToPesewas.
  listPricePesewas?: number;
  payablePricePesewas?: number;
  promoLabel?: string;
  promoPercent?: number;
  promoEndsAt?: string;
  osList?: string[];
  requiresOsChoice?: boolean;
}

export interface Product {
  productId: string;
  productName: string; // customer-facing, always wins
  categoryId: string;
  description?: string;
  defaultContact?: string;
  imageUrl?: string;
  imagePath?: string;
  cardImagePath?: string;
  /** Optional wide artwork. Admin uploads are stored as a private Cloud
   *  Storage object path and exposed through the public catalogue image route. */
  bannerImagePath?: string;
  mobileBannerImagePath?: string;
  /** Installation images. Values may be migrated HTTPS URLs or private
   *  `catalogue/` object paths created by the admin portal. */
  screenshots?: string[];
  active: boolean;
  sortOrder?: number;
  /** Lower numbers appear first in the featured software section. */
  featuredOrder?: number;
  /** Admin-controlled single-device, single-version notice shown before purchase. */
  showSingleLicenceDisclaimer?: boolean;
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
  imagePath?: string;
  cardImagePath?: string;
  bannerImagePath?: string;
  mobileBannerImagePath?: string;
  screenshots?: string[];
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
  | 'datetime'
  /** Uploaded to Cloud Storage against an existing paid order. */
  | 'file';

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

/** A priced choice within a service, e.g. Turnitin's two check types.
 *
 *  `bulkPriceGhs` REPLACES `unitPriceGhs` for every unit once the quantity
 *  reaches `bulkFromQty` — it is not a tier applied only to the units above
 *  the threshold. See priceServiceLine in src/utils/money.ts. */
export interface ServiceOption {
  optionId: string;
  name: string;
  unitPriceGhs: number;
  bulkPriceGhs?: number;
  bulkFromQty?: number;
  sortOrder?: number;
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
  /** Present => the service is purchasable through the normal cart and
   *  checkout. Absent => it stays quote-only, as Data Analysis and
   *  Transcription are. Price lives on the option, never on the service. */
  options?: ServiceOption[];
  minQty?: number; // default 1
  maxQty?: number; // default 50
  /** Rendered verbatim before purchase. Never paraphrased or reformatted. */
  disclaimer?: string;
  active: boolean; // Status: 'Published' -> true
  sortOrder: number;
  imagePath?: string;
  cardImagePath?: string;
  bannerImagePath?: string;
  mobileBannerImagePath?: string;
  screenshots?: string[];
  /** Turnitin uses report-specific wording; other services may leave this off. */
  showDeliveryNotice?: boolean;
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
  /** Optional customer-facing copy for the “About this laptop” section. */
  description?: string;
  active: boolean; // Status: 'Published' -> true
  sortOrder: number;
  imagePath?: string;
  cardImagePath?: string;
  bannerImagePath?: string;
  mobileBannerImagePath?: string;
  screenshots?: string[];
}

export interface BundleContentOption {
  itemId: string;
  productId: string;
  productName: string;
  variantId: string;
  versionOrPlan: string;
  altGroup?: string;
  altLabel?: string;
  sortOrder: number;
  notes?: string;
}

export interface LandingSettings {
  desktopImagePath?: string;
  mobileImagePath?: string;
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
  cardImageUrl?: string;
  bannerImageUrl?: string;
  mobileBannerImageUrl?: string;
  screenshots?: string[];
  sortOrder: number;
  featuredOrder?: number;
  /** Integer pesewas. Absent means there is no single price to show — a
   *  service priced on enquiry, or a laptop with a blank price. Never
   *  rendered as 0. */
  pricePesewas?: number;
  listPricePesewas?: number;
  promoLabel?: string;
  promoPercent?: number;
  promoEndsAt?: string;
  /** Resolved from service configuration or its available software variants. */
  showDeliveryNotice?: boolean;
  showSingleLicenceDisclaimer?: boolean;
  availabilitySentence?: string;
  /** Display name of the item's category, resolved from the category document
   *  so the card does not have to look it up. */
  categoryName?: string;
  /** Operating systems this item can be delivered for, merged across variants. */
  osList?: string[];
  /** Derived from the variants: what the customer must supply to activate. */
  machineCodeType?: MachineCodeType;
  /** Services only: present when the service is purchasable. */
  options?: ServiceOption[];
  minQty?: number;
  maxQty?: number;
  disclaimer?: string;
  /** Products only. */
  variants?: Variant[];
  bundleContents?: BundleContentOption[];
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
  /** Signed cedi amount per catalogue item. Positive increases; negative decreases. */
  fixedAdjustmentsGhs?: Record<string, number>;
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
  /** Feature-level switch retained for backwards compatibility with the first pricing schema. */
  itemSpecificPromotion: PromotionRule;
  itemSpecificPromotions?: Array<PromotionRule & { targetId: string }>;
}

// ==========================================
// Orders
// ==========================================

export type PaymentStatus = 'pending' | 'paid';

export type FulfilmentStatus =
  | 'pending-payment'
  | 'awaiting-customer-input'
  /** Paid, but the customer has not sent the document yet. Kept separate from
   *  awaiting-seller-activation so the seller's queue shows only work that can
   *  actually be started. */
  | 'awaiting-document'
  /** Paid, but the licence pool held no available key for the variant. The
   *  order is valid and owed a licence; the owner must issue one. */
  | 'awaiting-licence'
  | 'awaiting-seller-activation'
  | 'ready';

export type FulfilmentMethod = 'automatic' | 'manual';

export interface TurnitinReportDocument {
  reportId: string;
  label: string;
  originalName: string;
  /** Private Cloud Storage path. Removed at the public order boundary. */
  storagePath?: string;
  sizeBytes?: number;
  uploadedAt: string;
}

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
  /** Units ordered. Services are bought in quantity; a software order is 1. */
  quantity?: number;
  /** Which service option was bought. Historical Turnitin rows recorded no
   *  option, so which check was purchased is unrecoverable from them —
   *  recording it from now on is a deliberate improvement. */
  serviceOptionId?: string;
  /** Integer pesewas — what Paystack is asked for and what its verification
   *  response is compared against. Never cedis: a float cedi amount cannot be
   *  compared for equality against Paystack's integer. */
  amountPesewas: number;
  originalAmountPesewas?: number;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  fulfilmentType?: string;
  fulfilmentMethod?: FulfilmentMethod;
  deliveryCodeType?: 'licence' | 'sales-code';
  customerInputType?: CustomerInputType;
  customerInputValue?: string;
  salesCode?: string;
  activationCodeOrKey?: string;
  licenceId?: string;
  /** Set when a paid auto-fulfil order found no available licence, so the gap
   *  is visible rather than silent. */
  licenceIssueNote?: string;
  activationWebsiteUrl?: string;
  /** One order, one reference, so re-verification never has to guess. */
  paystackReference?: string;
  /** Offline payments are deliberately distinguishable from Paystack. */
  paymentMethod?: 'paystack' | 'offline';
  offlinePaymentReference?: string;
  offlinePaymentReason?: string;
  /** Set when Paystack reports an amount or currency that does not match the
   *  order. Fulfilment is blocked and the seller is alerted: it needs a human. */
  paymentMismatchNote?: string;
  paidAt?: string;
  receiptSent?: boolean;
  emailStatus?: string;
  fulfilledAt?: string;
  notes?: string;
  windowsInstallerUrl?: string;
  parallelsInstallerUrl?: string;
  windows11DownloadUrl?: string;
  guideUrl?: string;
  learningResourcesUrl?: string;
  macViaParallels?: boolean;
  /** Cloud Storage object path, never a public URL. Retrieval is
   *  server-mediated: these are customers' unpublished academic documents. */
  documentPath?: string;
  documentUploadedAt?: string;
  documentUploadStatus?: 'pending' | 'uploaded' | 'failed';
  documentOriginalName?: string;
  documentSizeBytes?: number;
  documentSubmissionMethod?: 'upload' | 'whatsapp';
  documentReceivedAt?: string;
  /** Admin-delivered Turnitin reports. More than one labelled file may be attached. */
  reportDocuments?: TurnitinReportDocument[];
  /** Snapshotted when the order is created so later admin changes do not alter an existing promise. */
  showDeliveryNotice?: boolean;
  fulfilmentNoticeKind?: 'licence' | 'account' | 'report';
  /** Answers to the service's enquiry form. */
  serviceAnswers?: Record<string, unknown>;
  /** Seller-only notes. Never returned by the public phone lookup. */
  internalNotes?: Array<{
    text: string;
    actorUid: string;
    actorEmail?: string;
    createdAt: string;
  }>;
  /** Human-readable state changes for the admin order timeline. */
  fulfilmentHistory?: Array<{
    status: FulfilmentStatus;
    at: string;
    actorUid?: string;
    note?: string;
  }>;
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
  updatedAt?: string;
}

export interface AdminAuditEntry {
  auditId: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetType: 'order' | 'licence' | 'service' | 'announcement' | 'product' | 'bundle' | 'laptop' | 'category' | 'settings';
  targetId: string;
  orderId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
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
  landing?: {
    desktopImageUrl?: string;
    mobileImageUrl?: string;
  };
  activePromotion?: {
    label: string;
    percent: number;
    endsAt?: string;
  };
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
  environment: string;
  dataSource: string;
  currency: 'GHS';
  timezone: 'Africa/Accra';
  /** 'test' | 'live' | 'unconfigured', from the Paystack key's prefix. */
  paymentMode: string;
}
