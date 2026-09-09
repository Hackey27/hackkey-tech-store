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
          'Compatible with Windows & Mac',
          'Academic research license model'
        ],
        referenceTypes: ['Statistical Tool', 'Quantitative Analysis'],
        pricingNote: 'Prices in Ghana Cedis (GHS)',
        status: 'available',
        osCompatibility: ['Windows', 'Mac'],
        minPriceGhs: 180,
        machineCodeType: 'lock-code',
        variants: [
          { id: 'var-a-v29', version: 'v29.0', isRecommended: true, osList: ['Windows', 'Mac'], priceGhs: 240 },
          { id: 'var-a-v28', version: 'v28.0', isRecommended: false, osList: ['Windows', 'Mac'], priceGhs: 200 },
          { id: 'var-a-v26', version: 'v26.0', isRecommended: false, osList: ['Windows'], priceGhs: 180 }
        ],
        about: 'Sample Software A represents statistical software packages used by researchers and students for hypothesis testing, linear modeling, regression, and multivariate analysis.',
        features: [
          'Advanced statistical modeling modules',
          'Descriptive and inferential data procedures',
          'Cross-tabulations and graphical representations',
          'Automated data screening output'
        ],
        systemRequirements: [
          'Windows 10 / 11 (64-bit) or macOS 12 Monterey or newer',
          'Minimum 4 GB RAM (8 GB recommended)',
          '2 GB available disk storage'
        ],
        screenshots: [
          'Workspace analysis interface preview',
          'Output dataset and model summary'
        ],
        installationGuide: 'Download the authorized installer, run the setup wizard, open the Licence Authorization Wizard, and provide your Machine Lock Code for instant activation.'
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
          'Thematic and content coding workflow placeholder',
          'Multi-format audio, text, and PDF import'
        ],
        referenceTypes: ['Qualitative Analysis', 'Thematic Coding'],
        pricingNote: 'Prices in Ghana Cedis (GHS)',
        status: 'available',
        osCompatibility: ['Windows', 'Mac'],
        minPriceGhs: 220,
        machineCodeType: 'hardware-id',
        variants: [
          { id: 'var-b-2024', version: '2024', isRecommended: true, osList: ['Windows', 'Mac'], priceGhs: 290 },
          { id: 'var-b-2022', version: '2022', isRecommended: false, osList: ['Windows', 'Mac'], priceGhs: 220 }
        ],
        about: 'Sample Software B represents qualitative mixed-methods software for organizing, coding, and visualizing unstructured qualitative data.',
        features: [
          'Thematic text coding and matrix queries',
          'Mixed-methods visualization tools',
          'Team project merging capabilities'
        ],
        systemRequirements: [
          'Windows 10 / 11 or macOS 11 Big Sur or newer',
          '4 GB RAM minimum'
        ],
        installationGuide: 'Install software package, copy the displayed Hardware ID, and submit it during checkout for your license file.'
      },
      {
        id: 'placeholder-software-c',
        name: 'Sample Software C',
        categoryId: 'statistical-software',
        categoryName: 'Statistical & Data-Analysis Software',
        isPlaceholder: true,
        placeholderLabel: 'Generic Placeholder — Econometric Modeling Tool',
        description: 'Generic placeholder representing time-series and econometric forecasting tools with single straightforward license option.',
        details: [
          'Time-series forecasting and regression',
          'Single Windows platform edition'
        ],
        referenceTypes: ['Econometrics', 'Time Series'],
        pricingNote: 'Exact price in Ghana Cedis (GHS)',
        status: 'available',
        osCompatibility: ['Windows'],
        priceGhs: 195,
        machineCodeType: 'none',
        variants: [
          { id: 'var-c-single', version: 'Standard Edition', isRecommended: true, osList: ['Windows'], priceGhs: 195 }
        ],
        about: 'Sample Software C provides statistical analysis, forecasting, and econometric modeling for business, academic, and financial research.',
        features: [
          'Autoregressive distributed lag (ARDL) estimation',
          'Vector autoregression (VAR) & cointegration',
          'Panel data analysis'
        ],
        systemRequirements: ['Windows 10 / 11 (64-bit), 2 GB RAM'],
        installationGuide: 'Run the setup installer and input the provided serial key during the initial launch.'
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
          'Comprehensive similarity breakdown percentage',
          'Non-repository private submission pipeline',
          'Express delivery to WhatsApp or Email'
        ],
        referenceTypes: ['Originality Check', 'Turnitin Verification'],
        pricingNote: 'Per-document report in Ghana Cedis (GHS)',
        status: 'available',
        osCompatibility: ['Web / Cloud'],
        priceGhs: 35,
        machineCodeType: 'service',
        variants: [
          { id: 'var-serv-single', version: 'Single Document Check', isRecommended: true, osList: ['Web / Cloud'], priceGhs: 35 }
        ],
        about: 'Originality verification service for research papers, dissertations, and capstone projects. Files are screened safely without adding them to institutional repositories.',
        features: [
          'Detailed colour-coded matched sources report',
          'AI-generated text indicator breakdown',
          'Safe non-repository submission',
          'Fast turnaround (15–30 mins)'
        ],
        installationGuide: 'Upload or email your research draft along with your contact phone number. Your detailed PDF similarity report will be delivered directly via WhatsApp or Email.'
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
          'Data screening and formatting service',
          'Consultation with research analysts'
        ],
        referenceTypes: ['Transcription', 'Data Cleaning'],
        pricingNote: 'Starting rates in Ghana Cedis (GHS)',
        status: 'available',
        osCompatibility: ['Web / Cloud'],
        minPriceGhs: 120,
        machineCodeType: 'service',
        variants: [
          { id: 'var-serv-trans', version: 'Audio Transcription (per 30 min)', isRecommended: true, osList: ['Web / Cloud'], priceGhs: 120 },
          { id: 'var-serv-clean', version: 'Dataset Screening & Cleaning', isRecommended: false, osList: ['Web / Cloud'], priceGhs: 180 },
          { id: 'var-serv-analysis', version: 'Full Statistical Analysis & Writeup', isRecommended: false, osList: ['Web / Cloud'], priceGhs: 450 }
        ],
        about: 'Professional research support services for postgraduate scholars, research institutions, and development organizations.',
        features: [
          'Verbatim or clean transcript options',
          'Outlier checking and missing value replacement',
          'Standard APA format tables and figures'
        ]
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
          'Cost-effective multi-package option'
        ],
        referenceTypes: ['Multi-Product Bundle', 'Academic Suite'],
        pricingNote: 'Special bundle rate in Ghana Cedis (GHS)',
        status: 'available',
        osCompatibility: ['Windows', 'Mac'],
        priceGhs: 380,
        machineCodeType: 'none',
        variants: [
          { id: 'var-bundle-standard', version: 'Dual Research Suite', isRecommended: true, osList: ['Windows', 'Mac'], priceGhs: 380 }
        ],
        about: 'Save when ordering complementary software tools together. Ideal for mixed-methods graduate theses and research studies.',
        features: [
          'Both quantitative statistical modeling and qualitative coding tools included',
          'Full documentation and installation setup guide'
        ],
        installationGuide: 'You will receive download links and setup guides for both software packages upon order confirmation.'
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
        pricingNote: 'Hardware pricing in Ghana Cedis (GHS)',
        status: 'available',
        osCompatibility: ['Windows'],
        minPriceGhs: 4200,
        machineCodeType: 'service',
        variants: [
          { id: 'var-laptop-core-i5', version: 'Core i5 / 16GB RAM / 512GB SSD', isRecommended: true, osList: ['Windows'], priceGhs: 4200 },
          { id: 'var-laptop-core-i7', version: 'Core i7 / 32GB RAM / 1TB SSD', isRecommended: false, osList: ['Windows'], priceGhs: 5800 }
        ],
        about: 'Reliable research and analysis laptops thoroughly tested for demanding computational workloads, structural equation modeling, and multi-program multitasking.',
        features: [
          'High performance processors for computation',
          'Flicker-free anti-glare display for long research sessions',
          'Full hardware check and guarantee'
        ],
        installationGuide: 'Laptops can be collected in person or delivered nationwide across Ghana via VIP/STC parcel services with tracking.'
      }
    ];
  }
}

export const sheetsDataSource = new PlaceholderGoogleSheetsDataSource();
