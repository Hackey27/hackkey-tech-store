export type BusinessCategory =
  | 'statistical-software'
  | 'research-services'
  | 'software-bundles'
  | 'laptops';

export type MachineCodeType = 'lock-code' | 'hardware-id' | 'none' | 'service';

export interface ProductVariant {
  id: string;
  version: string;
  isRecommended?: boolean;
  osList: ('Windows' | 'Mac' | 'Windows & Mac' | 'Web / Cloud' | string)[];
  priceGhs: number;
}

export interface Category {
  id: BusinessCategory;
  name: string;
  shortDescription: string;
  representativeItems: string[];
}

export interface Product {
  id: string;
  name: string;
  categoryId: BusinessCategory;
  categoryName: string;
  isPlaceholder: true;
  placeholderLabel: string;
  description: string;
  details?: string[];
  referenceTypes?: string[];
  pricingNote?: string;
  status: 'available' | 'catalog-preview';
  osCompatibility?: ('Windows' | 'Mac' | 'Windows & Mac' | 'Web / Cloud')[];
  priceGhs?: number;
  minPriceGhs?: number;
  variants?: ProductVariant[];
  machineCodeType?: MachineCodeType;
  about?: string;
  features?: string[];
  systemRequirements?: string[];
  screenshots?: string[];
  installationGuide?: string;
}

export interface CatalogResponse {
  categories: Category[];
  products: Product[];
  totalProducts: number;
  source: 'google_sheets_placeholder_adapter' | 'google_sheets_live';
  timestamp: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
  environment: string;
  dataSource: string;
}
