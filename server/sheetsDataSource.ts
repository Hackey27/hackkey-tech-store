import { Category, Product, CatalogResponse } from '../src/types';

export interface GoogleSheetsConfig {
  spreadsheetId?: string;
  apiKey?: string;
  serviceAccountEmail?: string;
  privateKey?: string;
}

export interface SheetsDataSource {
  isConfigured(): boolean;
  fetchCatalog(): Promise<{
    categories: Category[];
    products: Product[];
    source: 'google_sheets_live' | 'google_sheets_placeholder_adapter';
  }>;
}

/**
 * Placeholder Google Sheets Data-Access Abstraction
 * 
 * Provides an extensible data-access layer designed to connect to Hack-Key Tech's
 * Google Sheets inventory and service spreadsheet.
 * 
 * When live Google Sheets credentials are provided via environment variables,
 * this abstraction will pull rows from the configured sheet.
 * In this Phase 1 read-only foundation, it safely provides clearly labelled
 * generic placeholders without real product records or hardcoded data.
 */
export class PlaceholderGoogleSheetsDataSource implements SheetsDataSource {
  private config: GoogleSheetsConfig;

  constructor() {
    this.config = {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      apiKey: process.env.GOOGLE_SHEETS_API_KEY,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    };
  }

  public isConfigured(): boolean {
    return Boolean(this.config.spreadsheetId && (this.config.apiKey || this.config.serviceAccountEmail));
  }

  public async fetchCatalog(): Promise<{
    categories: Category[];
    products: Product[];
    source: 'google_sheets_live' | 'google_sheets_placeholder_adapter';
  }> {
    // If live credentials are provided in future phases, the integration hook goes here:
    if (this.isConfigured()) {
      try {
        console.log(`[GoogleSheetsDataSource] Configured spreadsheet ID detected: ${this.config.spreadsheetId}`);
        // Live Google Sheets API v4 row parser hook
        // return await this.fetchFromLiveSheet();
      } catch (err) {
        console.error('[GoogleSheetsDataSource] Error fetching from live sheet, falling back to placeholder adapter:', err);
      }
    }

    // Default Phase 1: Placeholder adapter with clearly labelled generic placeholders
    return {
      categories: this.getInitialCategories(),
      products: this.getGenericPlaceholderProducts(),
      source: 'google_sheets_placeholder_adapter'
    };
  }

  private getInitialCategories(): Category[] {
    return [
      {
        id: 'statistical-software',
        name: 'Statistical & Data-Analysis Software',
        shortDescription: 'Dedicated tools for statistical modeling, structural equation modeling, and qualitative analysis.',
        representativeItems: ['SmartPLS', 'SPSS', 'AMOS', 'NVivo', 'MAXQDA', 'Mplus', 'EViews']
      },
      {
        id: 'research-services',
        name: 'Research Services',
        shortDescription: 'Professional research assistance, originality reports, data screening, and audio transcription.',
        representativeItems: ['Turnitin Similarity Checks', 'Data Analysis Consultations', 'Transcription Services']
      },
      {
        id: 'software-bundles',
        name: 'Software Bundles',
        shortDescription: 'Curated combinations of statistical and qualitative software packages for research workflows.',
        representativeItems: ['Quantitative Research Suites', 'Mixed-Methods Toolkits', 'Graduate Student Bundles']
      },
      {
        id: 'laptops',
        name: 'Laptops',
        shortDescription: 'Optimized computing hardware for data-intensive processing, statistical computing, and multitasking.',
        representativeItems: ['Data Analysis Workstations', 'Research Laptops']
      }
    ];
  }

  /**
   * Only clearly labelled generic placeholders as instructed.
   * Real product data must not be hardcoded.
   */
  private getGenericPlaceholderProducts(): Product[] {
    return [
      {
        id: 'placeholder-software-a',
        name: 'Sample Software A',
        categoryId: 'statistical-software',
        categoryName: 'Statistical & Data-Analysis Software',
        isPlaceholder: true,
        placeholderLabel: 'Generic Placeholder — Statistical Software',
        description: 'Generic placeholder representing statistical and data-analysis software products (e.g. SmartPLS, SPSS, AMOS, NVivo, MAXQDA, Mplus, EViews) to be populated from the inventory sheet.',
        details: [
          'Statistical computing environment placeholder',
          'Compatible with Windows & macOS',
          'Single-user research license model'
        ],
        referenceTypes: ['Statistical Tool', 'Quantitative Analysis'],
        pricingNote: 'Pricing managed via Google Sheets inventory',
        status: 'catalog-preview'
      },
      {
        id: 'placeholder-software-b',
        name: 'Sample Software B',
        categoryId: 'statistical-software',
        categoryName: 'Statistical & Data-Analysis Software',
        isPlaceholder: true,
        placeholderLabel: 'Generic Placeholder — Qualitative / Structural Tool',
        description: 'Generic placeholder representing qualitative and structural equation analysis tools to be synced from the Google Sheets backend.',
        details: [
          'Qualitative and thematic coding workflow placeholder',
          'Cross-platform data project support'
        ],
        referenceTypes: ['Qualitative Analysis', 'Thematic Coding'],
        pricingNote: 'Pricing managed via Google Sheets inventory',
        status: 'catalog-preview'
      },
      {
        id: 'placeholder-service-a',
        name: 'Sample Research Service A',
        categoryId: 'research-services',
        categoryName: 'Research Services',
        isPlaceholder: true,
        placeholderLabel: 'Generic Placeholder — Turnitin Similarity Check',
        description: 'Generic placeholder for academic document similarity checks, digital originality reports, and AI detection screening services.',
        details: [
          'Document similarity report generation placeholder',
          'Non-repository private submission pipeline',
          'Express delivery timeframe'
        ],
        referenceTypes: ['Originality Check', 'Turnitin Verification'],
        pricingNote: 'Per-document or word-count rate in sheet',
        status: 'catalog-preview'
      },
      {
        id: 'placeholder-service-b',
        name: 'Sample Research Service B',
        categoryId: 'research-services',
        categoryName: 'Research Services',
        isPlaceholder: true,
        placeholderLabel: 'Generic Placeholder — Data Analysis & Transcription',
        description: 'Generic placeholder for research audio transcription, survey data cleaning, coding, and statistical summary reporting.',
        details: [
          'Interview audio transcription placeholder',
          'Data screening and formatting service'
        ],
        referenceTypes: ['Transcription', 'Data Cleaning'],
        pricingNote: 'Hourly or per-audio-minute rate in sheet',
        status: 'catalog-preview'
      },
      {
        id: 'placeholder-bundle-a',
        name: 'Sample Software Bundle A',
        categoryId: 'software-bundles',
        categoryName: 'Software Bundles',
        isPlaceholder: true,
        placeholderLabel: 'Generic Placeholder — Research Software Bundle',
        description: 'Generic placeholder representing multi-software combination packages for postgraduate and academic research projects.',
        details: [
          'Combined quantitative + qualitative tools bundle',
          'Special package pricing model'
        ],
        referenceTypes: ['Multi-Product Bundle', 'Academic Suite'],
        pricingNote: 'Bundle discount pricing managed in sheet',
        status: 'catalog-preview'
      },
      {
        id: 'placeholder-laptop-a',
        name: 'Sample Laptop A',
        categoryId: 'laptops',
        categoryName: 'Laptops',
        isPlaceholder: true,
        placeholderLabel: 'Generic Placeholder — Performance Data Workstation',
        description: 'Generic placeholder representing high-performance laptops configured for heavy statistical computing, multi-threaded datasets, and virtualized workflows.',
        details: [
          'High RAM capacity for large datasets',
          'Fast NVMe storage and multi-core CPU',
          'Pre-configured analysis environment optional'
        ],
        referenceTypes: ['Hardware', 'Laptop Workstation'],
        pricingNote: 'Hardware pricing and availability managed in sheet',
        status: 'catalog-preview'
      }
    ];
  }
}

export const sheetsDataSource = new PlaceholderGoogleSheetsDataSource();
