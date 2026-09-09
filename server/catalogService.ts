import { sheetsDataSource, SheetsDataSource } from './sheetsDataSource';
import { CatalogResponse, Category, Product } from '../src/types';

export class CatalogService {
  private dataSource: SheetsDataSource;

  constructor(dataSource: SheetsDataSource = sheetsDataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Retrieves the full catalogue or a filtered subset by category or keyword.
   * This service sits between the HTTP router and the data source abstraction (Google Sheets).
   */
  public async getCatalog(categoryFilter?: string, searchQuery?: string): Promise<CatalogResponse> {
    const rawCatalog = await this.dataSource.fetchCatalog();
    let filteredProducts = [...rawCatalog.products];

    if (categoryFilter && categoryFilter !== 'all') {
      filteredProducts = filteredProducts.filter(
        p => p.categoryId.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      filteredProducts = filteredProducts.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          (p.referenceTypes && p.referenceTypes.some(r => r.toLowerCase().includes(q))) ||
          (p.details && p.details.some(d => d.toLowerCase().includes(q)))
      );
    }

    return {
      categories: rawCatalog.categories,
      products: filteredProducts,
      totalProducts: filteredProducts.length,
      source: rawCatalog.source,
      timestamp: new Date().toISOString()
    };
  }

  public async getCategories(): Promise<Category[]> {
    const catalog = await this.dataSource.fetchCatalog();
    return catalog.categories;
  }

  public async getProductById(id: string): Promise<Product | null> {
    const catalog = await this.dataSource.fetchCatalog();
    const found = catalog.products.find(p => p.id === id);
    return found || null;
  }

  public getDataSourceStatus(): { isConfigured: boolean } {
    return {
      isConfigured: this.dataSource.isConfigured()
    };
  }
}

export const catalogService = new CatalogService();
