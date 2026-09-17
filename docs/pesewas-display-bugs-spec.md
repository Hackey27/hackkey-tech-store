# Bug spec — pesewas display defects and Turnitin zero-price checkout failure

Two defects found during live-readiness testing on 17 September 2026, both
traceable to the Phase 2 conversion of money to integer pesewas. **Both block
the switch to live Paystack keys.**

Repo: `github.com/Hackey27/hackkey-tech-store`

## The split, confirmed by testing

The two bugs divide along one clean line, which strongly constrains the
diagnosis and should be the first thing checked against the code:

| Catalogue kind | Behaviour |
|---|---|
| Products (variant-priced) | Price resolves, but renders at 100× on the grid and in the cart — store-wide, every category |
| Bundles | ₵0, checkout fails |
| Services | ₵0, checkout fails |
| Laptops | ₵0, checkout fails |

This is exactly the boundary expected if Phase 2's pesewas conversion was
applied to the product/variant path and to nothing else: variant prices exist
as pesewas but reach some renderers unformatted, while the three non-variant
kinds never resolve a price at all.

---

## Bug 1 — Card grid and cart render pesewas as cedis

### Symptom

On the browse/category grid, every **product** price is displayed exactly 100×
its true value. This affects **all product categories, store-wide** — not one
section. Opening a product's detail modal shows the correct price. The cart
summary is also wrong (100×). Paystack receives and charges the correct amount.

Observed, with the true value confirmed from the detail modal:

| Surface says | True price |
|---|---|
| Smart PLS — "From ₵20,000" | ₵200.00 |
| QuickBooks — "₵39,600" | ₵396.00 |
| Power BI — "From ₵16,900" | ₵169.00 |
| SPSS Statistics — "From ₵8,000" | ₵80.00 |
| STATA MP 64 Core — "From ₵20,000" | ₵200.00 |
| Tableau — "From ₵6,200" | ₵62.00 |

The Smart PLS case is the clearest proof: the card reads "From ₵20,000" while
the modal lists its cheapest variant, 4.1.1.1, at GHS 200.00.

### Diagnosis

Phase 2 converted stored money to integer pesewas and removed `amountGhs`.
The detail modal and the Paystack initialise path were updated to format from
pesewas; the card grid and the cart summary were not, and are rendering the
raw integer through a cedis formatter.

### What to do

1. Find every place a price is rendered. Expect at minimum the product card
   component, the "From ₵X" lowest-variant calculation, and the cart summary
   (subtotal and total).
2. Route **all** of them through one shared formatting function that takes
   pesewas and returns a display string. There should be exactly one place in
   the codebase that divides by 100.
3. Check the bundle, service and laptop cards too — the screenshots only cover
   the DATA category, so the same defect may exist on surfaces not yet seen.
4. Confirm there is no remaining code path that formats a price without going
   through that function.

### Verification required

- The Smart PLS card reads "From ₵200.00" and its modal still reads GHS 350.00
  for 4.1.1.8.
- A cart containing Smart PLS 4.1.1.8 shows a subtotal and total of ₵350.00.
- The amount sent to Paystack is unchanged — 35000 pesewas — i.e. this fix
  touches display only and must not alter what is charged.
- Add a test asserting the formatter: 35000 → "₵350.00", 4750 → "₵47.50",
  0 → "₵0.00".

---

## Bug 2 — Non-variant catalogue kinds price at ₵0 and checkout fails

### Symptom

Affects **both services and bundles**, confirmed by the owner:

- Adding "Turnitin Plagiarism & AI Check" to the cart produces a line item of
  **₵0**, subtotal ₵0, total ₵0.
- The Bundles category shows the same zero-price behaviour.
- Filling in customer details and pressing "Submit and Pay" returns
  **"Failed to place order"** rather than redirecting to Paystack.

### Diagnosis

₵0 is not 100× anything, so this is **not** the same defect as Bug 1. The price
never resolved at all.

Crucially, **services and bundles share no pricing mechanism**. A service is
priced by `ServiceOption.unitPriceGhs` / `bulkPriceGhs` (Phase 1.5 §1); a
bundle carries its own single fixed `priceGhs` on the bundle document
(rebuild spec §3) which is explicitly *not* a sum of its parts. A cause
specific to either one cannot explain both.

What they do share: they are the catalogue kinds that are **not** products with
embedded variants. Per Phase 1 spec §5, `server/catalogue.ts` merges bundles,
services and laptops into the catalogue alongside products, each tagged with a
`kind`. The most probable root cause is that the Phase 2 pesewas conversion and
the server-side price-resolution path handle the product/variant shape only,
and every other `kind` falls through to zero.

**Laptops are confirmed affected too** — all three non-variant kinds behave
identically, which is the strongest evidence for the shared cause above.

The checkout failure is downstream and expected: Paystack rejects a zero
amount, so `POST /transaction/initialize` fails and the order cannot be created.
Do not treat it as a separate bug until pricing is fixed — re-test after, and
only investigate further if it persists.

### What to do

1. Trace the price-resolution path from catalogue read through cart line to the
   server-side amount computation at checkout. Identify precisely where a
   non-variant `kind` loses its price. Establish this before changing anything
   — the shared-cause theory above is inferred from symptoms, not from reading
   the code, and should be confirmed or discarded on the evidence.
2. Check what units are actually stored in Firestore for `bundles`, `services`
   and `laptops`. If the Phase 2 conversion skipped these collections, the data
   itself may still be in cedis, in which case the fix is a corrected
   conversion/seed step — not a read-time coercion.
3. Fix so **every** catalogue kind resolves to integer pesewas by the same
   path. As with Bug 1, the goal is one code path, not four parallel ones.
4. Preserve the bulk pricing rule from Phase 1.5 §3 exactly: the bulk price
   replaces the unit price for **every** unit, not only those above the
   threshold.
5. For bundles, preserve the price-allocation behaviour from rebuild spec §3:
   one order row per included item sharing a `cart_id`, the fixed bundle price
   spread in proportion to each item's list price, **with the last row
   absorbing the rounding remainder** so the parts sum exactly to the bundle
   price. In integer pesewas this allocation must be exact — assert it.

### Verification required

Service pricing, re-asserting Phase 1.5 §7 in pesewas:

- `PLAG_AI` qty 1 → 5000 pesewas (₵50.00)
- `PLAG_AI` qty 2 → 9500 pesewas (₵95.00) — **not** 9750
- `PLAG_AI` qty 3 → 14250 pesewas (₵142.50)
- `PLAG` qty 1 → 1500 pesewas (₵15.00)

Bundle pricing:

- A bundle displays its own fixed price, not zero and not a sum of its parts.
- Allocation across item rows sums to exactly the bundle price in pesewas, with
  no lost or gained pesewa. Test a price that does not divide evenly.

Laptops:

- Laptop prices display and resolve correctly, fixed under this same change.

End to end, for each of service, bundle and laptop:

- The cart shows a non-zero line price matching what the detail view showed.
- "Submit and Pay" reaches Paystack checkout with the correct amount.
- A Turnitin order has `fulfilmentType: 'Service'`, records the chosen option,
  and **does not touch the licence pool** (Phase 1.5 §5).

---

## Guard against recurrence

Both defects are the same class of error: a money value crossing a boundary
without its unit being enforced. Worth considering a branded/nominal type for
pesewas so the compiler rejects passing a raw number to a cedis formatter — the
Phase 2 spec §1 already argued for making the compiler enforce the unit, and
these two bugs are what happens where it doesn't.

---

## Definition of done

- `npm run lint` and `npm run build` pass; production path verified per
  `CLAUDE.md`.
- Card grid, detail modal, cart and Paystack all agree on every price, for
  **every** catalogue kind — products, bundles, services and laptops.
- All four Turnitin pricing cases pass as integer pesewas.
- Bundle allocation sums exactly to the bundle price in pesewas.
- A purchase completes end to end through Paystack test mode for a product, a
  service and a bundle, with both emails delivered each time.
- Tests exist for the formatter, the Turnitin pricing table and the bundle
  allocation, so none regresses silently.
