/**
 * Centralized Storefront Customer-Facing Copy
 * Extracted directly and verbatim from the authoritative Hack-Key Tech Apps Script storefront.
 * DO NOT paraphrase, rewrite, simplify, or modify these strings without explicit instructions.
 */

export const STORE_COPY = {
  // Brand & Header
  brand: {
    name: 'Hack-Key Tech',
    storeTitle: 'Hack-Key Tech Store',
    tagline: 'Software, research services and laptops — with support when you need it.',
    phone: '+233 54 263 8979',
    phoneRaw: '+233542638979',
    email: 'hack.keytech@gmail.com',
    whatsAppUrl: 'https://wa.me/233542638979',
    whatsAppAccessibleLabel: 'Chat with us on WhatsApp',
    whatsAppCta: 'Chat on WhatsApp',
    searchPlaceholder: 'Search store e.g. SmartPLS, Turnitin',
  },

  // Navigation
  navigation: {
    home: 'Home',
    findOrder: 'Find my order',
    help: 'Help',
    request: 'Request',
    cart: 'Cart',
  },

  // Hero section
  hero: {
    title: 'Hack-Key Tech Store',
    lead: 'Software, research services and laptops — with support when you need it.',
    trustChips: [
      'Secure Paystack checkout',
      'Find your order anytime',
      'After sales support',
    ],
    momoTrust: 'MoMo manual payment',
    bothPaymentTrust: 'Paystack or MoMo payment',
  },

  // Category & Catalogue Sections
  catalog: {
    browseByCategory: 'Browse by category',
    featuredSoftware: 'Featured software',
    viewAllSoftware: 'View all software',
    allSoftware: 'All software',
    goBack: 'Go back',
    productCount: (count: number) => `${count} product${count === 1 ? '' : 's'}`,
    productsFound: (count: number, caption?: string) =>
      `${count} product${count === 1 ? '' : 's'}${caption ? ` · ${caption}` : ''}`,
    emptySearchResults: 'Nothing matched that search.',
    emptyCategoryResults: 'No products matched.',
    requestThisSoftware: 'Request this software',
    requestLaptop: 'Request a laptop',
    categoryNotFoundTitle: 'Category not found',
    categoryNotFoundDescription: 'This category is unavailable or may have moved.',
    backToBrowse: 'Back to browsing',
    categoryItems: (count: number) => `${count} item${count === 1 ? '' : 's'} available`,
    productNotFoundTitle: 'Product not found',
    productNotFoundDescription: 'This product is unavailable or may have moved.',
    loading: 'Loading catalogue…',
    retry: 'Try again',
  },

  // Product Cards & Options
  product: {
    softwareFallback: 'Software',
    buyNow: 'Buy now',
    viewOptions: 'View options',
    recommended: 'Recommended',
    latest: 'Latest',
    fromPrice: (priceStr: string) => `Starts at ${priceStr}`,
    askForPrice: 'Ask for price',
    fromPrefix: 'Starts at',
    chooseOperatingSystem: '1. Choose your operating system',
    chooseVersion: 'Choose a version',
    versionsAvailable: (count: number) => `${count} ${count === 1 ? 'version' : 'versions'} available`,
    platform: 'Platform:',
    priceLabel: 'Price (GHS)',
    addToCart: 'Add to Cart',
    addedToCartTitle: 'Added to cart',
    back: 'Back',
    unavailable: 'Unavailable',
    selectVersion: 'Select a version to continue',
    selected: 'Selected',
    about: 'About this product',
    promotion: (percent?: number) => percent ? `${percent}% off` : 'Promotion',
  },

  gallery: {
    title: 'Installation gallery',
    subtitle: 'Examples of successful installations and setups.',
    openImage: (number: number) => `Open gallery image ${number}`,
    imageAlt: (productName: string, number: number) => `${productName} installation ${number}`,
    lightboxLabel: 'Product installation gallery',
    close: 'Close gallery',
    previous: 'Previous image',
    next: 'Next image',
  },

  // Order Progress Terminology (Strict Parity)
  orderProgress: {
    // Exact 5-step for AMOS/SPSS:
    amosSpss: ['Your Selection', 'Your Details', 'Payment', 'Submit Lock Code', 'Licence Delivery'],
    // Exact 5-step for MAXQDA/Mplus/EViews:
    maxqdaMplusEviews: ['Your Selection', 'Your Details', 'Payment', 'Submit Hardware ID', 'Licence Delivery'],
    // Exact 4-step for standard software:
    standardSoftware: ['Your Selection', 'Your Details', 'Payment', 'Licence Delivery'],
    // Exact 4-step for services / laptops:
    nonLicence: ['Your Selection', 'Your Details', 'Payment', 'Delivery'],
    turnitin: ['Your Selection', 'Your Details', 'Payment', 'Upload Document', 'Report Processing', 'Report Ready'],
    mobileSummary: (current: number, total: number, label: string) =>
      `Step ${current} of ${total}: ${label}`,
  },

  turnitin: {
    importantInformation: 'Important information, please read before you place your order',
    aiWordLimit:
      'AI checking is limited to 29,990 words. Please make sure your document contains 29,990 words or fewer. If it is slightly above the limit, remove the reference list and appendix before uploading. If it still exceeds the limit, split the document into two files and increase your order quantity to 2 so both parts can be checked.',
  },

  // Device Lock Disclaimers
  deviceLock: {
    before:
      'The licence to this software works only on the device on which the software will be installed and only for the specific version purchased. It will not work on a different laptop or with a different version of the software.',
    after:
      'The licence to this software works only on the device the software was installed on and only for the specific version purchased. It will not work on a different laptop or with a different version of the software.',
  },

  // Find My Order
  findOrder: {
    title: 'Find my order',
    subtitle: 'Enter the phone number you used when purchasing.',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'e.g. 0542638979',
    submitButton: 'Find my orders',
    searching: 'Searching your orders...',
    emptyNotFoundTitle: 'No matching order found',
    emptyNotFoundDesc: (phone: string) =>
      `Check the phone number and try again. If you still cannot find your order, contact ${phone}.`,
    resultsGreeting: (name?: string) => `Hello${name ? `, ${name}` : ''}.`,
    resultsSub:
      'Find your licence/s below.\nIf you cannot find it, double check the phone number used to search.\nPlease contact us if you still cannot find it.',

    // Input submission blocks (Progressive disclosure only when order requires it)
    hardwareId: {
      title: 'Send us your Hardware ID',
      instruction:
        'Open the software, find your Hardware ID in the activation window and use the copy button beside it. Paste it below rather than typing it.',
      placeholder: 'Paste your Hardware ID',
      button: 'Submit Hardware ID',
    },
    lockCode: {
      title: 'Send us your Lock Code',
      instruction:
        'Install the software, open the License Activation Wizard and copy your Lock Code. Paste it below rather than typing it.',
      placeholder: 'Paste your Lock Code',
      button: 'Submit Lock Code',
    },
    inputWarn: 'Check it matches your activation window exactly. It cannot be changed once submitted.',
    inputHelper: (inputType: string) => `Your licence will be added after your ${inputType} is submitted.`,
    submittedStatus: (inputType: string) => `${inputType} you submitted`,
    receivedWaiting: 'Received. Your licence will be added shortly.',
    sendOnWhatsApp: 'Send it on WhatsApp',

    // Activation block
    activate: {
      title: 'Generate your licence',
      salesCodeLabel: 'Sales code',
      openActivationWebsite: 'Open the activation website',
      instructionWithLink: (inputType: string) =>
        `Use the sales code and your ${inputType} there to generate your licence code, then paste it below.`,
      instructionWithoutLink: (inputType: string) =>
        `Use the sales code with your ${inputType} to generate your licence code, then paste it below.`,
      licencePlaceholder: 'Paste your licence code here',
      saveButton: 'Save my licence code',
    },

    // Unpaid block
    unpaid: {
      amountDue: 'Amount due',
      paymentNotice:
        'Payment for this order has not been confirmed yet. Your licence and download links appear here as soon as it is.',
      makePayment: 'Make payment',
      securedPaystack: 'Secured by Paystack. MoMo or card.',
      otherPaymentToggle: 'Other payment options (Ghana only)',
      momoMerchantId: '722657',
      momoMerchantName: 'Hack Key Tech Ventures',
      momoTransferNumber: '0559306223',
      momoTransferName: 'LAWRENCE HACKEY JORHOWIE HACK KEY TECH VENTURES',
      momoNote:
        'After paying, send a screenshot of your MoMo transaction to 0542638979 for confirmation.',
    },
  },

  // Help Support Hub
  help: {
    secTitle: 'Help & support',
    contactTitle: 'Contact Hack-Key Tech',
    contactDesc:
      'Need help with an order, installation, activation, or choosing the right product? Contact us directly.',
    phoneWhatsAppLabel: 'Phone / WhatsApp',
    emailLabel: 'Email',
    whatsAppHelpBtn: 'WhatsApp help',
    sendEmailBtn: 'Send email',

    remoteSupportTitle: 'Remote support',
    remoteSupportDesc:
      'If we need to assist you on your computer, download TeamViewer for your operating system and contact us.',
    windowsTeamViewer: 'Windows TeamViewer',
    macTeamViewer: 'Mac TeamViewer',
    unavailableNotice:
      'If a download button is unavailable, contact us and we will send the correct remote-support link.',
  },

  // Request Software or Laptop (Dedicated Page)
  requestPage: {
    pageTitle: 'Request Software or Laptop',
    modeSoftware: 'Request Software',
    modeLaptop: 'Request a Laptop',

    // Software Request
    software: {
      title: 'Request software not listed',
      subtitle: 'Tell us what you need and we will get back to you.',
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Phone number',
      phoneHint: 'Please give a number that is on WhatsApp.',
      email: 'Email address',
      softwareName: 'Name of the software you need',
      softwarePlaceholder: 'e.g. Adobe Illustrator 2026',
      websiteLink: 'Link to the official website',
      websiteHint: 'Optional.',
      notes: 'Anything else?',
      notesHint: 'Optional.',
      submitBtn: 'Send request',
      successTitle: 'Request received.',
      successDesc: (software: string, phone: string) =>
        `We have your request for ${software}. We will contact you on ${phone} within 24 hours, usually on WhatsApp.`,
    },

    // Laptop Request (from openLaptopRequest in authoritative Apps Script)
    laptop: {
      title: 'I want a different laptop',
      subtitle: 'Tell us what you need and we will give you a price estimate.',
      stepDetails: 'Your details',
      name: 'Name',
      phone: 'Phone / WhatsApp',
      email: 'Email (optional)',
      location: 'Location',
      locationPlaceholder: 'e.g. Accra',

      stepNeed: 'What you need',
      budget: 'Budget',
      budgetHint: 'A single amount or a price range is fine.',
      budgetPlaceholder: 'e.g. 4,000 or 3,500 - 5,000',
      preferredBrand: 'Preferred brand or model (optional)',
      preferredPlaceholder: 'e.g. HP EliteBook, Dell Latitude',

      stepSpecs: 'Desired specifications',
      storageSize: 'Storage size',
      storagePlaceholder: 'e.g. 512GB SSD',
      ramSize: 'RAM size',
      ramPlaceholder: 'e.g. 16GB',
      otherSpecs: 'Anything else the laptop should have? (optional)',
      otherSpecsHint: 'Graphics card, backlit keyboard, battery life, ports, or anything else.',
      purpose: 'What will you use it for?',
      purposeHint:
        'School or research, office work, statistics and data analysis, graphic design, programming, engineering software, gaming, general use.',

      preferredCondition: 'Preferred condition',
      conditionOptions: [
        'Foreign Slightly Used - cheaper',
        'Brand New Sealed - more expensive',
        'Either, whichever suits my budget',
      ],

      stepTiming: 'Timing',
      howSoon: 'How soon do you need it?',
      howSoonOptions: [
        'As soon as possible',
        'Within 1 week',
        'Within 2 to 3 weeks',
        'Within a month',
        'No rush',
      ],

      readiness: 'How ready are you to buy?',
      readinessOptions: [
        'Fully ready',
        '80% ready',
        '50% ready',
        'Not ready, just exploring',
      ],

      anythingElse: 'Anything else? (optional)',
      submitBtn: 'Submit my request',
      successTitle: (name?: string) => `Thank you${name ? `, ${name}` : ''}.`,
      successDesc: (ref: string) =>
        `We have received your details and will contact you within 24 hours with suitable options and prices.\n\nYour reference is ${ref}.`,
    },
  },

  // Cart & Checkout
  cart: {
    title: 'Your cart',
    emptyTitle: 'Your cart is empty.',
    browseSoftwareBtn: 'Browse software',
    subtotal: (count: number) => `Subtotal (${count} item${count === 1 ? '' : 's'})`,
    total: 'Total',
    proceedToCheckout: 'Proceed to checkout',
    flyout: {
      closeLabel: 'Close cart preview',
      ready: 'Ready when you are',
      lineCount: (count: number) => `${count} line${count === 1 ? '' : 's'} selected`,
      emptyDescription: 'Browse the catalogue and add an item to get started.',
      browseProducts: 'Browse products',
      quantity: (quantity: number) => `Qty ${quantity}`,
    },

    checkoutTitle: 'Your details',
    checkoutSubtitle: 'You will use this phone number to retrieve your licences later.',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone number',
    email: 'Email address',
    afterPaymentNotice: 'Download links and instructions appear after payment.',
    submitAndPay: 'Submit and Pay',
  },

  payment: {
    paystackButton: 'Pay securely with Paystack',
    momoOnlyButton: 'Submit order and view MoMo details',
    bothButton: 'Submit order and choose payment method',
    otherOptions: 'Other payment options (Ghana only)',
    momoTitle: 'Pay with MTN Mobile Money',
    momoIntro: 'Pay the exact amount using either option below. Your order remains pending until the payment is confirmed by Hack-Key Tech.',
    merchantId: 'MoMo Pay Merchant ID',
    merchantName: 'Merchant name',
    transferNumber: 'MoMo direct transfer number',
    transferName: 'Account name',
    copy: 'Copy',
    copied: 'Copied',
    screenshotInstruction: (whatsapp: string) => `After paying, send a screenshot of your MoMo transaction to ${whatsapp} for confirmation.`,
    sendScreenshot: 'Send screenshot on WhatsApp',
    screenshotMessage: (references: string) => `Hello, I have paid for order ${references}. I am attaching my MoMo transaction screenshot for confirmation.`,
    orderReference: 'Order reference',
    awaitingConfirmation: 'Your order has been recorded and is awaiting MoMo payment confirmation.',
    paymentPending: 'Payment pending',
    paymentPendingDescription: 'Choose an available payment method below. Payment status changes only after Paystack verification or seller confirmation of your MoMo transaction.',
    viewMomo: 'View MoMo payment details',
    unavailable: 'Payment options could not be loaded. Please try again.',
  },

  // Fulfilment & Delivery Windows
  delivery: {
    viewDeliveryHours: 'View delivery hours',
    withinHoursHeadline: 'Your licence should be added in 20–40 minutes',
    outsideHoursHeadline: (localRestart: string) =>
      `Orders placed now will be processed from 01:00 UTC+0 (${localRestart} your time)`,
    currentlyWithin: 'You are currently within our fulfilment hours.',
    currentlyOutside: 'You are currently outside our normal fulfilment window.',
    fullNotice: (localWindow: string, localRestart: string, currentLocal: string) =>
      `Orders paid between 01:00–16:00 UTC+0 (${localWindow} in your local time) are normally processed within 20–40 minutes after payment and after any requested details are received. Orders paid outside this window are processed after the next 01:00 UTC+0 (${localRestart} your local time). Your local time is currently ${currentLocal}.`,
  },

  announcement: {
    dismiss: 'Dismiss announcement',
    close: 'Close',
  },
};

/** Seller-facing copy for the separately loaded admin portal. */
export const ADMIN_COPY = {
  brand: 'Hack-Key Tech Admin',
  signInTitle: 'Sign in to manage the store',
  signInSubtitle: 'Use an administrator account. There is no public registration.',
  email: 'Email address',
  password: 'Password',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  forgotPassword: 'Forgot password?',
  sendingReset: 'Sending reset email…',
  resetSent: 'If that address belongs to an administrator, a password-reset email has been sent.',
  enterEmailForReset: 'Enter your email address first.',
  signInFailed: 'Sign-in was not accepted. Check the credentials and try again.',
  signInCooldown: (seconds: number) => `Too many unsuccessful attempts in this browser. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`,
  signOut: 'Sign out',
  loading: 'Loading the business work queue…',
  refresh: 'Refresh',
  save: 'Save',
  saving: 'Saving…',
  preview: 'Preview',
  cancel: 'Cancel',
  sections: {
    orders: 'Orders',
    requests: 'Requests',
    categories: 'Category setup',
    licences: 'Licences',
    services: 'Services',
    software: 'Software setup',
    laptops: 'Laptop properties',
    announcements: 'Announcements',
    products: 'Product media',
    landing: 'Landing banners',
    ordering: 'Catalogue order',
    pricing: 'Pricing & promotions',
    payments: 'Payments',
  },
  payments: {
    title: 'Payment methods',
    subtitle: 'Choose what new checkouts offer. Changes are applied by the server and may take up to about 30 seconds to reach another running instance.',
    liveMode: 'Live mode',
    paystackTitle: 'Paystack only',
    paystackDescription: 'Customers go directly to Paystack. MoMo details are not offered.',
    momoTitle: 'MoMo manual payment only',
    momoDescription: 'Orders stay pending until you confirm the transaction using the existing offline-payment action.',
    bothTitle: 'Paystack and MoMo',
    bothDescription: 'Paystack is prominent. MoMo appears under “Other payment options (Ghana only)”.',
    save: 'Save payment settings',
    confirm: (mode: string) => `Change the live checkout to ${mode}? This changes what customers see on every new payment attempt.`,
    saved: 'Payment settings saved. This instance is using the new mode now.',
    detailsTitle: 'MoMo payment details',
    detailsDescription: 'These are public payment instructions shown to customers when MoMo is available.',
    merchantId: 'MoMo Pay Merchant ID',
    merchantName: 'Merchant name',
    transferNumber: 'MoMo direct transfer number',
    transferName: 'Transfer account name',
    whatsappNumber: 'WhatsApp number for screenshots',
    defaultConfiguration: 'Default configuration',
  },
  orders: {
    title: 'Orders needing attention',
    subtitle: 'The default queue is oldest first. Ready orders are available through the filter.',
    searchPlaceholder: 'Search client name, phone, order reference, or email',
    all: 'All orders',
    actionRequired: 'Needs action',
    empty: 'No orders match this view.',
    details: 'Order details',
    close: 'Close order',
    assignLicence: 'Assign a licence',
    usePool: 'Use next key in stock',
    manualKey: 'Or paste a key',
    fulfil: 'Mark fulfilled and email customer',
    documentReceived: 'Mark document received',
    nudgeCustomer: 'Email customer a reminder',
    downloadDocument: 'Download uploaded document',
    resendReceipt: 'Resend receipt',
    resendDelivery: 'Resend delivery email',
    offlinePayment: 'Record offline payment',
    offlineReference: 'MoMo transaction or bank reference',
    offlineReason: 'Reason / payment channel',
    internalNote: 'Add an internal note',
    notePlaceholder: 'Visible only to administrators',
    awaitingMomo: 'Awaiting MoMo payment',
    recordMomo: 'Record MoMo payment',
  },
  licences: {
    title: 'Licence stock',
    subtitle: 'Keys are masked until explicitly revealed. Every reveal is audited.',
    bulkTitle: 'Load licence keys',
    variant: 'Variant',
    pasteHint: 'Paste one key per line. Every key will be assigned to the selected variant.',
    import: 'Validate and import',
    csv: 'Upload CSV',
    csvHint: 'Headers: variantId, licenceCode, codeType, notes',
    reveal: 'Reveal',
    lowStock: 'Low stock',
    integrity: 'Data integrity warning',
  },
  services: {
    title: 'Service composer',
    subtitle: 'Create quote-only or purchasable services without changing code.',
    new: 'New service',
    addField: 'Add field',
    addOption: 'Add priced option',
    livePreview: 'Customer preview',
    showWhen: 'Show this field when',
    equals: 'equals',
    quoteOnly: 'No priced options: this service stays quote-only.',
  },
  announcements: {
    title: 'Announcements',
    subtitle: 'If several are active at once, the most recently updated announcement is shown.',
    new: 'New announcement',
    showOnce: 'Let users choose “Don’t show this again”',
    active: 'Published and active',
    previewTitle: 'Announcement preview',
  },
  products: {
    title: 'Product media',
    subtitle: 'Add a wide banner and installation photos. Images are resized before upload.',
    banner: 'Product banner',
    gallery: 'Installation gallery',
    chooseBanner: 'Upload banner',
    chooseGallery: 'Add gallery images',
    remove: 'Remove',
    uploading: 'Uploading…',
    uploaded: 'Image uploaded.',
    removed: 'Image removed.',
    noBanner: 'No banner uploaded. The product page will use the brand gradient.',
    noGallery: 'No gallery images yet.',
    resizeError: 'That image could not be resized. Try a JPEG, PNG, or WebP file.',
    confirmRemove: 'Remove this image?',
    iconSource: 'Catalogue icon',
  },
};
