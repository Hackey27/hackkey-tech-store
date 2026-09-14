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
      'WhatsApp support',
    ],
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
  },

  // Product Cards & Options
  product: {
    buyNow: 'Buy now',
    viewOptions: 'View options',
    recommended: 'Recommended',
    latest: 'Latest',
    fromPrice: (priceStr: string) => `From ${priceStr}`,
    fromPrefix: 'From',
    chooseOperatingSystem: '1. Choose your operating system',
    chooseVersion: 'Choose a version',
    chooseVersionWithStep: '2. Choose a version',
    versionsAvailable: (count: number) => `${count} version(s) available`,
    change: 'Change',
    addToCart: 'Add to Cart',
    keepShopping: 'Keep shopping',
    goToCart: 'Go to cart',
    close: 'Close',
    addedToCartTitle: 'Added to cart',
    addedToCartDesc: (name: string, version: string, count: number) =>
      `${name} ${version} · ${count} item${count === 1 ? '' : 's'} in cart`,
    alreadyInCart: 'That version is already in your cart.',

    // Parallels note
    parallelsNotice: {
      tagline: 'Windows software — Mac setup through Parallels at no extra cost',
      title: 'This is Windows software',
      p1: 'It does not have a Mac version, so it runs inside Windows on your Mac using Parallels Desktop. We set that up for you at no extra charge — you only pay for the software.',
      p2: 'You will need roughly 128GB free space and a stable connection to download the Windows file (7.46GB).',
      btn: 'See Parallels requirements',
    },

    // Warnings
    windowsOnlyWarn: 'This software runs on Windows only. It will not work on a Mac.',
    macOnlyWarn: 'This software runs on macOS only. It will not work on Windows.',
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
        `We have your request for ${software} and will contact you on ${phone}, usually on WhatsApp.`,
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
        `We will review your requirements and contact you within 24 to 48 hours with suitable options and prices.\n\nYour reference is ${ref}.`,
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

    checkoutTitle: 'Your details',
    checkoutSubtitle: 'You will use this phone number to retrieve your licences later.',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone number',
    email: 'Email address',
    afterPaymentNotice: 'Download links and instructions appear after payment.',
    submitAndPay: 'Submit and Pay',
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
};
