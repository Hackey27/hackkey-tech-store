import { Announcement, LicencePoolEntry, Order, Product, Service } from '../types';

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
  variants: VariantSummary[];
}

export interface ApiValidationError {
  row?: number;
  field?: string;
  message: string;
}
