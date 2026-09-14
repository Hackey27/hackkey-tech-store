// ==========================================
// 1. Core Catalogue Model (Sections 1.1 - 1.4)
// ==========================================

export type DeliverableType = 'Licence' | 'Sales Code' | 'Account' | 'Service';

export type CustomerInputType = 'Lock Code' | 'Hardware ID';

export type MachineCodeType = 'lock-code' | 'hardware-id' | 'none' | 'service';

export type BusinessCategory =
  | 'data-analysis'
  | 'research-services'
  | 'academic-writing'
  | 'graphic-design'
  | 'bundles'
  | 'laptops'
  | string;

export interface Category {
  category_id: string; // e.g. 'DATA', 'SERVICE', 'DESIGN', 'BUNDLE', 'LAPTOP'
  name: string; // Bold title
  tagline: string; // Explanatory line underneath
  icon: 'analytics' | 'service' | 'design' | 'bundle' | 'software' | string;
  sort_order: number;
  active: boolean;
  // UI legacy compatibility
  id?: string;
  shortDescription?: string;
  representativeItems?: string[];
}

export interface Variant {
  variant_id: string; // PK, e.g. 'WINPLS01', 'AMOS01'
  product_id: string; // FK
  product_name?: string; // Internal name, never shown to customers (1.1)
  version_or_plan: string; // e.g. '4.1.1.8', 'Perpetual', '1 Year'
  price_ghs: number; // Base price before pricing rules
  os: string;
  mac_via_parallels: boolean;
  available: boolean;
  latest: boolean; // Recommended version
  deliverable_type: DeliverableType;
  fulfilment_type: string; // e.g. 'Account', used for OS inference
  manual_delivery: boolean;
  auto_fulfil: boolean;
  licence_term: string; // e.g. 'Perpetual', '12 months'
  activation_link?: string;
  activation_link_live?: boolean;
  activation_mode?: string;
  windows_installer_url?: string;
  guide_url?: string;
  learning_resources_url?: string;
  notes?: string;

  // Resolved pricing fields (derived via pricing rules)
  list_price_ghs?: number;
  payable_price_ghs?: number;
  promo_label?: string;
  promo_percent?: number;

  // OS choice list derived via Section 1.3
  resolved_os_list?: string[];
  requires_os_choice?: boolean;

  // UI / Legacy compatibility fields
  id?: string;
  version?: string;
  priceGhs?: number;
  isRecommended?: boolean;
  osList?: string[];
}

export type ProductVariant = Variant;

export interface Product {
  product_id: string; // PK, e.g. 'PLS', 'AMOS', 'SPSS'
  product_name: string; // Customer-facing name; ALWAYS wins over variant name
  category_id: string; // FK -> Category
  category?: string; // Legacy display fallback
  image_url?: string;
  default_contact?: string;
  active: boolean;
  customer_input_type?: CustomerInputType; // Property of product record (4.2)
  description?: string;
  variants?: Variant[];

  // Resolved UI helpers
  availability_sentence?: string;
  min_price_ghs?: number;
  min_list_price_ghs?: number;
  has_promo?: boolean;

  // Legacy field compatibility
  id?: string;
  name?: string;
  platform?: string;
  installerUrl?: string;
  guideUrl?: string;
  learningResourcesUrl?: string;
  categoryId?: string;
  categoryName?: string;
  machineCodeType?: MachineCodeType;
  status?: 'available' | 'catalog-preview';
  osCompatibility?: string[];
  priceGhs?: number;
  price_ghs?: number;
  minPriceGhs?: number;
  about?: string;
  features?: string[];
  systemRequirements?: string[];
  screenshots?: string[];
  installationGuide?: string;
}

// ==========================================
// 2. Pricing Rules (Section 2)
// ==========================================

export interface SilentAdjustmentRule {
  active: boolean;
  percent: number; // between -100 and 500, non-zero
  target_ids: string[]; // empty means all
}

export interface PromotionRule {
  active: boolean;
  percent: number; // 1 to 99 percent
  label: string; // Customer-facing
  target_ids: string[];
  ends_at?: string; // ISO date string
}

export interface PricingConfig {
  silentAdjustment: SilentAdjustmentRule;
  globalPromotion: PromotionRule;
  itemSpecificPromotion: PromotionRule;
}

// ==========================================
// 3. Bundles (Section 3)
// ==========================================

export interface BundleItem {
  bundle_id: string;
  item_id: string;
  product_id: string;
  variant_id: string;
  alt_group?: string; // Blank = fixed, same value = alternatives
  alt_label?: string; // Choice prompt, default "Choose one"
  sort_order: number;
  notes?: string;

  // Hydrated for display
  product?: Product;
  variant?: Variant;
}

export interface Bundle {
  bundle_id: string;
  name: string;
  description: string;
  price_ghs: number; // Fixed bundle price, not a sum
  category_id: string; // normally 'BUNDLE'
  sort_order: number;
  active: boolean;
  items: BundleItem[];
  // Pricing rules
  list_price_ghs?: number;
  payable_price_ghs?: number;
  promo_label?: string;
  promo_percent?: number;
}

// ==========================================
// 4. Order Model & Lifecycle (Section 4)
// ==========================================

export type PaymentStatus = 'Pending' | 'Paid';

export type FulfilmentStatus =
  | 'Pending Payment'
  | 'Awaiting Customer Input'
  | 'Awaiting Seller Activation'
  | 'Ready';

export type FulfilmentMethod = 'Automatic' | 'Manual';

export interface Order {
  order_id: string;
  cart_id: string;
  order_date: string;
  last_updated: string;
  customer_name: string;
  phone: string;
  email: string;
  variant_id: string;
  product_name: string;
  version_or_plan: string;
  delivery_os: string;
  amount_ghs: number;
  original_amount_ghs?: number;
  payment_status: PaymentStatus;
  fulfilment_status: FulfilmentStatus;
  fulfilment_type?: string;
  fulfilment_method?: FulfilmentMethod;
  customer_input_type?: CustomerInputType;
  customer_input_value?: string;
  sales_code?: string;
  activation_code_or_key?: string;
  license_id?: string;
  activation_website_url?: string;
  paystack_reference?: string;
  receipt_sent?: boolean;
  email_status?: string;
  fulfilled_at?: string;
  notes?: string;

  // Associated links for ready licence
  windows_installer_url?: string;
  guide_url?: string;
  learning_resources_url?: string;
  mac_via_parallels?: boolean;
}

// Licence key in pool
export interface LicensePoolKey {
  license_id: string;
  variant_id: string;
  product_name: string;
  version_or_plan: string;
  license_code_or_key: string;
  code_type: 'Licence' | 'Sales Code';
  status: 'Available' | 'Assigned';
  assigned_order_id?: string;
  date_added: string;
  date_assigned?: string;
}

// ==========================================
// 5. Services Model (Section 5)
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
  service_id: string;
  name: string;
  tagline: string;
  description: string;
  instructions?: string;
  fields: ServiceField[];
  cta_label: string;
  cta_note?: string;
  status: 'Published' | 'Draft';
  sort_order: number;
}

export interface TurnitinOption {
  id: 'PLAG' | 'PLAG_AI';
  name: string;
  unit_price: number;
  bulk_price: number;
  bulk_from: number;
}

export interface ServiceSubmission {
  submission_id: string;
  service_id: string;
  service_name: string;
  customer_name: string;
  phone: string;
  email: string;
  deadline?: string;
  summary: string;
  answers: Record<string, any>;
  submitted_at: string;
}

// ==========================================
// 6. Laptops Model (Section 6)
// ==========================================

export interface LaptopListing {
  laptop_id: string;
  title: string;
  price_ghs?: number; // Blank means "Ask for price"
  brand: string;
  model: string;
  processor: string;
  ram: string;
  storage: string;
  screen: string;
  colour: string;
  graphics: 'Dedicated' | 'No dedicated card';
  graphics_details?: string;
  ports: string;
  operating_system: string;
  freebies?: string;
  pictures_url?: string;
  availability: 'Available' | 'Preorder';
  notes?: string;
  status: 'Active' | 'Inactive';
  sort_order: number;

  // Pricing rules
  list_price_ghs?: number;
  payable_price_ghs?: number;
  promo_label?: string;
  promo_percent?: number;
}

export interface LaptopRequestSubmission {
  request_id: string;
  customer_name: string;
  phone: string;
  email?: string;
  location?: string;
  budget: string;
  preferred_brand?: string;
  storage: string;
  ram: string;
  specs_notes?: string;
  purpose: string;
  condition: string;
  timeline: string;
  readiness: string;
  notes?: string;
  submitted_at: string;
}

export interface SoftwareRequestSubmission {
  request_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  software_name: string;
  website_url?: string;
  notes?: string;
  submitted_at: string;
}

// ==========================================
// 7. Announcement Pop-up (Section 8)
// ==========================================

export interface Announcement {
  id: string;
  title: string;
  message: string;
  button_text?: string;
  button_url?: string;
  show_once: boolean;
  active: boolean;
}

// ==========================================
// 8. API Response Interfaces
// ==========================================

export interface CatalogResponse {
  categories: Category[];
  products: Product[];
  bundles: Bundle[];
  services: Service[];
  laptops: LaptopListing[];
  totalProducts: number;
  source: string;
  timestamp: string;
  announcement?: Announcement;
  turnitinOptions?: TurnitinOption[];
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
