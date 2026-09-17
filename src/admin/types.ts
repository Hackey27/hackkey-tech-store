import { Announcement, CatalogueItemKind, Category, LandingSettings, LicencePoolEntry, Order, Product, Service } from '../types';

export interface AdminMediaItem {
  kind: CatalogueItemKind | 'category';
  itemId: string;
  name: string;
  categoryId?: string;
  imageUrl?: string;
  imagePath?: string;
  bannerImagePath?: string;
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
  licences: AdminLicence[];
  services: Service[];
  announcements: Announcement[];
  products: Product[];
  mediaItems: AdminMediaItem[];
  categories: Category[];
  landing: LandingSettings;
  variants: VariantSummary[];
}

export interface ApiValidationError {
  row?: number;
  field?: string;
  message: string;
}
