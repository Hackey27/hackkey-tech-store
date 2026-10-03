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

/** Customer-facing, product-wide installation steps. Separate OS guides can
 * be edited without changing the version-specific download/licence URLs. */
export interface InstallationGuideImageConfig {
  src: string;
  alt: string;
  markers?: Array<{ x: number; y: number; label: string }>;
}

export interface InstallationGuideStepConfig {
  title: string;
  body: string;
  kind?: 'download' | 'command' | 'licence' | 'customer-input';
  optional?: boolean;
  images?: InstallationGuideImageConfig[];
  actionLabel?: string;
  actionUrl?: string;
}

export interface InstallationGuideConfig {
  title: string;
  caption?: string;
  steps: InstallationGuideStepConfig[];
}

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
  /** Optional product-wide term displayed beside the software name. This is
   * deliberately not stored on a version because it applies to the title as a whole. */
  licenceTerm?: string;
  /** Label for the interactive guide button on the customer's paid order. */
  installationButtonLabel?: string;
  /** Product-wide guides, split by operating system; version URLs stay on variants. */
  installationGuides?: { windows?: InstallationGuideConfig; macos?: InstallationGuideConfig };
  /** Show the older external installation-guide link beneath the order resources. */
  showInstallationGuideFallback?: boolean;
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
 *  the threshold. See priceServiceLine in shared/money.ts. */
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
  preorderCost?: RmbSourceCost;
  preorderDeliveryOptions?: PreorderDelivery[];
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
  preorderPricesPesewas?: Partial<Record<PreorderDelivery, number>>;
  kind: CatalogueItemKind;
  itemId: string;
  name: string;
  /** Software-only product-wide licence term, omitted when the admin leaves it blank. */
  licenceTerm?: string;
  installationButtonLabel?: string;
  installationGuides?: Product['installationGuides'];
  showInstallationGuideFallback?: boolean;
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

export type CheckoutPaymentMode = 'paystack' | 'momo' | 'both';

export type CustomerNotificationPurpose =
  | 'payment-reminder'
  | 'customer-input'
  | 'status-update'
  | 'complete'
  | 'turnitin-document'
  | 'turnitin-document-received'
  | 'turnitin-report';

export interface MomoPaymentDetails {
  merchantId: string;
  merchantName: string;
  transferNumber: string;
  transferName: string;
  whatsappNumber: string;
}

export interface PublicPaymentOptions {
  mode: CheckoutPaymentMode;
  momo: MomoPaymentDetails;
  updatedAt?: string;
}

export interface PaymentSettings extends PublicPaymentOptions {
  updatedBy?: string;
}

/**
 * One remote-support program the seller asks a customer to install, such as
 * AnyDesk or TeamViewer. Label and link are both seller-owned because the
 * download URLs move and the seller should not need a deploy to follow them.
 */
export interface SupportTool {
  /** Stable id, so reordering or renaming a tool does not create a new one. */
  toolId: string;
  label: string;
  url: string;
  /** Optional one-line instruction shown under the link. */
  note?: string;
  /** Hidden from customers while false, without losing the link. */
  active: boolean;
}

export interface SupportSettings {
  tools: SupportTool[];
  updatedAt?: string;
  updatedBy?: string;
}

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
  /** Payment choices offered when this order was created or last retried. */
  checkoutMode?: CheckoutPaymentMode;
  /** An administrator agreed that the customer will pay later. This does not
   * mean paid and never unlocks paid-only fulfilment or downloads. */
  paymentArrangement?: 'pay-later';
  paymentReminderDate?: string;
  paymentReminderScheduledAt?: string;
  paymentReminderScheduledBy?: string;
  paymentReminderSentAt?: string;
  paymentReminderProcessingAt?: string;
  paymentReminderPrimary?: boolean;
  /** Delivery state for the seller's pre-payment alert. Keeping this separate
   * from the customer receipt makes a missed lead visible and retryable. */
  sellerSubmissionAlertStatus?: 'pending' | 'sent' | 'failed';
  sellerSubmissionAlertSentAt?: string;
  sellerSubmissionAlertProviderId?: string;
  sellerSubmissionAlertError?: string;
  sellerSubmissionAlertAttempts?: number;
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
  /** Read-time product settings returned with a customer order lookup. They
   * are not stored in the order, so later admin edits reach existing buyers. */
  installationButtonLabel?: string;
  installationGuides?: Product['installationGuides'];
  showInstallationGuideFallback?: boolean;
  macViaParallels?: boolean;
  /** Hashes of bearer tokens created by the administrator for customer order links.
   * Raw tokens are never stored; several recent hashes remain valid so resending a
   * notification does not invalidate an earlier message. */
  customerAccessTokenHashes?: string[];
  customerAccessLinkCreatedAt?: string;
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
  | 'laptop-issue'
  | 'laptop-request'
  | 'laptop-enquiry'
  | 'custom-bundle'
  | 'humanizing'
  | 'software-request'
  | 'service-enquiry'
  /** "I could not find it in pre-orders — can you source this?" */
  | 'preorder-product';

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
  /** Seller notification state. Failed sends are retried by the authenticated
   * scheduler rather than silently disappearing. */
  sellerSubmissionAlertStatus?: 'pending' | 'sent' | 'failed';
  sellerSubmissionAlertSentAt?: string;
  sellerSubmissionAlertProviderId?: string;
  sellerSubmissionAlertError?: string;
  sellerSubmissionAlertAttempts?: number;
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
  targetType: 'hack-theme' | 'hack-post' | 'order' | 'licence' | 'service' | 'announcement' | 'product' | 'bundle' | 'laptop' | 'category' | 'settings' | 'preorder-product' | 'preorder-category' | 'preorder' | 'preorder-package';
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
  paymentOptions: PublicPaymentOptions;
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

/* ------------------------------------------------------------------------ *
 * Pre-order
 *
 * The sellable unit here is the COMBINATION, not the product. A combination
 * carries its own price and its own existence: if it was not assigned in the
 * admin portal it is not for sale. There is no stock quantity anywhere in this
 * model — a pre-order is an intent to buy, not a claim on inventory.
 *
 * Nothing here enters the `orders` collection. A pre-order has no payment, so
 * giving it a paymentStatus would create a field that must never be set and
 * would put it in the seller's paid-order queue.
 * ------------------------------------------------------------------------ */

export type PreorderDelivery = 'express' | 'two-months';

/** A named dimension with named options. Order drives selector order. */
export interface PreorderAxis {
  name: string;
  options: string[];
}

export interface PreorderCombination {
  sourceCost?: RmbSourceCost;
  /** Stable and addressable: the deferred search feature links to these. */
  combinationId: string;
  /** May be PARTIAL. `{Colour: 'Black'}` prices Black in any size. Empty for a
   *  product with no axes, which gets one implicit combination so that cart and
   *  pricing keep a single code path. */
  selections: Record<string, string>;
  /** Integer pesewas. Absent means this delivery option is not priced here. */
  priceExpressPesewas?: number;
  priceTwoMonthsPesewas?: number;
}

/** Partial in the same way combinations are: Colour-only covers every size. */
export interface PreorderImageAssignment {
  selections: Record<string, string>;
  imagePath: string;
}

export interface PreorderDetail {
  label: string;
  value: string;
}

export interface PreorderProduct {
  pricingMode?: 'manual' | 'rmb';
  productId: string;
  name: string;
  description: string;
  details: PreorderDetail[];
  categoryId: string;
  subcategoryId?: string;
  previewImagePath?: string;
  galleryImagePaths: string[];
  /** Empty for a product with no variants. */
  variantAxes: PreorderAxis[];
  /** At least one, always. */
  combinations: PreorderCombination[];
  imageAssignments: PreorderImageAssignment[];
  /** Which delivery options this product allows. At least one. */
  deliveryOptions: PreorderDelivery[];
  /** The seller has declared one price pair for the whole product. Purely the
   *  admin's intent: the price still lives on every combination, so nothing
   *  downstream has to know about this. It exists so that a combination added
   *  later inherits the price instead of silently arriving blank. */
  uniformPricing?: boolean;
  active: boolean;
  sortOrder?: number;
}

/**
 * What `GET /api/preorder/catalogue` returns.
 *
 * `products` holds only active products, and every image field carries a URL
 * the browser can load rather than the bucket path Firestore stores. The field
 * names are deliberately unchanged, so the shared resolver reads the browser's
 * copy and the server's copy through one code path.
 */
export interface PreorderCatalogueResponse {
  categories: PreorderCategory[];
  products: PreorderProduct[];
}

/** Two levels today via parentId, so a third is a data change not a migration. */
export interface PreorderCategory {
  categoryId: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
}

/**
 * Item lifecycle.
 *
 * `awaiting-order` is a PROVISIONAL name: the brief's diagram did not survive
 * the paste and names only the last four states, while saying the first two are
 * set per item. Rename it before the admin screens are built in pass 5.
 */
export type PreorderItemStatus =
  | 'awaiting-order'
  | 'delivered-in-china'
  | 'received-by-shipping'
  | 'received-in-ghana'
  | 'delivered-to-client';

/** The three a package owns. They cascade to every item inside it. */
export type PreorderPackageStatus =
  | 'delivered-in-china'
  | 'received-by-shipping'
  | 'received-in-ghana';

export interface PreorderCustomer {
  name: string;
  phone: string;
  email: string;
  location: string;
}

export interface PreorderItem {
  itemId: string;
  productId: string;
  combinationId: string;
  /** Copied at submission, e.g. "Black, XL", so the line still reads correctly
   *  after an axis is renamed. */
  selectionLabel: string;
  productName: string;
  delivery: PreorderDelivery;
  /** Integer pesewas, copied at submission. Prices change; past orders must not. */
  pricePesewas: number;
  quantity: number;
  status: PreorderItemStatus;
  /** Null until the item is grouped into a physical box. */
  packageId?: string | null;
}

export interface Preorder {
  preorderId: string;
  customer: PreorderCustomer;
  /** Status and packageId live on the item rather than in parallel maps, which
   *  drift out of step with the items they index. */
  items: PreorderItem[];
  submittedAt: string;
  lastUpdated: string;
  sellerAlertStatus?: 'pending' | 'sent' | 'failed';
  sellerAlertSentAt?: string;
  sellerAlertError?: string;
}

export interface PreorderPackage {
  /** Written on the physical box, so it is the document id too. */
  packageId: string;
  label: string;
  createdAt: string;
  lastUpdated: string;
  status: PreorderPackageStatus;
  /** Closed to new items once it leaves China. */
  closed: boolean;
}

/** Private source costs. Never returned by public catalogue endpoints. */
export interface RmbSourceCost {
  rawCostRmb: number;
  shippingExpressGhs?: number;
  shippingTwoMonthsGhs?: number;
}
export interface RmbAmountRange { minimum: number; maximum: number | null }
export interface RmbTransactionFee {
  /** Percentage of the full raw RMB payment, not just the excess. */
  percent: number;
  freeUpToRmb: number;
  maximumPaymentRmb: number;
}
export interface RmbPricingSettings {
  /** Optional only for reading legacy documents that predate bank modes. */
  bankChargeMode?: 'percentage_min' | 'ranges';
  bankChargeRateBps?: number;
  bankChargeMinimumGhs?: number;
  bankChargeMaximumGhs?: number | null;
  exchangeRate: number | null;
  bankCharges: Array<RmbAmountRange & { charge: number }>;
  transactionFee: RmbTransactionFee;
  profitMargins: Array<RmbAmountRange & { percent: number }>;
  updatedAt?: string;
  updatedBy?: string;
}
