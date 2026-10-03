# Automated RMB preorder pricing

Configure **Admin → Payments → Exchange Rate & Charges** before publishing
RMB-based items. No example exchange rate, fee or margin is installed. The
central Firestore document is `settings/preorderRmbPricing`; authenticated
settings saves are recorded in `admin_audit`.

## Product setup and migration

New preorder products default to automatic RMB pricing. Enter raw RMB cost and
GHS shipping for each offered delivery in every combination, or use the same
source costs for all combinations. The editor shows a private breakdown for
2–3 weeks (`express`) and 6–8 weeks (`two-months`) independently.

Existing manual preorder products retain their prices until switched to
**Automatically calculate from RMB costs** and supplied with source costs.
This avoids inventing RMB costs from historical selling prices. Saving an
automatic product discards its obsolete manual selling-price fields but keeps
its RMB source costs. Drafts may be saved before pricing settings are complete;
an active automatic item must have valid costs and applicable bands.

Preorder laptops always use this engine. Their category editor accepts RMB
costs, delivery options and separate shipping fees. Existing preorder laptops
without those costs show no selling price until configured; their old manual
price is not used as an automatic-price fallback. In-stock laptops retain
manual GHS pricing, including their existing store pricing rules. Changing the
RMB settings cannot alter an in-stock laptop's price.

## One calculation engine

`shared/rmbPricing.ts` provides validation, exact decimal calculation and
adapters for existing catalogue shapes. The sequence is:

1. Convert raw RMB cost with the configured rate.
2. Select a fixed GHS bank charge using only that converted product cost.
3. Select an optional RMB transaction fee using raw RMB cost, and convert it
   with the same rate. An unmatched fee band adds zero without an error.
4. Add each delivery's shipping and select its markup band from its own landed
   cost. Multiply landed cost by `1 + percent / 100`.
5. Round upward to a whole cedi and return integer pesewas, always a multiple
   of 100. Intermediate amounts are not rounded to pesewas.

Each band table supports at most five rows. Endpoints are inclusive; leave the
maximum blank for an open-ended final band. Overlaps, inversions and negative
values are rejected. Bank and margin gaps withhold the affected delivery price
and appear as errors in Payments and the cost editor. One valid delivery can
remain priced when the other lacks a margin band. Transaction-fee gaps are
valid. Amount inputs support two decimal places, rates six, and markup
percentages four. The admin cost formatter can show sub-pesewa amounts; customer
selling prices never show pesewas.

## Recalculation, checkout and privacy

Public catalogue requests read the latest source products and settings with no
RMB configuration or preorder-response cache, so a change saved on one Cloud
Run instance applies to subsequent requests on every instance. Calculated
prices are derived rather than permanently persisted. Open laptop/preorder
pages and preorder baskets refresh every 15 seconds and on window focus.

Storefront cards, search, product views, comparison, delivery selection and
basket lines consume these server-calculated prices. The browser performs no
RMB conversion or markup. Checkout sends its displayed unit price as a review
check; it cannot set the charged price. Preorder submission reads settings and
products and creates the order in one Firestore transaction. If a displayed
price is stale, submission is refused and the basket refreshes for review.
Unavailable prices block submission. Laptop enquiries and laptop orders also
resolve their selected delivery through the shared engine on the server.

Order line prices are immutable snapshots. Updating settings never rewrites
existing preorder or payment order amounts, including completed orders.
Public product payloads remove `sourceCost` and `preorderCost`; neither charges,
exchange settings nor profit breakdowns are sent to customers. Breakdown data
is available only through the authenticated admin interface.

## Verification

Run `npm run lint`, `npm test`, and `npm run build`. Automated coverage includes
the supplied ¥500 example (₵1,390 / ₵1,474), exact ceiling rounding, optional
fees, band validation, distinct delivery margins, global recalculation,
private-cost removal, manual stock prices, basket recovery, authoritative order
snapshots and admin authentication. UI verification uses isolated local
fixtures, never live example rates or test orders.
