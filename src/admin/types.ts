import { Announcement, Bundle, CatalogueItemKind, Category, CustomerRequest, LandingSettings, Laptop, LicencePoolEntry, Order, PaymentSettings, PricingConfig, Product, Service } from '../types';

export interface AdminMediaItem {
  kind: CatalogueItemKind | 'category';
  itemId: string;
  name: string;
  categoryId?: string;
  imageUrl?: string;
  imagePath?: string;
  cardImagePath?: string;
  iconImagePath?: string;
  bannerImagePath?: string;
  mobileBannerImagePath?: string;
  screenshots?: string[];
  sortOrder?: number;
  featuredOrder?: number;
}

export interface AdminLicence extends Omit<LicencePoolEntry, 'licenceCode'> {
  maskedCode: string;
  integrityWarning?: string;
}

export interface VariantSummary {
  variantId: string;
  productName: string;
  versionOrPlan: string;
}

export interface AdminData {
  orders: Order[];
  requests: CustomerRequest[];
  licences: AdminLicence[];
  services: Service[];
  announcements: Announcement[];
  products: Product[];
  bundles: Bundle[];
  laptops: Laptop[];
  mediaItems: AdminMediaItem[];
  categories: Category[];
  landing: LandingSettings;
  pricing: PricingConfig;
  payments: PaymentSettings;
  variants: VariantSummary[];
}

export interface ApiValidationError {
  row?: number;
  field?: string;
  message: string;
}
