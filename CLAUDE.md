# Hack-Key Tech Store

A single-container storefront: Express serves the API and the built React SPA
from one process, with Firestore behind it.

## Commands

```bash
npm run dev     # Vite middleware + API on :3000
npm run lint    # tsc --noEmit
npm test        # node:test via tsx — money and submission rules
npm run build   # SPA -> dist/, server bundle -> dist-server/
npm start       # node dist-server/server.cjs
npm run seed    # seed services defined in code (Turnitin)
```

## Data

**Firestore is the single source of truth.** The spreadsheet it was migrated
from is historical and is not read at runtime — there is no Sheets client, and
adding one would be a step backwards.

Collections (all camelCase, in Firestore and in TypeScript):

| Collection | Contents |
| --- | --- |
| `categories/{categoryId}` | The five browsable departments. |
| `products/{productId}` | Variants are **embedded** as `variants[]`, not a subcollection. |
| `bundles/{bundleId}` | Items embedded as `items[]`; `altGroup`/`altLabel` mean "choose one of these". |
| `services/{serviceId}` | `fields[]` is the parsed enquiry form. `options[]` present => purchasable. |
| `laptops/{laptopId}` | `picturesUrl` is a `string[]`. |
| `licencePool/{licenceId}` | **Empty in Phase 1.** Populated through the admin portal in Phase 2. |
| `orders/{orderId}` | Survives instance restarts, which is the point of all this. |
| `requests/{requestId}` | All request kinds in one inbox, discriminated by `kind`. |
| `announcements/{announcementId}` | Returned only while `active` and inside `startsAt`/`endsAt`. |
| `reviews/{reviewId}` | Schema only, unused until Phase 3. |

Variants are embedded because the catalogue always wants a product together
with its variants: it turns an N+1 read into one query, and the documents stay
far below the 1 MB limit. Revisit only if a product approaches ~50 variants, or
variants need querying independently of their product.

### Conventions that matter

- **One field per concept.** There are deliberately no alias pairs
  (`product_id` *and* `id`, `price_ghs` *and* `priceGhs`). The old model had
  them and the two halves drifted apart.
- **Money is a number** in Ghana cedis, never a string. It is no longer always
  a whole number: ₵47.50 exists, so see the pesewa rule below.
- **Booleans are real booleans.** The sheet's `Yes`/`No`, `Published`/`Draft`
  and `Available`/`Unavailable` were converted at import, not at read time.
- **Version numbers are always strings.** Excel coerced them to floats, so
  migration normalises `31.0` to `"31"` while leaving `"4.1.1.8"` untouched.
- **A blank price is not a free item.** It means "ask for price": the field
  stays absent and the item is not sellable.
- **Money is calculated in integer pesewas.** `src/utils/money.ts` is the only
  place money arithmetic happens. Cedis are for storage and display; every
  calculation converts to pesewas first. ₵47.50 is the first non-integer price
  in the system and float cedis accumulate error.

### Priced services

A service with `options[]` is **purchasable** and goes through the same cart and
checkout as software. A service without them stays quote-only — Data Analysis
and Transcription are untouched. Price lives on the option, never on the
service.

`bulkPriceGhs` **replaces** `unitPriceGhs` for every unit once the quantity
reaches `bulkFromQty`. Two AI checks are ₵95.00, not ₵97.50. A tiered
calculation overcharges every bulk customer by an amount nobody reports, so it
is covered by tests — run `npm test` before touching `priceServiceLine`.

A service order has `fulfilmentType: 'Service'` and **never touches the licence
pool**: the auto-fulfil transaction is skipped for it entirely. Landing one in
`awaiting-licence` would be meaningless and would hide it from the seller's
queue. Paid service orders sit in `awaiting-document` until the document
arrives, then move to `awaiting-seller-activation`.

Turnitin is seeded from `server/seed/turnitin.ts` rather than migrated: it was
never a row in the Services tab. Re-seed with `npm run seed`; never hand-enter
it in the console.

## Server layout

| File | Responsibility |
| --- | --- |
| `server/firestore.ts` | Client, initialised from Application Default Credentials. |
| `server/catalogue.ts` | Assembles and caches the catalogue response. |
| `server/orders.ts` | Checkout, order lookup, licence assignment. |
| `server/pricingConfig.ts` | Pricing rules — neutral by default; the admin portal owns them from Phase 2. |
| `server/storage.ts` | Customer document uploads: signed URLs, server-side limits, form validation. |
| `server/seed/turnitin.ts` | Services defined in code rather than migrated. |

The catalogue merges bundles, services and laptops in alongside products, each
tagged with `kind`. That merge is what stops the Services, Bundles and Laptops
categories rendering empty; if a category ever looks empty again, check it
before suspecting the data. The response is cached in memory for 60 seconds.

### Licence assignment

Claiming a key is a **Firestore transaction**: reading an available licence for
the variant, marking it `assigned`, and attaching it to the order happen
atomically. Without that, two simultaneous orders can be handed the same key.

**The pool is empty for the whole of Phase 1, so "no licence available" is the
normal path, not an edge case.** When nothing is available the order stays
valid and paid and moves to `awaiting-licence` with a note recording why. It
must never throw, never mark the order fulfilled, and never tell the customer a
licence is on its way when none exists. Once the pool is populated this path
becomes rare, which is exactly how it would come to be broken unnoticed.

## Credentials

Firestore uses Application Default Credentials. On Cloud Run the runtime
service account supplies them automatically: **no key file, and no
`GOOGLE_SERVICE_ACCOUNT_*` environment variables** — those are obsolete and
should be removed from the Cloud Run service. Locally, use
`gcloud auth application-default login`, or set `FIRESTORE_EMULATOR_HOST`.

`firestore.rules` denies all client access on purpose: the app reaches
Firestore only from the server, whose Admin SDK bypasses rules. That keeps
`orders` and `licencePool` — customer contact details and unissued keys — out
of reach of a browser.

`/api/admin/data` returns that same sensitive data. In production it is
disabled until `ADMIN_TOKEN` is set, and then requires it in an
`x-admin-token` header.

`storage.rules` denies all client access for the same reason. Customer
documents are unpublished academic work: an upload URL is issued only against an
existing **paid** order, the 20 MB and PDF/DOC/DOCX limits are enforced
server-side as a condition of the signed URL rather than trusted from the
browser, and retrieval is a short-lived signed download URL.

## Migration

`scripts/migrate-sheet-to-firestore.ts` is run by hand, never from CI:

```bash
npx tsx scripts/migrate-sheet-to-firestore.ts --file <workbook>.xlsx --dry-run
```

It validates the whole workbook before writing anything and exits non-zero on a
blocking defect, because a partial import is worse than no import. Document ids
are the sheet's own identifiers, so re-running overwrites rather than
duplicates. See `docs/phase-1-firestore-spec.md` for the full data model and
the licence-pool defects that must be resolved before Phase 2.
