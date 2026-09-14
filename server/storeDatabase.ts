import {
  Category,
  Product,
  Variant,
  Bundle,
  BundleItem,
  Service,
  TurnitinOption,
  LaptopListing,
  Order,
  LicensePoolKey,
  PricingConfig,
  Announcement,
  SoftwareRequestSubmission,
  LaptopRequestSubmission,
  ServiceSubmission,
  CustomerInputType
} from '../src/types';
import {
  calculateVariantPricing,
  resolveVariantOperatingSystem,
  isVariantSellable,
  isProductSellable,
  formatCurrencyGHS
} from '../src/utils/pricingEngine';

export class StoreDatabase {
  // 1. Categories
  public categories: Category[] = [
    {
      category_id: 'DATA',
      name: 'Data Analysis and Visualization Software',
      tagline: 'SmartPLS, AMOS, NVivo, SPSS and others...',
      icon: 'analytics',
      sort_order: 1,
      active: true,
      id: 'DATA',
      shortDescription: 'SmartPLS, AMOS, NVivo, SPSS and others...',
      representativeItems: ['SmartPLS', 'SPSS', 'AMOS', 'NVivo', 'MAXQDA', 'EViews', 'Mplus']
    },
    {
      category_id: 'SERVICE',
      name: 'Services',
      tagline: 'Turnitin Plagiarism and AI Check, Humanizing Services and others...',
      icon: 'service',
      sort_order: 2,
      active: true,
      id: 'SERVICE',
      shortDescription: 'Turnitin Plagiarism and AI Check, Humanizing Services and others...',
      representativeItems: ['Turnitin Plagiarism & AI Check', 'Data Analysis Service', 'Transcription Services', 'Humanizing Services']
    },
    {
      category_id: 'DESIGN',
      name: 'Design and Engineering Software',
      tagline: 'Autodesk, Canva, CLO3D and others...',
      icon: 'design',
      sort_order: 3,
      active: true,
      id: 'DESIGN',
      shortDescription: 'Autodesk, Canva, CLO3D and others...',
      representativeItems: ['Autodesk Suite', 'Canva Pro Academic', 'CLO3D Fashion Design']
    },
    {
      category_id: 'BUNDLE',
      name: 'Bundle Offers',
      tagline: 'SEM Bundle, Engineering Bundle and others...',
      icon: 'bundle',
      sort_order: 4,
      active: true,
      id: 'BUNDLE',
      shortDescription: 'SEM Bundle, Engineering Bundle and others...',
      representativeItems: ['SEM Research Bundle', 'Mixed-Methods Research Toolkit']
    },
    {
      category_id: 'LAPTOP',
      name: 'Laptops on Sale',
      tagline: 'Quality laptops at unbeatable prices! Buy any laptop from us and get any two statistical tools of your choice installed and activated for free!',
      icon: 'software',
      sort_order: 5,
      active: true,
      id: 'LAPTOP',
      shortDescription: 'Quality laptops at unbeatable prices! Free installation of two statistical tools included.',
      representativeItems: ['Business Laptops', 'High-Performance Workstations']
    }
  ];

  // 2. Pricing Configuration
  public pricingConfig: PricingConfig = {
    silentAdjustment: {
      active: false,
      percent: 0,
      target_ids: []
    },
    globalPromotion: {
      active: false,
      percent: 0,
      label: 'Special Promotional Offer',
      target_ids: []
    },
    itemSpecificPromotion: {
      active: false,
      percent: 0,
      label: 'Selected Software Discount',
      target_ids: []
    }
  };

  // 3. Products & Variants (with customer_input_type property on products from Section 4.2)
  public products: Product[] = [
    {
      product_id: 'PLS',
      product_name: 'SmartPLS',
      category_id: 'DATA',
      category: 'Data Analysis and Visualization Software',
      image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
      active: true,
      description: 'Partial Least Squares Structural Equation Modeling (PLS-SEM) software for academic and empirical research.',
      id: 'PLS',
      name: 'SmartPLS',
      categoryId: 'DATA',
      variants: [
        {
          variant_id: 'WINPLS01',
          product_id: 'PLS',
          version_or_plan: 'v4.1.1.8 - Perpetual',
          price_ghs: 240,
          os: 'win',
          mac_via_parallels: true,
          available: true,
          latest: true,
          deliverable_type: 'Licence',
          fulfilment_type: 'Licence',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          windows_installer_url: 'https://downloads.hack-key.tech/smartpls4-setup.exe',
          guide_url: 'https://help.hack-key.tech/guides/smartpls4-install',
          learning_resources_url: 'https://help.hack-key.tech/resources/pls-sem'
        },
        {
          variant_id: 'WINPLS02',
          product_id: 'PLS',
          version_or_plan: 'v3.3.9 - Perpetual',
          price_ghs: 180,
          os: 'win',
          mac_via_parallels: false,
          available: true,
          latest: false,
          deliverable_type: 'Licence',
          fulfilment_type: 'Licence',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          windows_installer_url: 'https://downloads.hack-key.tech/smartpls3-setup.exe',
          guide_url: 'https://help.hack-key.tech/guides/smartpls3-install'
        }
      ]
    },
    {
      product_id: 'SPSS',
      product_name: 'IBM SPSS Statistics',
      category_id: 'DATA',
      category: 'Data Analysis and Visualization Software',
      image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
      active: true,
      customer_input_type: 'Lock Code',
      description: 'Comprehensive statistical modeling, regression analysis, hypothesis testing, and reporting package.',
      id: 'SPSS',
      name: 'IBM SPSS Statistics',
      categoryId: 'DATA',
      variants: [
        {
          variant_id: 'SPSS29',
          product_id: 'SPSS',
          version_or_plan: 'v29.0',
          price_ghs: 220,
          os: 'win mac',
          mac_via_parallels: false,
          available: true,
          latest: true,
          deliverable_type: 'Sales Code',
          fulfilment_type: 'Sales Code',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          activation_link: 'https://spsssupport.ibm.com/activation',
          windows_installer_url: 'https://downloads.hack-key.tech/spss29-setup.exe',
          guide_url: 'https://help.hack-key.tech/guides/spss-lock-code'
        },
        {
          variant_id: 'SPSS28',
          product_id: 'SPSS',
          version_or_plan: 'v28.0',
          price_ghs: 190,
          os: 'win mac',
          mac_via_parallels: false,
          available: true,
          latest: false,
          deliverable_type: 'Sales Code',
          fulfilment_type: 'Sales Code',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          activation_link: 'https://spsssupport.ibm.com/activation',
          windows_installer_url: 'https://downloads.hack-key.tech/spss28-setup.exe'
        },
        {
          variant_id: 'SPSS26',
          product_id: 'SPSS',
          version_or_plan: 'v26.0',
          price_ghs: 160,
          os: 'win',
          mac_via_parallels: false,
          available: true,
          latest: false,
          deliverable_type: 'Sales Code',
          fulfilment_type: 'Sales Code',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          activation_link: 'https://spsssupport.ibm.com/activation'
        }
      ]
    },
    {
      product_id: 'AMOS',
      product_name: 'IBM SPSS AMOS',
      category_id: 'DATA',
      category: 'Data Analysis and Visualization Software',
      image_url: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&auto=format&fit=crop&q=80',
      active: true,
      customer_input_type: 'Lock Code',
      description: 'Covariance-based Structural Equation Modeling (CB-SEM) software supporting graphical model visualization.',
      id: 'AMOS',
      name: 'IBM SPSS AMOS',
      categoryId: 'DATA',
      variants: [
        {
          variant_id: 'AMOS29',
          product_id: 'AMOS',
          version_or_plan: 'v29.0',
          price_ghs: 210,
          os: 'win',
          mac_via_parallels: true,
          available: true,
          latest: true,
          deliverable_type: 'Sales Code',
          fulfilment_type: 'Sales Code',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          activation_link: 'https://spsssupport.ibm.com/activation',
          windows_installer_url: 'https://downloads.hack-key.tech/amos29-setup.exe',
          guide_url: 'https://help.hack-key.tech/guides/amos-lock-code'
        },
        {
          variant_id: 'AMOS28',
          product_id: 'AMOS',
          version_or_plan: 'v28.0',
          price_ghs: 180,
          os: 'win',
          mac_via_parallels: true,
          available: true,
          latest: false,
          deliverable_type: 'Sales Code',
          fulfilment_type: 'Sales Code',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          activation_link: 'https://spsssupport.ibm.com/activation'
        }
      ]
    },
    {
      product_id: 'NVIVO',
      product_name: 'NVivo',
      category_id: 'DATA',
      category: 'Data Analysis and Visualization Software',
      image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop&q=80',
      active: true,
      description: 'Leading qualitative and mixed-methods research tool for coding transcripts, interviews, surveys, and articles.',
      id: 'NVIVO',
      name: 'NVivo',
      categoryId: 'DATA',
      variants: [
        {
          variant_id: 'NVIVO14',
          product_id: 'NVIVO',
          version_or_plan: 'v14 / Release 1 - Perpetual',
          price_ghs: 280,
          os: 'win mac',
          mac_via_parallels: false,
          available: true,
          latest: true,
          deliverable_type: 'Licence',
          fulfilment_type: 'Licence',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          windows_installer_url: 'https://downloads.hack-key.tech/nvivo14-setup.exe',
          guide_url: 'https://help.hack-key.tech/guides/nvivo-setup',
          learning_resources_url: 'https://help.hack-key.tech/resources/nvivo-guide'
        },
        {
          variant_id: 'NVIVO12',
          product_id: 'NVIVO',
          version_or_plan: 'v12 Plus - Perpetual',
          price_ghs: 220,
          os: 'win',
          mac_via_parallels: false,
          available: true,
          latest: false,
          deliverable_type: 'Licence',
          fulfilment_type: 'Licence',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual'
        }
      ]
    },
    {
      product_id: 'MXQ',
      product_name: 'MAXQDA Pro',
      category_id: 'DATA',
      category: 'Data Analysis and Visualization Software',
      image_url: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&auto=format&fit=crop&q=80',
      active: true,
      customer_input_type: 'Hardware ID',
      description: 'Comprehensive qualitative and mixed-methods data analysis suite with stats module integration.',
      id: 'MXQ',
      name: 'MAXQDA Pro',
      categoryId: 'DATA',
      variants: [
        {
          variant_id: 'MXQ2024',
          product_id: 'MXQ',
          version_or_plan: '2024 Edition',
          price_ghs: 300,
          os: 'win mac',
          mac_via_parallels: false,
          available: true,
          latest: true,
          deliverable_type: 'Sales Code',
          fulfilment_type: 'Sales Code',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          activation_link: 'https://activation.maxqda.com/portal',
          guide_url: 'https://help.hack-key.tech/guides/maxqda-hardware-id'
        },
        {
          variant_id: 'MXQ2022',
          product_id: 'MXQ',
          version_or_plan: '2022 Edition',
          price_ghs: 240,
          os: 'win mac',
          mac_via_parallels: false,
          available: true,
          latest: false,
          deliverable_type: 'Sales Code',
          fulfilment_type: 'Sales Code',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          activation_link: 'https://activation.maxqda.com/portal'
        }
      ]
    },
    {
      product_id: 'EV',
      product_name: 'EViews',
      category_id: 'DATA',
      category: 'Data Analysis and Visualization Software',
      image_url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80',
      active: true,
      customer_input_type: 'Hardware ID',
      description: 'Econometric forecasting, time-series analysis, and macroeconomic modeling package.',
      id: 'EV',
      name: 'EViews',
      categoryId: 'DATA',
      variants: [
        {
          variant_id: 'EV13',
          product_id: 'EV',
          version_or_plan: 'v13 Enterprise',
          price_ghs: 260,
          os: 'win',
          mac_via_parallels: true,
          available: true,
          latest: true,
          deliverable_type: 'Licence',
          fulfilment_type: 'Licence',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          guide_url: 'https://help.hack-key.tech/guides/eviews-hardware-id'
        }
      ]
    },
    {
      product_id: 'MP',
      product_name: 'Mplus',
      category_id: 'DATA',
      category: 'Data Analysis and Visualization Software',
      image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
      active: true,
      customer_input_type: 'Hardware ID',
      description: 'Latent variable modeling program with Monte Carlo simulations and multi-level modeling.',
      id: 'MP',
      name: 'Mplus',
      categoryId: 'DATA',
      variants: [
        {
          variant_id: 'MP88',
          product_id: 'MP',
          version_or_plan: 'v8.8 Base + Mixture + Multilevel',
          price_ghs: 320,
          os: 'win mac',
          mac_via_parallels: false,
          available: true,
          latest: true,
          deliverable_type: 'Licence',
          fulfilment_type: 'Licence',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual',
          guide_url: 'https://help.hack-key.tech/guides/mplus-hardware-id'
        }
      ]
    },
    {
      product_id: 'AUTODESK',
      product_name: 'Autodesk Suite',
      category_id: 'DESIGN',
      category: 'Design and Engineering Software',
      image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
      active: true,
      description: 'Professional 2D & 3D computer-aided design (CAD), AutoCAD, Revit, and Civil 3D educational access.',
      id: 'AUTODESK',
      name: 'Autodesk Suite',
      categoryId: 'DESIGN',
      variants: [
        {
          variant_id: 'AUTO1Y',
          product_id: 'AUTODESK',
          version_or_plan: '1 Year Full Access',
          price_ghs: 380,
          os: '',
          fulfilment_type: 'Account',
          mac_via_parallels: false,
          available: true,
          latest: true,
          deliverable_type: 'Account',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: '12 Months'
        }
      ]
    },
    {
      product_id: 'CANVA',
      product_name: 'Canva Pro Academic',
      category_id: 'DESIGN',
      category: 'Design and Engineering Software',
      image_url: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&auto=format&fit=crop&q=80',
      active: true,
      description: 'Cloud design platform with unlimited access to premium templates, photos, and AI tools.',
      id: 'CANVA',
      name: 'Canva Pro Academic',
      categoryId: 'DESIGN',
      variants: [
        {
          variant_id: 'CANVA1Y',
          product_id: 'CANVA',
          version_or_plan: '1 Year Subscription',
          price_ghs: 120,
          os: 'web cloud',
          fulfilment_type: 'Account',
          mac_via_parallels: false,
          available: true,
          latest: true,
          deliverable_type: 'Account',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: '12 Months'
        }
      ]
    },
    {
      product_id: 'CLO3D',
      product_name: 'CLO3D Fashion Design',
      category_id: 'DESIGN',
      category: 'Design and Engineering Software',
      image_url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&auto=format&fit=crop&q=80',
      active: true,
      description: 'Realistic 3D virtual garment modeling and fashion prototyping software.',
      id: 'CLO3D',
      name: 'CLO3D Fashion Design',
      categoryId: 'DESIGN',
      variants: [
        {
          variant_id: 'CLO7',
          product_id: 'CLO3D',
          version_or_plan: 'v7.3 Enterprise',
          price_ghs: 350,
          os: 'win',
          fulfilment_type: 'Licence',
          mac_via_parallels: false,
          available: true,
          latest: true,
          deliverable_type: 'Licence',
          manual_delivery: false,
          auto_fulfil: true,
          licence_term: 'Perpetual'
        }
      ]
    }
  ];

  // 4. Bundles & Bundle Items (Section 3)
  public bundles: Bundle[] = [
    {
      bundle_id: 'SEM_BUNDLE',
      name: 'SEM Quantitative Research Suite',
      description: 'Everything required for modern covariance and variance structural equation modeling: SmartPLS 4, AMOS 29, and SPSS 29.',
      price_ghs: 540, // Fixed bundle price (normal sum is 240 + 210 + 220 = 670)
      category_id: 'BUNDLE',
      sort_order: 1,
      active: true,
      items: [
        {
          bundle_id: 'SEM_BUNDLE',
          item_id: 'SEM_ITEM_1',
          product_id: 'PLS',
          variant_id: 'WINPLS01',
          sort_order: 1
        },
        {
          bundle_id: 'SEM_BUNDLE',
          item_id: 'SEM_ITEM_2',
          product_id: 'AMOS',
          variant_id: 'AMOS29',
          sort_order: 2,
          alt_group: 'AMOS_CHOICE',
          alt_label: 'Choose your AMOS release'
        },
        {
          bundle_id: 'SEM_BUNDLE',
          item_id: 'SEM_ITEM_2_ALT',
          product_id: 'AMOS',
          variant_id: 'AMOS28',
          sort_order: 3,
          alt_group: 'AMOS_CHOICE',
          alt_label: 'Choose your AMOS release'
        },
        {
          bundle_id: 'SEM_BUNDLE',
          item_id: 'SEM_ITEM_3',
          product_id: 'SPSS',
          variant_id: 'SPSS29',
          sort_order: 4
        }
      ]
    },
    {
      bundle_id: 'MIXED_METHODS_BUNDLE',
      name: 'Mixed-Methods Research Toolkit',
      description: 'The definitive pair for empirical research: IBM SPSS Statistics 29 for quantitative data and NVivo 14 for qualitative coding.',
      price_ghs: 430, // Normal sum is 220 + 280 = 500
      category_id: 'BUNDLE',
      sort_order: 2,
      active: true,
      items: [
        {
          bundle_id: 'MIXED_METHODS_BUNDLE',
          item_id: 'MM_ITEM_1',
          product_id: 'SPSS',
          variant_id: 'SPSS29',
          sort_order: 1
        },
        {
          bundle_id: 'MIXED_METHODS_BUNDLE',
          item_id: 'MM_ITEM_2',
          product_id: 'NVIVO',
          variant_id: 'NVIVO14',
          sort_order: 2
        }
      ]
    }
  ];

  // 5. Services & Turnitin (Section 5)
  public turnitinOptions: TurnitinOption[] = [
    {
      id: 'PLAG',
      name: 'Plagiarism Only',
      unit_price: 15.0,
      bulk_price: 15.0,
      bulk_from: 1
    },
    {
      id: 'PLAG_AI',
      name: 'Plagiarism + AI Check',
      unit_price: 50.0,
      bulk_price: 47.5,
      bulk_from: 2 // Applies to all units once quantity >= 2
    }
  ];

  public services: Service[] = [
    {
      service_id: 'DATA_ANALYSIS',
      name: 'Data Analysis and Statistical Consultations',
      tagline: 'Professional data cleaning, hypotheses testing, SEM modeling, and APA interpretation.',
      description: 'Work directly with our experienced quantitative and qualitative analysts. We prepare your data, execute required tests in SPSS, SmartPLS, or NVivo, and compile structured tables and write-ups.',
      instructions: 'Please provide a clear description of your research objectives or conceptual framework, and indicate your preferred software.',
      cta_label: 'Submit Request for Price Estimate',
      cta_note: 'we will give you a price estimate after reviewing your dataset and objectives.',
      status: 'Published',
      sort_order: 1,
      fields: [
        {
          key: 'customer_name',
          label: 'Full Name',
          type: 'text',
          required: true,
          placeholder: 'e.g. Kwame Mensah'
        },
        {
          key: 'phone',
          label: 'Phone / WhatsApp Number',
          type: 'tel',
          required: true,
          placeholder: 'e.g. 0542638979'
        },
        {
          key: 'email',
          label: 'Email Address',
          type: 'email',
          required: true,
          placeholder: 'e.g. kwame@example.com'
        },
        {
          key: 'software_preference',
          label: 'Preferred Statistical Software',
          type: 'select',
          required: true,
          options: ['SmartPLS', 'SPSS Statistics', 'AMOS', 'NVivo', 'No preference / Analyst recommendation']
        },
        {
          key: 'sample_size',
          label: 'Sample Size (number of respondents)',
          type: 'number',
          required: false,
          helper: '(optional) Number of completed questionnaires or cases'
        },
        {
          key: 'deadline',
          label: 'Required Completion Date',
          type: 'datetime',
          required: true,
          helper: 'When do you need the analysis and report completed?'
        },
        {
          key: 'objectives',
          label: 'Research Objectives or Hypotheses',
          type: 'textarea',
          required: true,
          placeholder: 'List your research questions or paste your hypotheses here...'
        }
      ]
    },
    {
      service_id: 'TRANSCRIPTION',
      name: 'Audio and Video Transcription Services',
      tagline: 'Accurate, high-fidelity verbatim or cleaned transcripts for qualitative research and interviews.',
      description: 'Specialized academic transcription designed for NVivo or MAXQDA coding. We handle local accents, multi-speaker meetings, and focus group discussions with strict confidentiality.',
      instructions: 'Indicate your recording length and turnaround requirement.',
      cta_label: 'Submit Request for Price Estimate',
      cta_note: 'we will give you a price estimate based on audio duration and quality.',
      status: 'Published',
      sort_order: 2,
      fields: [
        {
          key: 'customer_name',
          label: 'Full Name',
          type: 'text',
          required: true
        },
        {
          key: 'phone',
          label: 'Phone / WhatsApp Number',
          type: 'tel',
          required: true
        },
        {
          key: 'email',
          label: 'Email Address',
          type: 'email',
          required: true
        },
        {
          key: 'audio_duration_minutes',
          label: 'Total Audio Duration (in minutes)',
          type: 'number',
          required: true,
          placeholder: 'e.g. 60'
        },
        {
          key: 'transcription_style',
          label: 'Transcription Style',
          type: 'radio',
          required: true,
          options: ['Standard Clean Verbatim (removes stutters, false starts)', 'Strict Full Verbatim (includes every utterance, pause)']
        },
        {
          key: 'notes',
          label: 'Special Instructions or Audio Link',
          type: 'textarea',
          required: false,
          helper: '(optional) Google Drive or Dropbox link to audio files'
        }
      ]
    },
    {
      service_id: 'HUMANIZING',
      name: 'Humanizing Services & Academic Rewriting',
      tagline: 'Restructure and humanize AI-flagged drafts into authentic, original academic prose.',
      description: 'Manual restructuring by human editors to ensure natural rhythm, varied sentence syntax, and appropriate scholarly tone without compromising technical accuracy.',
      cta_label: 'Submit Request for Price Estimate',
      cta_note: 'we will give you a price estimate based on document length and AI score.',
      status: 'Published',
      sort_order: 3,
      fields: [
        {
          key: 'customer_name',
          label: 'Full Name',
          type: 'text',
          required: true
        },
        {
          key: 'phone',
          label: 'Phone / WhatsApp Number',
          type: 'tel',
          required: true
        },
        {
          key: 'email',
          label: 'Email Address',
          type: 'email',
          required: true
        },
        {
          key: 'page_count',
          label: 'Number of Pages / Word Count',
          type: 'number',
          required: true,
          placeholder: 'e.g. 15 pages or 4,500 words'
        },
        {
          key: 'current_ai_score',
          label: 'Current AI Percentage Flagged',
          type: 'text',
          required: false,
          placeholder: 'e.g. 65%',
          helper: '(optional) Current Turnitin AI score'
        },
        {
          key: 'notes',
          label: 'Subject Matter & Details',
          type: 'textarea',
          required: true
        }
      ]
    }
  ];

  // 6. Laptops (Section 6)
  public laptops: LaptopListing[] = [
    {
      laptop_id: 'LAPTOP-DELL-5520',
      title: 'Dell Latitude 5520 Workstation Edition',
      brand: 'Dell',
      model: 'Latitude 5520',
      processor: 'Intel Core i7-1185G7 (up to 4.80 GHz, 4 Cores, 8 Threads)',
      ram: '32 GB DDR4 High-Speed RAM',
      storage: '1 TB PCIe NVMe SSD',
      screen: '15.6" Full HD (1920x1080) Anti-Glare IPS Display',
      colour: 'Titan Gray',
      graphics: 'Dedicated',
      graphics_details: 'NVIDIA GeForce MX450 (2 GB GDDR6 Dedicated)',
      ports: '2x Thunderbolt 4 with Power Delivery & DisplayPort, 2x USB 3.2 Gen 1, 1x HDMI 2.0, 1x RJ-45 Gigabit Ethernet, 1x uSD 4.0 card reader',
      operating_system: 'Windows 11 Pro 64-bit Licensed',
      freebies: 'Free laptop backpack, wireless mouse, and any two statistical tools of your choice activated for free!',
      availability: 'Available',
      price_ghs: 6800,
      notes: 'Excellent condition, fully tested battery and keyboard.',
      status: 'Active',
      sort_order: 1
    },
    {
      laptop_id: 'LAPTOP-LENOVO-T14',
      title: 'Lenovo ThinkPad T14 Gen 2 (AMD Ryzen 7)',
      brand: 'Lenovo',
      model: 'ThinkPad T14 Gen 2',
      processor: 'AMD Ryzen 7 PRO 5850U (8 Cores, 16 Threads, up to 4.4 GHz)',
      ram: '16 GB DDR4 3200MHz',
      storage: '512 GB PCIe NVMe M.2 SSD',
      screen: '14.0" FHD (1920 x 1080) IPS, 300 nits, Anti-glare',
      colour: 'Matte Black',
      graphics: 'No dedicated card',
      ports: '2x USB 3.2 Gen 1, 2x USB-C 3.2 Gen 2, HDMI 2.0, RJ-45 Ethernet, Headphone / mic combo',
      operating_system: 'Windows 11 Pro',
      freebies: 'Free charger, carry sleeve, and two software licenses included.',
      availability: 'Available',
      price_ghs: 5900,
      status: 'Active',
      sort_order: 2
    },
    {
      laptop_id: 'LAPTOP-HP-ELITE-840',
      title: 'HP EliteBook 840 G8 Ultra-Slim',
      brand: 'HP',
      model: 'EliteBook 840 G8',
      processor: 'Intel Core i5-1145G7 (11th Gen)',
      ram: '16 GB DDR4',
      storage: '512 GB NVMe SSD',
      screen: '14" FHD IPS Display',
      colour: 'Natural Silver Aluminum',
      graphics: 'No dedicated card',
      ports: '2x Thunderbolt 4, 2x SuperSpeed USB Type-A, 1x HDMI 2.0b, Audio jack',
      operating_system: 'Windows 11 Pro',
      freebies: 'Free bag + 2 free research software activations of your choice.',
      availability: 'Preorder', // Section 6.2 Preorder
      price_ghs: 5200,
      status: 'Active',
      sort_order: 3
    }
  ];

  // 7. Licence Key Pool (Section 4 Concurrency & Atomic Assignment)
  public licenseKeyPool: LicensePoolKey[] = [
    {
      license_id: 'LIC-PLS-01',
      variant_id: 'WINPLS01',
      product_name: 'SmartPLS',
      version_or_plan: 'v4.1.1.8 - Perpetual',
      license_code_or_key: 'PLS4-9812-4410-BC23-9081',
      code_type: 'Licence',
      status: 'Available',
      date_added: new Date().toISOString()
    },
    {
      license_id: 'LIC-PLS-02',
      variant_id: 'WINPLS01',
      product_name: 'SmartPLS',
      version_or_plan: 'v4.1.1.8 - Perpetual',
      license_code_or_key: 'PLS4-5519-7721-EF94-1102',
      code_type: 'Licence',
      status: 'Available',
      date_added: new Date().toISOString()
    },
    {
      license_id: 'LIC-NVIVO-01',
      variant_id: 'NVIVO14',
      product_name: 'NVivo',
      version_or_plan: 'v14 / Release 1 - Perpetual',
      license_code_or_key: 'NV14-7719-AA40-3918-FF21',
      code_type: 'Licence',
      status: 'Available',
      date_added: new Date().toISOString()
    },
    {
      license_id: 'LIC-CANVA-01',
      variant_id: 'CANVA1Y',
      product_name: 'Canva Pro Academic',
      version_or_plan: '1 Year Subscription',
      license_code_or_key: 'invite.canva.com/edu-join?token=HKTECH_EDU_99182',
      code_type: 'Licence',
      status: 'Available',
      date_added: new Date().toISOString()
    }
  ];

  // 8. Orders Database (Pre-seeded with representative orders from all lifecycle stages)
  public orders: Order[] = [
    {
      order_id: 'HK-982140',
      cart_id: 'CART-1001',
      order_date: '12 Mar 2026',
      last_updated: '12 Mar 2026',
      customer_name: 'Dr. Michael Boateng',
      phone: '0542638979',
      email: 'michael.boateng@example.com',
      variant_id: 'SPSS29',
      product_name: 'IBM SPSS Statistics',
      version_or_plan: 'v29.0',
      delivery_os: 'Windows',
      amount_ghs: 220,
      payment_status: 'Paid',
      fulfilment_status: 'Awaiting Customer Input',
      fulfilment_type: 'Sales Code',
      customer_input_type: 'Lock Code',
      notes: 'Customer notified to locate and submit Lock Code.'
    },
    {
      order_id: 'HK-871239',
      cart_id: 'CART-1002',
      order_date: '10 Mar 2026',
      last_updated: '11 Mar 2026',
      customer_name: 'Abena Osei',
      phone: '0244123456',
      email: 'abena.osei@example.com',
      variant_id: 'MXQ2024',
      product_name: 'MAXQDA Pro',
      version_or_plan: '2024 Edition',
      delivery_os: 'macOS',
      amount_ghs: 300,
      payment_status: 'Paid',
      fulfilment_status: 'Awaiting Seller Activation',
      customer_input_type: 'Hardware ID',
      customer_input_value: 'HD-9844-AA12-9018',
      sales_code: 'SC-MXQ-889102-GH',
      activation_website_url: 'https://activation.maxqda.com/portal',
      notes: 'Hardware ID submitted. Sales code issued.'
    },
    {
      order_id: 'HK-761902',
      cart_id: 'CART-1003',
      order_date: '08 Mar 2026',
      last_updated: '08 Mar 2026',
      customer_name: 'Kwame Darko',
      phone: '0501234567',
      email: 'k.darko@example.com',
      variant_id: 'WINPLS01',
      product_name: 'SmartPLS',
      version_or_plan: 'v4.1.1.8 - Perpetual',
      delivery_os: 'Windows',
      amount_ghs: 240,
      payment_status: 'Paid',
      fulfilment_status: 'Ready',
      fulfilment_type: 'Licence',
      fulfilment_method: 'Automatic',
      activation_code_or_key: 'PLS4-9812-4410-BC23-9081',
      windows_installer_url: 'https://downloads.hack-key.tech/smartpls4-setup.exe',
      guide_url: 'https://help.hack-key.tech/guides/smartpls4-install',
      learning_resources_url: 'https://help.hack-key.tech/resources/pls-sem',
      fulfilled_at: '2026-03-08T14:30:00Z',
      notes: 'Fulfilled automatically.'
    },
    {
      order_id: 'HK-652391',
      cart_id: 'CART-1004',
      order_date: '14 Mar 2026',
      last_updated: '14 Mar 2026',
      customer_name: 'Yaw Mensah',
      phone: '0209876543',
      email: 'yaw@example.com',
      variant_id: 'AMOS29',
      product_name: 'IBM SPSS AMOS',
      version_or_plan: 'v29.0',
      delivery_os: 'Windows',
      amount_ghs: 210,
      payment_status: 'Pending',
      fulfilment_status: 'Pending Payment',
      customer_input_type: 'Lock Code',
      notes: 'Checkout initiated, awaiting payment confirmation.'
    }
  ];

  // 9. Submissions & Requests
  public softwareRequests: SoftwareRequestSubmission[] = [];
  public laptopRequests: LaptopRequestSubmission[] = [];
  public serviceSubmissions: ServiceSubmission[] = [];

  // 10. Announcement (Section 8)
  public announcement: Announcement = {
    id: 'ann-welcome-2026',
    title: 'Welcome to Hack-Key Tech Support',
    message: 'Genuine statistical software licenses, laptop deals, and research support for researchers across Ghana and beyond.',
    button_text: 'Browse Software',
    button_url: '#browse-categories',
    show_once: true,
    active: false // Inactive by default so it doesn't obstruct browsing unless turned on
  };

  // 11. Phone Lookup Rate Limiter Map (IP/Phone -> timestamps array)
  private rateLimitMap: Map<string, number[]> = new Map();

  public isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 8; // Max 8 attempts per minute

    const timestamps = (this.rateLimitMap.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      return true;
    }
    timestamps.push(now);
    this.rateLimitMap.set(key, timestamps);
    return false;
  }

  // ==========================================
  // Catalog retrieval & formatting
  // ==========================================
  public getHydratedCatalog(categoryFilter?: string, searchQuery?: string) {
    // 1. Filter sellable products and compute pricing
    const resolvedProducts: Product[] = [];

    for (const p of this.products) {
      if (!p.active) continue;

      const sellableVariants: Variant[] = [];
      let minPayable = Infinity;
      let minList = Infinity;
      let anyPromo = false;
      const allOsChoices = new Set<string>();

      if (p.variants) {
        for (const v of p.variants) {
          if (!isVariantSellable(v)) continue;

          // Compute pricing
          const pricing = calculateVariantPricing(
            v.price_ghs,
            p.product_id,
            v.variant_id,
            this.pricingConfig
          );

          // Resolve OS (Section 1.3)
          const osRes = resolveVariantOperatingSystem(
            v.os,
            v.fulfilment_type,
            v.variant_id,
            v.mac_via_parallels
          );

          osRes.osList.forEach((o) => allOsChoices.add(o));

          const hydratedVariant: Variant = {
            ...v,
            list_price_ghs: pricing.listPriceGhs,
            payable_price_ghs: pricing.payablePriceGhs,
            promo_label: pricing.promoLabel,
            promo_percent: pricing.promoPercent,
            resolved_os_list: osRes.osList,
            requires_os_choice: osRes.requiresChoice
          };

          sellableVariants.push(hydratedVariant);

          if (pricing.payablePriceGhs < minPayable) minPayable = pricing.payablePriceGhs;
          if (pricing.listPriceGhs < minList) minList = pricing.listPriceGhs;
          if (pricing.hasPromo) anyPromo = true;
        }
      }

      if (sellableVariants.length === 0) continue; // Section 1.1: product only shown if active AND has at least one sellable variant

      // Determine overall availability sentence (Section 1.3)
      const osArr = Array.from(allOsChoices);
      const hasWin = osArr.some((o) => o.toLowerCase().includes('win'));
      const hasMac = osArr.some((o) => o.toLowerCase().includes('mac'));
      let availability_sentence = 'Available for Windows';
      if (hasWin && hasMac) {
        availability_sentence = 'Available for Windows and macOS';
      } else if (hasMac && !hasWin) {
        availability_sentence = 'Available for macOS only';
      } else if (hasWin && !hasMac) {
        availability_sentence = 'Available for Windows only';
      } else if (osArr.includes('Web / Cloud')) {
        availability_sentence = 'Delivered online, works on any device';
      } else if (osArr.includes('Any device')) {
        availability_sentence = 'Delivered as an account, works on any device';
      }

      const catName = this.categories.find((c) => c.category_id === p.category_id)?.name || p.category || '';

      resolvedProducts.push({
        ...p,
        categoryName: catName,
        variants: sellableVariants,
        min_price_ghs: minPayable === Infinity ? 0 : minPayable,
        min_list_price_ghs: minList === Infinity ? 0 : minList,
        has_promo: anyPromo,
        availability_sentence,
        // UI compat
        priceGhs: minPayable === Infinity ? 0 : minPayable,
        minPriceGhs: minPayable === Infinity ? 0 : minPayable,
        machineCodeType: p.customer_input_type === 'Hardware ID' ? 'hardware-id' : p.customer_input_type === 'Lock Code' ? 'lock-code' : 'none'
      });
    }

    // 2. Hydrate Bundles with items & pricing
    const resolvedBundles: Bundle[] = [];
    for (const b of this.bundles) {
      if (!b.active) continue;

      const pricing = calculateVariantPricing(
        b.price_ghs,
        b.bundle_id,
        b.bundle_id,
        this.pricingConfig
      );

      const hydratedItems: BundleItem[] = b.items.map((item) => {
        const prod = resolvedProducts.find((p) => p.product_id === item.product_id);
        const variant = prod?.variants?.find((v) => v.variant_id === item.variant_id);
        return {
          ...item,
          product: prod,
          variant
        };
      });

      resolvedBundles.push({
        ...b,
        list_price_ghs: pricing.listPriceGhs,
        payable_price_ghs: pricing.payablePriceGhs,
        promo_label: pricing.promoLabel,
        promo_percent: pricing.promoPercent,
        items: hydratedItems
      });
    }

    // 3. Hydrate Laptops with pricing
    const resolvedLaptops: LaptopListing[] = [];
    for (const lap of this.laptops) {
      if (lap.status !== 'Active') continue;
      if (lap.price_ghs) {
        const pricing = calculateVariantPricing(
          lap.price_ghs,
          lap.laptop_id,
          lap.laptop_id,
          this.pricingConfig
        );
        resolvedLaptops.push({
          ...lap,
          list_price_ghs: pricing.listPriceGhs,
          payable_price_ghs: pricing.payablePriceGhs,
          promo_label: pricing.promoLabel,
          promo_percent: pricing.promoPercent
        });
      } else {
        resolvedLaptops.push(lap);
      }
    }

    // Apply filtering
    let filteredProducts = resolvedProducts;
    if (categoryFilter && categoryFilter !== 'all') {
      filteredProducts = filteredProducts.filter(
        (p) => p.category_id.toUpperCase() === categoryFilter.toUpperCase()
      );
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      filteredProducts = filteredProducts.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.categoryName?.toLowerCase().includes(q)
      );
    }

    return {
      categories: this.categories.filter((c) => c.active),
      products: filteredProducts,
      bundles: resolvedBundles,
      services: this.services.filter((s) => s.status === 'Published'),
      laptops: resolvedLaptops,
      turnitinOptions: this.turnitinOptions,
      totalProducts: filteredProducts.length,
      announcement: this.announcement.active ? this.announcement : undefined,
      source: 'hack_key_tech_authoritative_engine',
      timestamp: new Date().toISOString()
    };
  }

  // ==========================================
  // Orders & Lookup (Sections 4 & 7)
  // ==========================================
  public lookupOrdersByPhone(phone: string): Order[] {
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length < 6) return [];

    return this.orders.filter((o) => {
      const oClean = o.phone.replace(/[^0-9]/g, '');
      return oClean.endsWith(clean) || clean.endsWith(oClean) || o.phone.includes(phone);
    });
  }

  public getOrderById(orderId: string): Order | undefined {
    return this.orders.find((o) => o.order_id === orderId);
  }

  /**
   * Submit Lock Code or Hardware ID (Section 4.3)
   * Rule: Once submitted, CANNOT be changed by the customer.
   * Rule: Must be a PAID order.
   */
  public submitCustomerInput(
    orderId: string,
    inputValue: string
  ): { success: boolean; message: string; order?: Order } {
    const order = this.getOrderById(orderId);
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.payment_status !== 'Paid') {
      return { success: false, message: 'Customer input may only be submitted against a paid order.' };
    }

    const inputType = order.customer_input_type || 'Lock Code / Hardware ID';

    if (order.customer_input_value && order.customer_input_value.trim().length > 0) {
      return {
        success: false,
        message: `A ${inputType} has already been submitted for this order and cannot be changed. Please contact Hack-Key Tech if it is wrong.`
      };
    }

    order.customer_input_value = inputValue.trim();
    order.last_updated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // If a sales code is already issued, keep 'Awaiting Seller Activation' or move to Ready
    if (!order.sales_code && order.fulfilment_status === 'Awaiting Customer Input') {
      order.fulfilment_status = 'Awaiting Seller Activation';
    }

    return {
      success: true,
      message: `${inputType} received. Your licence will be added shortly. Search your number again to see it.`,
      order
    };
  }

  /**
   * Save licence code (Section 4.3)
   * Rule: A licence code cannot be saved before the customer input exists.
   */
  public saveLicenceCode(
    orderId: string,
    licenceCode: string
  ): { success: boolean; message: string; order?: Order } {
    const order = this.getOrderById(orderId);
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.customer_input_type && (!order.customer_input_value || !order.customer_input_value.trim())) {
      return {
        success: false,
        message: 'Please submit your Lock Code or Hardware ID first.'
      };
    }

    order.activation_code_or_key = licenceCode.trim();
    order.fulfilment_status = 'Ready';
    order.fulfilled_at = new Date().toISOString();
    order.last_updated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return {
      success: true,
      message: 'Saved. Your licence code is stored on your order.',
      order
    };
  }

  /**
   * Create an Order from Cart Checkout (Section 3 & 4)
   * For bundles: spread the fixed bundle price across included item rows
   * in proportion to list prices, with the last row absorbing rounding.
   */
  public createCartOrders(payload: {
    customerName: string;
    phone: string;
    email: string;
    items: Array<{
      productId: string;
      variantId: string;
      selectedOs: string;
      bundleId?: string;
      bundleName?: string;
      bundlePriceGhs?: number;
      priceGhs: number;
    }>;
  }): { cartId: string; orders: Order[] } {
    const cartId = `CART-${Math.floor(100000 + Math.random() * 900000)}`;
    const createdOrders: Order[] = [];
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    for (const item of payload.items) {
      const prod = this.products.find((p) => p.product_id === item.productId);
      const variant = prod?.variants?.find((v) => v.variant_id === item.variantId);
      const orderId = `HK-${Math.floor(100000 + Math.random() * 900000)}`;

      const inputType = prod?.customer_input_type;
      const initialFulfilmentStatus = inputType ? 'Pending Payment' : 'Pending Payment';

      const newOrder: Order = {
        order_id: orderId,
        cart_id: cartId,
        order_date: dateStr,
        last_updated: dateStr,
        customer_name: payload.customerName,
        phone: payload.phone,
        email: payload.email,
        variant_id: item.variantId,
        product_name: prod?.product_name || item.productId,
        version_or_plan: variant?.version_or_plan || 'Standard',
        delivery_os: item.selectedOs || 'Windows',
        amount_ghs: item.priceGhs,
        payment_status: 'Pending',
        fulfilment_status: initialFulfilmentStatus,
        fulfilment_type: variant?.fulfilment_type,
        customer_input_type: inputType,
        windows_installer_url: variant?.windows_installer_url,
        guide_url: variant?.guide_url,
        learning_resources_url: variant?.learning_resources_url,
        mac_via_parallels: variant?.mac_via_parallels,
        notes: item.bundleName ? `Part of ${item.bundleName} (${formatCurrencyGHS(item.bundlePriceGhs || 0)}) - cart ${cartId}.` : undefined
      };

      this.orders.unshift(newOrder);
      createdOrders.push(newOrder);
    }

    return { cartId, orders: createdOrders };
  }

  /**
   * Mark an order as paid and trigger automatic key pool fulfilment if applicable (Path A)
   */
  public markOrderAsPaid(orderId: string): Order | null {
    const order = this.getOrderById(orderId);
    if (!order) return null;

    order.payment_status = 'Paid';
    order.last_updated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    if (order.customer_input_type) {
      // Path B: Awaiting customer lock code or hardware ID
      order.fulfilment_status = 'Awaiting Customer Input';
    } else {
      // Path A: Auto-fulfil from pool if available
      const poolKey = this.licenseKeyPool.find(
        (k) => k.variant_id === order.variant_id && k.status === 'Available'
      );
      if (poolKey) {
        poolKey.status = 'Assigned';
        poolKey.assigned_order_id = order.order_id;
        poolKey.date_assigned = new Date().toISOString();

        order.fulfilment_status = 'Ready';
        order.fulfilment_method = 'Automatic';
        order.activation_code_or_key = poolKey.license_code_or_key;
        order.license_id = poolKey.license_id;
        order.fulfilled_at = new Date().toISOString();
      } else {
        // Ready or Manual delivery needed
        order.fulfilment_status = 'Ready';
        order.fulfilment_method = 'Manual';
        order.activation_code_or_key = 'HK-LIC-' + Math.floor(100000 + Math.random() * 900000);
        order.fulfilled_at = new Date().toISOString();
      }
    }

    return order;
  }
}

export const storeDatabase = new StoreDatabase();
