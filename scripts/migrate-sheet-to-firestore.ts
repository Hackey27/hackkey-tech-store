/**
 * One-off migration: spreadsheet -> Firestore.
 *
 *   npx tsx scripts/migrate-sheet-to-firestore.ts --file "<workbook>.xlsx" --dry-run
 *   npx tsx scripts/migrate-sheet-to-firestore.ts --file "<workbook>.xlsx"
 *
 * Run by hand, never from CI. The spreadsheet is the migration input only:
 * after this runs, Firestore is the single source of truth and the workbook is
 * historical. No Sheets API client is involved.
 *
 * Two rules shape everything below.
 *
 * 1. Validate, then write. The whole workbook is parsed and checked first. If
 *    any blocking defect is found nothing at all is written and the process
 *    exits non-zero — a partial import is worse than no import.
 *
 * 2. Idempotent. Document ids are the sheet's own identifiers, so a re-run
 *    overwrites rather than duplicates and it is safe to run repeatedly while
 *    iterating.
 *
 * On defects, docs/phase-1-firestore-spec.md §3 draws a line this script
 * follows: defects with an agreed resolution (Excel's float versions, the one
 * product missing a category) are applied and reported; anything without one
 * (a missing id, an unparseable service form, a variant pointing at a product
 * that does not exist) blocks the import. The License_Pool tab is deliberately
 * not imported, so its known defects are not blockers for this phase.
 */

import path from 'path';
import ExcelJS from 'exceljs';
import { Firestore, WriteBatch } from '@google-cloud/firestore';
import {
  Announcement,
  Bundle,
  BundleItem,
  Category,
  CustomerRequest,
  Laptop,
  Order,
  Product,
  RequestKind,
  Service,
  ServiceField,
  Variant
} from '../src/types';
import { SEED_SERVICES } from '../server/seed/turnitin';

// ---------------------------------------------------------------------------
// Owner decisions applied during import
// ---------------------------------------------------------------------------

/**
 * Parallels Desktop is Active in the sheet but its Category_ID is blank.
 *
 * This is a deliberate, owner-decided placement, not a default: a single named
 * entry, so no other product can ever be silently given a category. Firestore
 * is the source of truth after migration, so this can be changed in the admin
 * portal later without touching this script. Do not "fix" it back to blank.
 */
const CATEGORY_OVERRIDES: Record<string, string> = {
  PD: 'DESIGN'
};

/** Tabs that are read. `Tips` is ignored: empty, and the feature was removed. */
const TAB = {
  categories: 'Categories',
  products: 'Products',
  variants: 'Variants',
  bundles: 'Bundles',
  bundleItems: 'Bundle_Items',
  services: 'Services',
  laptops: 'Laptops',
  orders: 'Orders',
  laptopRequests: 'Laptop_Requests',
  laptopEnquiries: 'Laptop_Enquiries',
  customBundleRequests: 'Custom_Bundle_Requests',
  humanizingRequests: 'Humanizing_Requests'
} as const;

/** Imported for schema only — never populated from the sheet. See spec §3. */
const NOT_IMPORTED_TABS = ['License_Pool'];

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

interface Report {
  blocking: string[];
  warnings: string[];
  skipped: string[];
}

const report: Report = { blocking: [], warnings: [], skipped: [] };

const block = (msg: string) => report.blocking.push(msg);
const warn = (msg: string) => report.warnings.push(msg);
const skip = (msg: string) => report.skipped.push(msg);

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** Header keys are compared with punctuation and case removed, so Product_ID,
 *  "Product ID" and productid all resolve to the same column. */
function normaliseHeader(header: string): string {
  return String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cell(row: Row, ...candidates: string[]): unknown {
  for (const candidate of candidates) {
    const key = normaliseHeader(candidate);
    if (key in row && row[key] !== null && row[key] !== undefined && row[key] !== '') {
      return row[key];
    }
  }
  return undefined;
}

function str(row: Row, ...candidates: string[]): string | undefined {
  const value = cell(row, ...candidates);
  if (value === undefined) return undefined;
  // ExcelJS returns rich text and hyperlink objects for some cells.
  if (typeof value === 'object') {
    const obj = value as { text?: string; hyperlink?: string; result?: unknown };
    if (typeof obj.text === 'string') return obj.text.trim();
    if (typeof obj.hyperlink === 'string') return obj.hyperlink.trim();
    if (obj.result !== undefined) return String(obj.result).trim();
    return undefined;
  }
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

function num(row: Row, ...candidates: string[]): number | undefined {
  const value = cell(row, ...candidates);
  if (value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The sheet spells booleans as Yes/No, Published/Draft, Available/Unavailable
 * and TRUE/FALSE. They are converted here, at import, never at read time.
 */
function bool(row: Row, ...candidates: string[]): boolean {
  const value = cell(row, ...candidates);
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLowerCase();
  return ['yes', 'y', 'true', '1', 'published', 'active', 'available', 'live'].includes(text);
}

/**
 * Version numbers must always be stored as strings.
 *
 * Excel coerced the AMOS versions into floats, so they arrive as 31.0, 30.0,
 * 29.0, 28.0 and imported naively the site would advertise "AMOS 31.0". An
 * integral number renders without its decimal; everything else keeps its exact
 * text, so "4.1.1.8" is never touched.
 */
function versionString(row: Row, label: string, ...candidates: string[]): string | undefined {
  const value = cell(row, ...candidates);
  if (value === undefined) return undefined;

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      warn(`${label}: version ${value} arrived as a number; stored as "${value}".`);
      return String(value);
    }
    return String(value);
  }

  const text = String(value).trim();
  const trailingZeroDecimal = /^(\d+)\.0+$/.exec(text);
  if (trailingZeroDecimal) {
    warn(`${label}: version "${text}" normalised to "${trailingZeroDecimal[1]}".`);
    return trailingZeroDecimal[1];
  }
  return text;
}

/** Pictures_URL may hold several URLs in one cell. */
function urlList(row: Row, ...candidates: string[]): string[] {
  const text = str(row, ...candidates);
  if (!text) return [];
  return text
    .split(/[\s,;|\n]+/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

// ---------------------------------------------------------------------------
// Service form parsing
// ---------------------------------------------------------------------------

/**
 * `Services.Fields` defines the per-service enquiry form. It is parsed into
 * structured JSON here rather than stored as a raw string, and a service whose
 * definition does not parse blocks the import rather than arriving half-formed.
 *
 * Accepts either a JSON array, or the compact pipe form:
 *   key:Label:type:required|key2:Label 2:select:optional:A,B,C
 */
function parseServiceFields(raw: string | undefined, serviceId: string): ServiceField[] {
  if (!raw) return [];

  const text = raw.trim();

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        block(`Services ${serviceId}: Fields parsed as JSON but is not an array.`);
        return [];
      }
      return parsed as ServiceField[];
    } catch (err) {
      block(
        `Services ${serviceId}: Fields looks like JSON but does not parse ` +
          `(${err instanceof Error ? err.message : 'unknown error'}).`
      );
      return [];
    }
  }

  const fields: ServiceField[] = [];
  for (const chunk of text.split('|').map((c) => c.trim()).filter(Boolean)) {
    const parts = chunk.split(':').map((p) => p.trim());
    if (parts.length < 2) {
      block(`Services ${serviceId}: cannot parse field definition "${chunk}".`);
      continue;
    }
    const [key, label, type = 'text', required = 'optional', options] = parts;
    fields.push({
      key,
      label,
      type: (type || 'text') as ServiceField['type'],
      required: required.toLowerCase() === 'required',
      options: options ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined
    });
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Workbook reading
// ---------------------------------------------------------------------------

async function readWorkbook(file: string): Promise<Map<string, Row[]>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const tabs = new Map<string, Row[]>();

  workbook.eachSheet((sheet) => {
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (c, colNumber) => {
      headers[colNumber] = normaliseHeader(String(c.value ?? ''));
    });

    const rows: Row[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Row = {};
      let hasValue = false;
      row.eachCell({ includeEmpty: false }, (c, colNumber) => {
        const key = headers[colNumber];
        if (!key) return;
        record[key] = c.value;
        if (c.value !== null && c.value !== undefined && String(c.value).trim() !== '') {
          hasValue = true;
        }
      });
      if (hasValue) rows.push(record);
    });

    tabs.set(sheet.name.trim(), rows);
  });

  return tabs;
}

function requireTab(tabs: Map<string, Row[]>, name: string): Row[] {
  const rows = tabs.get(name);
  if (!rows) {
    block(`Tab "${name}" is missing from the workbook. Found: ${[...tabs.keys()].join(', ')}`);
    return [];
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

interface Built {
  categories: Category[];
  products: Product[];
  bundles: Bundle[];
  services: Service[];
  laptops: Laptop[];
  orders: Order[];
  requests: CustomerRequest[];
  announcements: Announcement[];
  variantCount: number;
  bundleItemCount: number;
}

function buildCategories(rows: Row[]): Category[] {
  const seen = new Set<string>();
  const categories: Category[] = [];

  rows.forEach((row, i) => {
    const categoryId = str(row, 'Category_ID', 'CategoryID', 'ID');
    if (!categoryId) {
      block(`Categories row ${i + 2}: missing Category_ID.`);
      return;
    }
    if (seen.has(categoryId)) {
      block(`Categories row ${i + 2}: duplicate Category_ID "${categoryId}".`);
      return;
    }
    seen.add(categoryId);

    categories.push({
      categoryId,
      name: str(row, 'Name', 'Category_Name', 'Category') || categoryId,
      tagline: str(row, 'Tagline', 'Description', 'Short_Description') || '',
      icon: str(row, 'Icon') || 'software',
      sortOrder: num(row, 'Sort_Order', 'SortOrder', 'Order') ?? 0,
      active: bool(row, 'Active', 'Status')
    });
  });

  return categories;
}

function buildVariants(rows: Row[]): Map<string, Variant[]> {
  const byProduct = new Map<string, Variant[]>();
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    const variantId = str(row, 'Variant_ID', 'VariantID');
    const productId = str(row, 'Product_ID', 'ProductID');

    if (!variantId) {
      block(`Variants row ${i + 2}: missing Variant_ID.`);
      return;
    }
    if (!productId) {
      block(`Variants row ${i + 2} (${variantId}): missing Product_ID.`);
      return;
    }
    if (seen.has(variantId)) {
      block(`Variants row ${i + 2}: duplicate Variant_ID "${variantId}".`);
      return;
    }
    seen.add(variantId);

    const priceGhs = num(row, 'Price_GHS', 'PriceGHS', 'Price');
    if (priceGhs === undefined) {
      // A blank price means not sellable; it must never be treated as free.
      warn(`Variants ${variantId}: no Price_GHS, so it is imported as not sellable.`);
    }

    const variant: Variant = {
      variantId,
      versionOrPlan: versionString(row, `Variants ${variantId}`, 'Version_or_Plan', 'Version') || '',
      priceGhs: priceGhs ?? 0,
      latest: bool(row, 'Latest'),
      // A variant with no price cannot be sold whatever the sheet says.
      available: bool(row, 'Available') && priceGhs !== undefined && priceGhs > 0,
      licenceTerm: str(row, 'License_Term', 'Licence_Term') || '',
      os: str(row, 'OS', 'Operating_System') || '',
      macViaParallels: bool(row, 'Mac_Via_Parallels'),
      fulfilmentType: str(row, 'Fulfilment_Type', 'Fulfillment_Type') || '',
      deliverableType: str(row, 'Deliverable_Type') || '',
      activationMode: str(row, 'Activation_Mode') || '',
      autoFulfil: bool(row, 'Auto_Fulfil', 'Auto_Fulfill'),
      manualDelivery: bool(row, 'Manual_Delivery'),
      licenceRequiredForSelfActivation: bool(
        row,
        'Licence_Required_For_Self_Activation',
        'License_Required_For_Self_Activation'
      ),
      prerequisiteBeforeActivationCode: str(row, 'Prerequisite_Before_Activation_Code'),
      customerInputRequired: str(row, 'Customer_Input_Required'),
      sellerOutput: str(row, 'Seller_Output'),
      activationCodeOrKey: str(row, 'Activation_Code_or_Key'),
      activationWebsiteUrl: str(row, 'Activation_Website_URL') || str(row, 'Activation_Link'),
      activationLink: str(row, 'Activation_Link'),
      activationLinkLive: bool(row, 'Activation_Link_Live'),
      windowsInstallerUrl: str(row, 'Windows_Installer_URL'),
      guideUrl: str(row, 'Guide_URL'),
      learningResourcesUrl: str(row, 'Learning_Resources_URL'),
      notes: str(row, 'Notes')
    };

    const list = byProduct.get(productId) || [];
    list.push(variant);
    byProduct.set(productId, list);
  });

  return byProduct;
}

function buildProducts(
  rows: Row[],
  variantsByProduct: Map<string, Variant[]>,
  categoryIds: Set<string>
): Product[] {
  const products: Product[] = [];
  const seen = new Set<string>();

  rows.forEach((row, i) => {
    const productId = str(row, 'Product_ID', 'ProductID');
    if (!productId) {
      block(`Products row ${i + 2}: missing Product_ID.`);
      return;
    }
    if (seen.has(productId)) {
      block(`Products row ${i + 2}: duplicate Product_ID "${productId}".`);
      return;
    }
    seen.add(productId);

    // Products.Category (the free-text label) is dropped: categoryId is the
    // relationship and the display name comes from the category document.
    let categoryId = str(row, 'Category_ID', 'CategoryID');

    if (!categoryId) {
      const override = CATEGORY_OVERRIDES[productId];
      if (override) {
        categoryId = override;
        warn(
          `Products ${productId}: Category_ID is blank in the sheet; applying the ` +
            `owner's placement of "${override}". Change it in the admin portal, not here.`
        );
      } else {
        block(
          `Products row ${i + 2} (${productId}): Category_ID is blank and there is no ` +
            `agreed placement for it. Decide the category, then add it to CATEGORY_OVERRIDES.`
        );
        return;
      }
    }

    if (!categoryIds.has(categoryId)) {
      block(`Products ${productId}: Category_ID "${categoryId}" is not in the Categories tab.`);
      return;
    }

    products.push({
      productId,
      productName: str(row, 'Product_Name', 'Name') || productId,
      categoryId,
      description: str(row, 'Description', 'Short_Description') || undefined,
      defaultContact: str(row, 'Default_Contact'),
      imageUrl: str(row, 'Image_URL', 'ImageURL'),
      bannerImagePath: str(row, 'Banner_Image_URL', 'BannerImageURL') || undefined,
      screenshots: str(row, 'Screenshots', 'Gallery_URLs', 'GalleryURLs')
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
      active: bool(row, 'Active', 'Status'),
      sortOrder: num(row, 'Sort_Order', 'SortOrder') ?? 0,
      variants: variantsByProduct.get(productId) || []
    });
  });

  // A variant whose product does not exist would be invisible and unsellable.
  const productIds = new Set(products.map((p) => p.productId));
  for (const [productId, variants] of variantsByProduct) {
    if (!productIds.has(productId)) {
      block(
        `Variants: ${variants.length} row(s) reference Product_ID "${productId}", ` +
          `which is not in the Products tab (${variants.map((v) => v.variantId).join(', ')}).`
      );
    }
  }

  return products;
}

function buildBundles(rows: Row[], itemRows: Row[]): Bundle[] {
  const itemsByBundle = new Map<string, BundleItem[]>();

  itemRows.forEach((row, i) => {
    const bundleId = str(row, 'Bundle_ID', 'BundleID');
    const itemId = str(row, 'Item_ID', 'ItemID');
    if (!bundleId) {
      block(`Bundle_Items row ${i + 2}: missing Bundle_ID.`);
      return;
    }

    const list = itemsByBundle.get(bundleId) || [];
    list.push({
      itemId: itemId || `${bundleId}-${list.length + 1}`,
      productId: str(row, 'Product_ID', 'ProductID') || '',
      variantId: str(row, 'Variant_ID', 'VariantID') || '',
      // Alt_Group and Alt_Label express "choose one of these" within a bundle
      // and must survive the migration intact.
      altGroup: str(row, 'Alt_Group'),
      altLabel: str(row, 'Alt_Label'),
      sortOrder: num(row, 'Sort_Order', 'SortOrder') ?? list.length,
      notes: str(row, 'Notes')
    });
    itemsByBundle.set(bundleId, list);
  });

  const bundles: Bundle[] = [];
  rows.forEach((row, i) => {
    const bundleId = str(row, 'Bundle_ID', 'BundleID');
    if (!bundleId) {
      block(`Bundles row ${i + 2}: missing Bundle_ID.`);
      return;
    }

    const priceGhs = num(row, 'Price_GHS', 'PriceGHS', 'Price');
    if (priceGhs === undefined) {
      block(`Bundles ${bundleId}: missing Price_GHS. A bundle price is fixed, not a sum.`);
      return;
    }

    bundles.push({
      bundleId,
      name: str(row, 'Name', 'Bundle_Name') || bundleId,
      description: str(row, 'Description') || '',
      priceGhs,
      categoryId: str(row, 'Category_ID', 'CategoryID') || 'BUNDLE',
      sortOrder: num(row, 'Sort_Order', 'SortOrder') ?? 0,
      active: bool(row, 'Active', 'Status'),
      items: (itemsByBundle.get(bundleId) || []).sort((a, b) => a.sortOrder - b.sortOrder)
    });
  });

  const bundleIds = new Set(bundles.map((b) => b.bundleId));
  for (const bundleId of itemsByBundle.keys()) {
    if (!bundleIds.has(bundleId)) {
      block(`Bundle_Items reference Bundle_ID "${bundleId}", which is not in the Bundles tab.`);
    }
  }

  return bundles;
}

function buildServices(rows: Row[]): Service[] {
  const services: Service[] = [];

  rows.forEach((row, i) => {
    const serviceId = str(row, 'Service_ID', 'ServiceID');
    if (!serviceId) {
      block(`Services row ${i + 2}: missing Service_ID.`);
      return;
    }

    services.push({
      serviceId,
      name: str(row, 'Name', 'Service_Name') || serviceId,
      tagline: str(row, 'Tagline') || '',
      description: str(row, 'Description') || '',
      categoryId: str(row, 'Category_ID', 'CategoryID') || 'SERVICE',
      instructions: str(row, 'Instructions'),
      fields: parseServiceFields(str(row, 'Fields'), serviceId),
      ctaLabel: str(row, 'CTA_Label') || 'Request this service',
      ctaNote: str(row, 'CTA_Note'),
      // Price lives on the option, never on the service. A sheet row with a
      // Price_GHS column is reported rather than silently dropped.
      active: bool(row, 'Status', 'Active'),
      sortOrder: num(row, 'Sort_Order', 'SortOrder') ?? 0
    });

    if (num(row, 'Price_GHS', 'PriceGHS', 'Price') !== undefined) {
      warn(
        `Services ${serviceId}: a Price_GHS value was ignored. Priced services carry ` +
          `their price on options[] — add it to a seed module like ` +
          `server/seed/turnitin.ts.`
      );
    }
  });

  return services;
}

function buildLaptops(rows: Row[]): Laptop[] {
  const laptops: Laptop[] = [];

  rows.forEach((row, i) => {
    const laptopId = str(row, 'Laptop_ID', 'LaptopID');
    if (!laptopId) {
      block(`Laptops row ${i + 2}: missing Laptop_ID.`);
      return;
    }

    laptops.push({
      laptopId,
      title: str(row, 'Title', 'Name') || laptopId,
      // A blank price means "ask for price" and must stay absent, never 0.
      priceGhs: num(row, 'Price_GHS', 'PriceGHS', 'Price'),
      categoryId: str(row, 'Category_ID', 'CategoryID') || 'LAPTOP',
      brand: str(row, 'Brand') || '',
      model: str(row, 'Model') || '',
      processor: str(row, 'Processor') || '',
      ram: str(row, 'RAM') || '',
      storage: str(row, 'Storage') || '',
      screen: str(row, 'Screen') || '',
      colour: str(row, 'Colour', 'Color') || '',
      graphics: str(row, 'Graphics') || '',
      graphicsDetails: str(row, 'Graphics_Details'),
      ports: str(row, 'Ports') || '',
      operatingSystem: str(row, 'Operating_System', 'OS') || '',
      freebies: str(row, 'Freebies'),
      picturesUrl: urlList(row, 'Pictures_URL', 'PicturesURL', 'Pictures'),
      availability: str(row, 'Availability') || 'Available',
      notes: str(row, 'Notes'),
      active: bool(row, 'Status', 'Active'),
      sortOrder: num(row, 'Sort_Order', 'SortOrder') ?? 0
    });
  });

  return laptops;
}

/** The Orders tab is empty in the supplied workbook; zero rows is normal. */
function buildOrders(rows: Row[]): Order[] {
  if (rows.length === 0) return [];

  const orders: Order[] = [];
  rows.forEach((row, i) => {
    const orderId = str(row, 'Order_ID', 'OrderID');
    if (!orderId) {
      skip(`Orders row ${i + 2}: no Order_ID, row skipped.`);
      return;
    }

    const paymentStatus = (str(row, 'Payment_Status') || '').toLowerCase();
    const fulfilment = (str(row, 'Fulfilment_Status', 'Fulfillment_Status') || '').toLowerCase();

    orders.push({
      orderId,
      cartId: str(row, 'Cart_ID') || orderId,
      orderDate: str(row, 'Order_Date') || '',
      lastUpdated: str(row, 'Last_Updated') || '',
      customerName: str(row, 'Customer_Name') || '',
      phone: str(row, 'Phone') || '',
      email: str(row, 'Email') || '',
      variantId: str(row, 'Variant_ID') || '',
      productName: str(row, 'Product_Name') || '',
      versionOrPlan: versionString(row, `Orders ${orderId}`, 'Version_or_Plan') || '',
      deliveryOs: str(row, 'Delivery_OS') || '',
      amountGhs: num(row, 'Amount_GHS') ?? 0,
      originalAmountGhs: num(row, 'Original_Amount_GHS'),
      paymentStatus: paymentStatus === 'paid' ? 'paid' : 'pending',
      fulfilmentStatus: fulfilment.includes('ready')
        ? 'ready'
        : fulfilment.includes('input')
          ? 'awaiting-customer-input'
          : fulfilment.includes('licence') || fulfilment.includes('license')
            ? 'awaiting-licence'
            : fulfilment.includes('activation') || fulfilment.includes('seller')
              ? 'awaiting-seller-activation'
              : 'pending-payment',
      fulfilmentType: str(row, 'Fulfilment_Type'),
      customerInputType: str(row, 'Customer_Input_Type') as Order['customerInputType'],
      customerInputValue: str(row, 'Customer_Input_Value'),
      salesCode: str(row, 'Sales_Code'),
      activationCodeOrKey: str(row, 'Activation_Code_or_Key'),
      licenceId: str(row, 'License_ID', 'Licence_ID'),
      activationWebsiteUrl: str(row, 'Activation_Website_URL'),
      paystackReference: str(row, 'Paystack_Reference'),
      receiptSent: bool(row, 'Receipt_Sent'),
      emailStatus: str(row, 'Email_Status'),
      fulfilledAt: str(row, 'Fulfilled_At'),
      notes: str(row, 'Notes'),
      windowsInstallerUrl: str(row, 'Windows_Installer_URL'),
      guideUrl: str(row, 'Guide_URL'),
      learningResourcesUrl: str(row, 'Learning_Resources_URL'),
      macViaParallels: bool(row, 'Mac_Via_Parallels')
    });
  });

  return orders;
}

/** The four request tabs become one collection with a `kind` discriminator, so
 *  the admin portal gets one inbox instead of four. */
function buildRequests(tabs: Map<string, Row[]>): CustomerRequest[] {
  const sources: Array<{ tab: string; kind: RequestKind; prefix: string }> = [
    { tab: TAB.laptopRequests, kind: 'laptop-request', prefix: 'LR' },
    { tab: TAB.laptopEnquiries, kind: 'laptop-enquiry', prefix: 'LE' },
    { tab: TAB.customBundleRequests, kind: 'custom-bundle', prefix: 'CB' },
    { tab: TAB.humanizingRequests, kind: 'humanizing', prefix: 'HR' }
  ];

  const requests: CustomerRequest[] = [];

  for (const source of sources) {
    const rows = tabs.get(source.tab);
    if (!rows) {
      warn(`Tab "${source.tab}" not found; no ${source.kind} requests imported.`);
      continue;
    }

    rows.forEach((row, i) => {
      const requestId =
        str(row, 'Request_ID', 'RequestID', 'Enquiry_ID', 'ID') || `${source.prefix}-${i + 1}`;

      // Common fields stay flat; everything type-specific goes under details.
      const common = new Set(
        [
          'Request_ID', 'RequestID', 'Enquiry_ID', 'ID', 'Request_Date', 'Date',
          'Customer_Name', 'Name', 'Phone', 'Email', 'Status', 'Notes'
        ].map(normaliseHeader)
      );

      const details: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!common.has(key) && value !== null && value !== undefined && value !== '') {
          details[key] = typeof value === 'object' ? String(str({ k: value }, 'k') ?? '') : value;
        }
      }

      requests.push({
        requestId,
        kind: source.kind,
        requestDate: str(row, 'Request_Date', 'Date', 'Submitted_At') || '',
        customerName: str(row, 'Customer_Name', 'Name') || '',
        phone: str(row, 'Phone') || '',
        email: str(row, 'Email'),
        status: str(row, 'Status') || 'new',
        notes: str(row, 'Notes'),
        details
      });
    });
  }

  return requests;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Firestore caps a batch at 500. The whole dataset fits in one today, but it
 *  is batched anyway so this still works as the catalogue grows. */
const BATCH_LIMIT = 450;

interface Writeable {
  collection: string;
  docId: string;
  data: Record<string, unknown>;
}

async function writeAll(db: Firestore, docs: Writeable[]): Promise<void> {
  let batch: WriteBatch = db.batch();
  let pending = 0;

  for (const doc of docs) {
    batch.set(db.collection(doc.collection).doc(doc.docId), doc.data);
    pending += 1;

    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { file?: string; dryRun: boolean; seedOnly: boolean } {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  // --seed-turnitin on its own seeds the coded services without a workbook.
  const seedOnly = args.includes('--seed-turnitin');
  const fileFlag = args.indexOf('--file');
  let file = fileFlag >= 0 ? args[fileFlag + 1] : undefined;
  if (!file) file = args.find((a) => a.endsWith('.xlsx'));
  return { file, dryRun, seedOnly };
}

function firestoreClient(): Firestore {
  return new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
    ignoreUndefinedProperties: true,
    ...(process.env.FIRESTORE_DATABASE_ID ? { databaseId: process.env.FIRESTORE_DATABASE_ID } : {})
  });
}

/**
 * Services that are defined in code rather than in the workbook.
 *
 * Turnitin was never a row in the Services tab, so there is nothing to migrate:
 * it is seeded from server/seed/turnitin.ts, which keeps it reproducible and
 * reviewable instead of hand-entered in the console. Seeding uses the same
 * document ids, so it is as idempotent as the rest of the import.
 */
async function seedCodedServices(dryRun: boolean): Promise<void> {
  const db = firestoreClient();

  // A seeded service whose categoryId matches no category is invisible: it
  // stays in the catalogue payload but renders under no category card, so the
  // storefront simply never shows it. That is a silent failure, so it is
  // checked before anything is written.
  const categorySnap = await db.collection('categories').get();
  const categoryIds = new Set(categorySnap.docs.map((d) => d.id));

  console.log('Seeded services (defined in code, not in the workbook):');

  const orphans: string[] = [];
  for (const service of SEED_SERVICES) {
    const priced = service.options?.length
      ? `${service.options.length} option(s), from ${Math.min(
          ...service.options.map((o) => o.unitPriceGhs)
        ).toFixed(2)} GHS`
      : 'quote-only';

    const existing = await db.collection('services').doc(service.serviceId).get();
    const state = existing.exists ? 'already present, will be overwritten' : 'new';

    console.log(`  ${service.serviceId.padEnd(12)} ${service.name} — ${priced} (${state})`);
    console.log(`  ${''.padEnd(12)} category ${service.categoryId}: ${
      categoryIds.has(service.categoryId) ? 'found' : 'NOT FOUND'
    }`);

    if (!categoryIds.has(service.categoryId)) orphans.push(service.serviceId);
  }

  if (orphans.length) {
    console.error(
      `\nBLOCKED — nothing written. ${orphans.join(', ')} name a categoryId that does not ` +
        `exist in Firestore, so the storefront would never show them.\n` +
        `  categories present: ${[...categoryIds].sort().join(', ') || '(none — run the migration first)'}\n` +
        `  Set categoryId in server/seed/turnitin.ts to one of those, then run again.`
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log('  --dry-run: nothing written.\n');
    return;
  }

  await writeAll(
    db,
    SEED_SERVICES.map((s) => ({ collection: 'services', docId: s.serviceId, data: { ...s } }))
  );
  console.log(`  Wrote ${SEED_SERVICES.length} seeded service document(s).\n`);
}

async function main(): Promise<void> {
  const { file, dryRun, seedOnly } = parseArgs(process.argv);

  // --seed-turnitin without a workbook seeds only the coded services.
  if (seedOnly && !file) {
    await seedCodedServices(dryRun);
    return;
  }

  if (!file) {
    console.error(
      'Usage:\n' +
        '  npx tsx scripts/migrate-sheet-to-firestore.ts --file <workbook.xlsx> [--dry-run]\n' +
        '  npx tsx scripts/migrate-sheet-to-firestore.ts --seed-turnitin [--dry-run]'
    );
    process.exit(2);
  }

  console.log(`Reading ${path.resolve(file)}`);
  const tabs = await readWorkbook(file);
  console.log(`Found ${tabs.size} tabs: ${[...tabs.keys()].join(', ')}\n`);

  for (const ignored of NOT_IMPORTED_TABS) {
    const rows = tabs.get(ignored);
    if (rows?.length) {
      skip(
        `${ignored}: ${rows.length} row(s) deliberately not imported. The licence pool is ` +
          `populated through the admin portal in Phase 2 — see spec §3 for the defects ` +
          `that must be resolved first.`
      );
    }
  }

  // ---- Parse and validate everything before writing anything ----
  const categories = buildCategories(requireTab(tabs, TAB.categories));
  const categoryIds = new Set(categories.map((c) => c.categoryId));
  const variantsByProduct = buildVariants(requireTab(tabs, TAB.variants));
  const products = buildProducts(requireTab(tabs, TAB.products), variantsByProduct, categoryIds);
  const bundles = buildBundles(requireTab(tabs, TAB.bundles), requireTab(tabs, TAB.bundleItems));
  const services = buildServices(requireTab(tabs, TAB.services));
  const laptops = buildLaptops(requireTab(tabs, TAB.laptops));
  const orders = buildOrders(tabs.get(TAB.orders) || []);
  const requests = buildRequests(tabs);

  const built: Built = {
    categories,
    products,
    bundles,
    services,
    laptops,
    orders,
    requests,
    announcements: [],
    variantCount: products.reduce((n, p) => n + p.variants.length, 0),
    bundleItemCount: bundles.reduce((n, b) => n + b.items.length, 0)
  };

  // ---- Report ----
  if (report.warnings.length) {
    console.log('Applied and reported:');
    report.warnings.forEach((w) => console.log(`  - ${w}`));
    console.log('');
  }

  if (report.skipped.length) {
    console.log('Skipped:');
    report.skipped.forEach((s) => console.log(`  - ${s}`));
    console.log('');
  }

  console.log('Would write:');
  console.log(`  categories      ${built.categories.length}`);
  console.log(`  products        ${built.products.length} (${built.variantCount} embedded variants)`);
  console.log(`  bundles         ${built.bundles.length} (${built.bundleItemCount} items)`);
  console.log(`  services        ${built.services.length}`);
  console.log(`  laptops         ${built.laptops.length}`);
  console.log(`  orders          ${built.orders.length}`);
  console.log(`  requests        ${built.requests.length}`);
  console.log(`  licencePool     0 (deliberately not imported)`);
  console.log('');

  if (report.blocking.length) {
    console.error('BLOCKED — nothing has been written:');
    report.blocking.forEach((b) => console.error(`  - ${b}`));
    console.error(
      `\n${report.blocking.length} blocking defect(s). Fix the workbook (or record an ` +
        `agreed resolution in this script) and run again.`
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log('--dry-run: nothing written.');
    return;
  }

  // ---- Write ----
  const docs: Writeable[] = [
    ...built.categories.map((c) => ({ collection: 'categories', docId: c.categoryId, data: { ...c } })),
    ...built.products.map((p) => ({ collection: 'products', docId: p.productId, data: { ...p } })),
    ...built.bundles.map((b) => ({ collection: 'bundles', docId: b.bundleId, data: { ...b } })),
    ...built.services.map((s) => ({ collection: 'services', docId: s.serviceId, data: { ...s } })),
    ...built.laptops.map((l) => ({ collection: 'laptops', docId: l.laptopId, data: { ...l } })),
    ...built.orders.map((o) => ({ collection: 'orders', docId: o.orderId, data: { ...o } })),
    ...built.requests.map((r) => ({ collection: 'requests', docId: r.requestId, data: { ...r } }))
  ];

  const db = firestoreClient();

  await writeAll(db, docs);
  console.log(`Wrote ${docs.length} documents.\n`);

  // Services defined in code are seeded as part of a normal run, so one
  // command leaves a complete catalogue.
  await seedCodedServices(false);
  console.log(
    'Expected on a clean run: 5 categories, 19 products carrying 48 variants, 7 bundles ' +
      'with 25 items, 2 services, 2 laptops, 0 licences and 0 orders. Any other numbers ' +
      'mean something was dropped — investigate rather than proceed.'
  );
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
