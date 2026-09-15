# Phase 1 — Firestore migration and real data

Implementation spec for the Hack-Key Tech storefront
(`github.com/Hackey27/hackkey-tech-store`). Written to be executed by Claude
Code against the repo.

**Goal:** the storefront serves the real catalogue from Firestore, and orders
survive container restarts. When this lands, three reported bugs disappear
without being addressed individually — empty Services/Bundles/Laptops
categories, wrong software versions, and order lookup returning a stranger's
name — because all three are symptoms of the same cause.

---

## 0. The problem being fixed

`server/storeDatabase.ts` is roughly a thousand lines of fabricated data. The
Google Sheet has never been read by the running application:
`server/sheetsDataSource.ts` and `server/catalogService.ts` exist but are
imported by nothing, and no Google API client is installed.

Verified gaps between the real sheet and what the site serves:

| | Real sheet | Site currently shows |
|---|---|---|
| Products | 19 | a handful |
| Variants | 48 | a handful |
| AMOS versions | 31, 30, 29, 28 (latest: 31) | 29, 28 (claims 29 is latest) |
| SmartPLS versions | 4.1.1.8 Win + Mac, .6, .4, .2, .1 | 4.1.1.8 and 3.3.9 |
| SmartPLS 3.3.9 | does not exist | shown as available |
| Services / Bundles / Laptops | 2 / 7 / 2 published | categories render empty |

The `3.3.9` is the clearest tell: it is invented, not mis-parsed.

---

## 1. Data source

The spreadsheet is the migration input only, not a runtime dependency. After
migration, Firestore is the single source of truth and the sheet is historical.
Do not add a Sheets API client.

Workbook: `Copy of Software_Store_Database_Self_Activation_Updated 3.xlsx`,
14 tabs, 115 data rows.

Tabs to migrate: `Categories`, `Products`, `Variants`, `Bundles`,
`Bundle_Items`, `Services`, `Laptops`, `License_Pool`, `Orders`,
`Laptop_Requests`, `Laptop_Enquiries`, `Custom_Bundle_Requests`,
`Humanizing_Requests`.

Tab to ignore: `Tips` — empty, and the feature was deliberately removed from
the previous system.

---

## 2. Firestore model

### Conventions

- **camelCase everywhere** in Firestore and TypeScript. The sheet's
  `Product_ID` / `Price_GHS` style is mapped once, in the migration.
- **Delete the legacy alias fields.** `src/types.ts` currently carries
  duplicate pairs (`product_id` and `id`, `product_name` and `name`,
  `price_ghs` and `priceGhs`, `osList` and `resolved_os_list`). Each pair is a
  place for the two halves to disagree. Keep one field per concept.
- Money is stored as a **number** in whole Ghana cedis. Never a string.
- Booleans are real booleans. The sheet's `Yes`/`No`, `Published`/`Draft` and
  `Available`/`Unavailable` are converted at import, not at read time.

### Collections

```
categories/{categoryId}          5 docs
products/{productId}            19 docs, variants embedded
bundles/{bundleId}               7 docs, items embedded
services/{serviceId}             2 docs
laptops/{laptopId}               2 docs
licencePool/{licenceId}          schema only — NO data imported, see §3
orders/{orderId}                 currently 0
requests/{requestId}             all four request types, discriminated
announcements/{announcementId}   new — see §6
reviews/{reviewId}               new — schema only, unused until Phase 3
```

### Why variants are embedded, not a subcollection

48 variants across 19 products, maximum 8 on any one product. The catalogue
endpoint always wants a product together with its variants, so embedding turns
an N+1 read into a single query, and the documents stay far below Firestore's
1 MB limit. Revisit only if a product ever approaches ~50 variants or variants
need to be queried independently of their product.

The licence pool references variants by id string. No join is required.

### `products/{productId}`

Source: `Products` tab, plus its rows from `Variants`.

```ts
{
  productId: string          // Product_ID     e.g. "AMOS"
  productName: string        // Product_Name — customer-facing, always wins
  categoryId: string         // Category_ID
  defaultContact?: string    // Default_Contact
  imageUrl?: string          // Image_URL — every product has one; drives the
                             //   icons requested for category browsing
  active: boolean            // Active: "Yes" -> true
  sortOrder?: number
  variants: Variant[]        // embedded, see below
}
```

`Products.Category` (the free-text label) is dropped — `categoryId` is the
relationship, and the display name comes from the category document.

### `Variant` (embedded)

Source: `Variants` tab. All 27 columns carry meaning; none may be silently
dropped.

```ts
{
  variantId: string               // Variant_ID  e.g. "WINPLS01"
  versionOrPlan: string           // Version_or_Plan — SEE §3, stored as text
  priceGhs: number                // Price_GHS
  latest: boolean                 // Latest — the "recommended" badge
  available: boolean              // Available
  licenceTerm: string             // License_Term
  os: string                      // OS
  macViaParallels: boolean        // Mac_Via_Parallels
  fulfilmentType: string          // Fulfilment_Type
  deliverableType: string         // Deliverable_Type
  activationMode: string          // Activation_Mode
  autoFulfil: boolean             // Auto_Fulfil
  manualDelivery: boolean         // Manual_Delivery
  licenceRequiredForSelfActivation: boolean
  prerequisiteBeforeActivationCode?: string
  customerInputRequired?: string  // "Lock Code" | "Hardware ID" | blank
  sellerOutput?: string
  activationCodeOrKey?: string
  activationWebsiteUrl?: string
  activationLink?: string
  activationLinkLive: boolean
  windowsInstallerUrl?: string
  guideUrl?: string
  learningResourcesUrl?: string
  notes?: string
}
```

### `bundles/{bundleId}`

`Bundles` plus its `Bundle_Items` rows embedded as `items[]`, carrying
`itemId`, `productId`, `variantId`, `altGroup`, `altLabel`, `sortOrder`,
`notes`. `Alt_Group` and `Alt_Label` express "choose one of these" within a
bundle and must survive the migration intact.

### `services/{serviceId}` and `laptops/{laptopId}`

Straight column mapping. Two things to preserve carefully:

- `Services.Fields` defines the per-service enquiry form. Parse it into
  structured JSON at import rather than storing the raw string, and fail the
  import loudly if it doesn't parse.
- `Laptops.Pictures_URL` may hold several URLs. Store as `string[]`.

`Status: "Published"` maps to `active: true`.

### `licencePool/{licenceId}`

**Do not import the `License_Pool` tab.** The collection is created empty and
populated later through the admin portal. Define the shape now so the
assignment code and the Phase 2 admin screens have something to build against.

Status vocabulary observed in the sheet: `Available`, `Assigned`.

```ts
{
  licenceId: string
  variantId: string
  licenceCode: string        // License_Code_or_Key
  codeType?: string
  status: 'available' | 'assigned'
  assignedOrderId?: string
  dateAdded?: Timestamp
  dateAssigned?: Timestamp
  notes?: string
}
```

### `orders/{orderId}`

Map all 33 columns from `Orders`. The tab is empty in the supplied workbook, so
the importer must handle zero rows without failing. Dates become Firestore
`Timestamp`, money becomes `number`, `Receipt_Sent` and similar flags become
booleans.

### `requests/{requestId}`

The four request tabs share most fields. Merge into one collection with a
`kind` discriminator — `'laptop-request' | 'laptop-enquiry' | 'custom-bundle' |
'humanizing'` — keeping common fields flat (`requestDate`, `customerName`,
`phone`, `email`, `status`, `notes`) and type-specific fields under a nested
`details` object. This gives the admin portal one inbox instead of four.

---

## 3. Data defects to handle

These are real problems in the source data. The importer must **report** them,
and must not paper over them.

**Version numbers arrive as floats.** Excel coerced the AMOS versions, so they
read as `31.0`, `30.0`, `29.0`, `28.0`. Imported naively the site would
advertise "AMOS 31.0". Normalise: if the value is numeric and integral, render
without a decimal; otherwise keep the exact string (`4.1.1.8` must not be
touched). Store the result as a string, always.

**Parallels Desktop has no `Category_ID`.** Product `PD` is `Active = Yes` but
its category is blank in the sheet. Import it as `categoryId: 'DESIGN'` via an
explicit, commented override in the script — a single-entry map, not a silent
default. This is a **temporary placement decided by the owner**; Firestore
becomes the source of truth after migration, so it can be changed in the admin
portal later without touching the script. Do not "fix" it back to blank.

### Deferred: licence pool defects

The `License_Pool` tab is not imported (§2), so the following are **not
blockers for this phase**. They are recorded because they must be resolved
before licences are loaded through the admin portal in Phase 2:

- Four rows reference variant `PLS01`, which does not exist. The Variants tab
  defines `WINPLS01`, `MACPLS01`, `WINPLS02`–`WINPLS05`; `PLS01` appears to
  predate the Windows/Mac split. Someone must decide which variant those keys
  belong to.
- Three rows have a blank `License_ID` while already marked `Assigned`, so they
  can be neither addressed nor audited.
- Three keys with status `Available` were shared unmasked and should be treated
  as compromised — rotate rather than re-enter them.

---

## 4. Migration script

`scripts/migrate-sheet-to-firestore.ts`, run manually, never from CI.

Requirements:

- **Idempotent.** Use the sheet's own identifiers as document ids so a re-run
  overwrites rather than duplicates. It must be safe to run repeatedly while
  iterating.
- **Validate, then write.** Parse and check the whole workbook first. If any
  defect in §3 is present, print a report and exit non-zero **having written
  nothing.** A partial import is worse than no import.
- `--dry-run` prints what would be written, with per-collection counts.
- Batched writes (Firestore caps a batch at 500; the whole dataset fits in one,
  but batch anyway so it still works as the catalogue grows).
- Print a summary: documents per collection, and every skipped row with its
  reason.

Expected result on a clean run: 5 categories, 19 products carrying 48 embedded
variants, 7 bundles with 25 items, 2 services, 2 laptops, **0 licences**
(deliberately not imported) and 0 orders. Any other numbers mean something was
dropped — investigate rather than proceed.

---

## 5. Server changes

**Delete** `server/storeDatabase.ts`, `server/sheetsDataSource.ts` and
`server/catalogService.ts`. The first is fabricated data; the other two are
dead code. Do not preserve any of the seeded content.

**Add** `server/firestore.ts` — initialise `@google-cloud/firestore` using
Application Default Credentials. On Cloud Run the runtime service account
supplies these automatically; **no key file and no `GOOGLE_SERVICE_ACCOUNT_*`
environment variables are needed.** Those variables become obsolete and should
be removed from the Cloud Run service once this ships.

**Add** `server/catalogue.ts` — assembles the catalogue response by reading
`categories`, `products`, `bundles`, `services` and `laptops`, and **merging
bundles, services and laptops into the catalogue alongside products**, each
tagged with a `kind` field so the frontend can render them appropriately. This
is what makes the three empty categories populate; it is the fix for that
report, and it must not be skipped.

Keep the existing API paths and response shapes so the frontend continues to
work unchanged in this phase.

**Licence assignment must be a Firestore transaction**: read one licence where
`variantId == X && status == 'available'`, mark it `assigned` with the order
id, and attach it to the order — atomically. Without a transaction, two
simultaneous orders can be handed the same key.

**The pool is empty for the whole of this phase, so the empty case is the
normal case — not an edge case.** Every variant with `autoFulfil = true` will
find no available licence. The transaction must resolve this cleanly: leave the
order valid and paid, set its fulfilment status to something like
`awaiting-licence`, and record that a licence could not be issued so the owner
can act on it. It must never throw, never silently mark the order fulfilled,
and never tell the customer a licence is on its way when none exists. Get this
right now; once the pool is populated in Phase 2 this path becomes rare and
correspondingly easy to leave broken without noticing.

**Cache the catalogue** in memory for 60 seconds. The catalogue changes rarely
and every page load reads it.

---

## 6. Announcements

The feature is half-built: the `Announcement` type exists, the server already
returns it on the catalogue response, but no component renders it. Move it to
Firestore and give it the fields the previous Apps Script version lacked:

```ts
{
  announcementId: string
  title: string
  message: string
  buttonText?: string
  buttonUrl?: string
  showOnce: boolean
  active: boolean
  startsAt?: Timestamp     // new — scheduling
  endsAt?: Timestamp       // new
  createdAt: Timestamp
}
```

Return only announcements that are `active` and within their window. Building
the storefront component and the admin editor belongs to Phase 2; this phase
only needs the data in place.

---

## 7. Security rules

The application reaches Firestore **only** from the server. Client-side
Firestore access is never used.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

Deny-all is correct here: the Admin SDK bypasses rules, and this prevents
anyone reading `orders` or `licencePool` directly from a browser. Those
collections hold customer contact details and unissued licence keys.

---

## 8. Definition of done

- `npm run lint` and `npm run build` pass.
- The production path verifies — build, `npm ci --omit=dev`, run with
  `NODE_ENV=production`, and confirm `/api/health` and `/api/catalog` respond.
  (This check previously caught a crash that would have broken every deploy.)
- `/api/catalog` returns 19 products with 48 variants, and non-empty Services,
  Bundles and Laptops.
- AMOS shows four versions with **31** recommended. SmartPLS shows six
  including the macOS variant, and **no 3.3.9 anywhere**.
- Parallels Desktop appears under Design and Engineering Software.
- An order placed through checkout still exists after the Cloud Run service is
  restarted.
- An order for an auto-fulfil variant, placed against the empty licence pool,
  comes out marked as awaiting a licence — not failed, and not falsely
  fulfilled.
- No file in `server/` contains fabricated product or customer data.
- `CLAUDE.md` is updated: the warning that the catalogue is fabricated is now
  obsolete and must be replaced with a description of the Firestore model,
  and the in-memory orders landmine removed.

---

## 9. Explicitly out of scope

The admin portal (Phase 2), the product page redesign, category-as-page,
reviews UI, and all visual polish. This phase ends when the site serves real
data and orders persist. Resist pulling any of it forward — the product page in
particular gets rebuilt in Phase 3 and would be wasted work now.
