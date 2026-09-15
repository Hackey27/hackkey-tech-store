# Phase 1.5 — Priced services (restoring Turnitin)

Implementation spec for `github.com/Hackey27/hackkey-tech-store`. Executes
against the code Phase 1 delivered (`79f051b`).

**Goal:** a service can be bought, not merely enquired about. Turnitin returns
to the storefront with its two options, quantity, bulk pricing and disclaimer,
and a purchase produces a real paid order.

---

## 0. Why this is needed

Phase 1's spec defined a service as *"a quote-based offering with no fixed
price"*. That is true of Data Analysis and Transcription, and wrong for
Turnitin, which is a priced product customers buy through checkout.

The omission went unnoticed because Turnitin was never a row in the Services
tab — in the Apps Script system it lived in script properties, read by
`getTurnitinConfig_()`. So the migration had nothing to drop, and nothing to
warn about.

Phase 1 also removed the old `TurnitinOption` type during the types cleanup.
That was correct for what the spec described, but it means the codebase now has
**no model for a priced service at all**. This phase restores the capability,
generalised rather than Turnitin-specific.

This is a gap in the Phase 1 spec, not a defect in its implementation.

**It is live revenue.** The Orders sheet contains real paid Turnitin orders at
₵50.00 — the storefront currently cannot sell something customers were buying.

---

## 1. Model

Extend the existing `Service`. Do **not** introduce a Turnitin-specific type;
the previous system's bespoke handling is what made this hard to see.

```ts
export interface ServiceOption {
  optionId: string;          // 'PLAG' | 'PLAG_AI'
  name: string;              // shown to the customer
  unitPriceGhs: number;
  bulkPriceGhs?: number;
  bulkFromQty?: number;      // quantity at which bulkPriceGhs takes over
  sortOrder?: number;
}

export interface Service {
  // ...existing fields unchanged...
  options?: ServiceOption[]; // present => purchasable; absent => quote-only
  minQty?: number;           // default 1
  maxQty?: number;           // default 50
  disclaimer?: string;       // rendered verbatim, see §4
}
```

**A service with `options` is purchasable. A service without them keeps exactly
the current quote-request behaviour.** Data Analysis and Transcription are
untouched and must continue working as they do now.

The existing `priceGhs?: number` on `Service` is now redundant and misleading —
price lives on the option. Remove it, and confirm nothing reads it.

---

## 2. Turnitin's data

Seed as a document in `services`. It belongs to category `SERVICE`.

```
serviceId    TURNITIN
name         Turnitin Plagiarism & AI Check
tagline      Check your work before you submit
categoryId   SERVICE
active       true
minQty       1
maxQty       50
options:
  - optionId PLAG      name "Plagiarism Only"          unitPriceGhs 15.00
  - optionId PLAG_AI   name "Plagiarism + AI Check"    unitPriceGhs 50.00
                       bulkPriceGhs 47.50   bulkFromQty 2
```

`PLAG_AI` is the option customers actually bought — every historical Turnitin
order is ₵50.00 — so it should be the one presented first or preselected.

Seed it through the migration script (a new `--seed-turnitin` step or a
dedicated seed module), not by hand in the console, so it is reproducible.

---

## 3. Pricing — the part that is easy to get wrong

```
unitPrice = (option.bulkPriceGhs != null
             && option.bulkFromQty != null
             && qty >= option.bulkFromQty)
          ? option.bulkPriceGhs
          : option.unitPriceGhs

total = unitPrice × qty
```

**The bulk price replaces the unit price for every unit, not just the units
above the threshold.** Two AI checks cost **₵95.00**, not ₵97.50. Implemented
as a tiered calculation this overcharges every bulk customer by a small amount
that nobody ever reports.

Write a test for exactly this: qty 1 → 50.00, qty 2 → 95.00, qty 3 → 142.50.

**Money must be computed in integer pesewas**, not floating-point cedis. ₵47.50
is the first non-integer price in the system, and float arithmetic on money
accumulates error. Convert to pesewas for all calculation, format to cedis only
for display. The original rebuild spec required this; Phase 1's cedis-as-number
storage has been harmless only because every price so far was a whole number.

Pricing rules from `PRICING_CONFIG` apply **on top** of the resolved total, via
target id `SERVICE:TURNITIN`, consistent with how variant targets work.

---

## 4. The disclaimer

Rendered verbatim wherever the customer chooses Turnitin — before purchase, not
only in the confirmation. Do not paraphrase, shorten or reformat it:

> Important: The AI score you receive from us will be the same as the score you
> would receive through your institution. However, the Similarity Index may be
> slightly higher, lower, or the same as your institution's result. This is
> because institutions may include private or local repositories in their
> Turnitin configuration that we do not have access to.

It manages a real expectation gap. A customer whose similarity index differs
from their university's will otherwise reasonably believe the check was wrong.

---

## 5. Cart and checkout

A purchasable service goes through the **same cart and Paystack flow as
software**. It is not a separate path.

Cart line for a service carries `serviceId`, `optionId`, `quantity` and the
resolved unit and total price.

The resulting order:

| Field | Value |
|---|---|
| `variantId` | `TURNITIN` — matches historical orders |
| `productName` | `Turnitin Plagiarism & AI Check` |
| `versionOrPlan` | the option name, e.g. `Plagiarism + AI Check` |
| `quantity` | **new field on `Order`** — currently absent |
| `amountGhs` | resolved total |
| `fulfilmentType` | `Service` |
| `fulfilmentStatus` | `Awaiting Seller Activation` |

Historical rows put `Service` in `versionOrPlan` and recorded no option, so
which one was bought is unrecoverable from them. Recording the option going
forward is a deliberate improvement; note it rather than reproducing the old
ambiguity.

**A service order must never touch the licence pool.** It is manually
fulfilled. Ensure the auto-fulfil licence transaction is skipped entirely for
`fulfilmentType: 'Service'` — otherwise a Turnitin purchase would land in
`awaiting-licence`, which is meaningless for a service and would hide it from
the queue the seller actually watches.

---

## 6. Submission — two routes, customer's choice

The customer either uploads the document, or sends it over WhatsApp. This is a
`radio` the existing schema already supports, with `showIf` revealing the
upload only when it applies:

```json
[
  { "key": "submissionMethod",
    "label": "How would you like to send us your document?",
    "type": "radio", "required": true,
    "options": ["Upload it here", "Send it on WhatsApp"] },

  { "key": "document",
    "label": "Upload your document",
    "type": "file", "required": true,
    "showIf": { "field": "submissionMethod", "equals": "Upload it here" },
    "helper": "PDF or Word document, up to 20 MB." },

  { "key": "fullName",  "label": "Full name", "type": "text",  "required": true },
  { "key": "phone",     "label": "Phone / WhatsApp number", "type": "tel",
    "required": true, "helper": "Use a number that is on WhatsApp." },
  { "key": "email",     "label": "Email address", "type": "email", "required": true },
  { "key": "deadline",  "label": "When do you need it by?", "type": "datetime",
    "required": true },
  { "key": "notes",     "label": "Anything else we should know?",
    "type": "textarea", "required": false }
]
```

### `file` is a new field type

It does not exist today. Add it to `ServiceFieldType`, the renderer, and the
server-side validator — which must keep honouring `showIf`, so an upload that
is hidden because the customer chose WhatsApp is not treated as missing.

Files go to **Cloud Storage in the same project**. Three requirements, none
optional:

- **Upload only against an existing paid order.** The server issues a
  short-lived signed upload URL after the order exists; the browser never holds
  broad write access. Without this the bucket is an open drop box for anyone
  who finds the endpoint.
- **Enforce the limits server-side too** — 20 MB, and PDF/DOC/DOCX only. A
  client-side check is a convenience, not a control.
- **Storage rules deny all client access**, matching Firestore. Retrieval is
  server-mediated via a signed download URL, because these are customers'
  unpublished academic documents.

Store the object path on the order as `documentPath`, not a public URL.

### The WhatsApp route needs a distinct status

Payment happens before submission — that is how Turnitin already works, and
every historical order shows `Paid` before fulfilment. So a customer can pay,
choose WhatsApp, and then never send anything.

If both routes land in `Awaiting Seller Activation`, the queue will show work
that cannot be started, mixed in with work that can. Separate them:

- `Awaiting Document` — paid, nothing received yet
- `Awaiting Seller Activation` — document in hand, ready to run

An upload moves the order from the first to the second automatically. The
WhatsApp route moves when the seller marks it received, which is a Phase 2
admin action — until then it stays visible as outstanding, which is correct.

On confirmation, the WhatsApp route shows a deep link with the order reference
prefilled, so the message arrives already identifying the order:

```
https://wa.me/233542638979?text=<url-encoded: order reference + service name>
```

### Interim retrieval

The admin portal does not exist until Phase 2. Until it does, uploaded files
are retrievable from the Firebase Storage browser in the console. Note this in
`DEPLOYMENT.md` so it is not mistaken for missing functionality.

---

## 7. Definition of done

- `npm run lint` and `npm run build` pass; production path verified per
  `CLAUDE.md`.
- Turnitin appears under Services with both options and a quantity selector.
- Quantities 1, 2 and 3 of `PLAG_AI` price at ₵50.00, ₵95.00 and ₵142.50.
- The disclaimer is visible before purchase, verbatim.
- A completed purchase creates an order with `fulfilmentType: 'Service'`, the
  chosen option recorded, and **no licence pool interaction**.
- Choosing WhatsApp leaves the order `Awaiting Document` and shows a deep link
  carrying the order reference. Uploading a file moves it to `Awaiting Seller
  Activation` and records `documentPath`.
- An upload larger than 20 MB, or of a disallowed type, is rejected **by the
  server**, not only the browser.
- A document uploaded by one customer is not reachable by another, and not
  reachable without authentication at all.
- Data Analysis and Transcription behave exactly as before — still quote-only,
  no price, no quantity.
- Seeding is reproducible from the script, not hand-entered.

---

## 8. Out of scope

Admin editing of service options (Phase 2 — though note this makes the case for
a form composer rather than a fixed editor, since options, conditionals and now
file fields all need authoring). The admin screen for downloading submitted
documents and marking a WhatsApp submission received — both Phase 2; until then
the Firebase Storage console covers retrieval. Migration of historical Turnitin
orders.
