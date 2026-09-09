export type BusinessCategory =
  | 'statistical-software'
  | 'research-services'
  | 'software-bundles'
  | 'laptops';

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
