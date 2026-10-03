# Automated RMB preorder pricing

Configure **Admin → Payments → Exchange Rate & Charges** before publishing
RMB-based items. No example exchange rate or profit margin is installed.
New bank settings default to **Percentage with minimum**: 850 basis points
(8.5%), minimum ₵7.47, no maximum cap.
The international-card transaction policy defaults to 3% above ¥200 and a
configured ¥6,000 per-payment limit. The
central Firestore document is `settings/preorderRmbPricing`; authenticated
settings saves are recorded in `admin_audit`.

## Product setup and migration

New preorder products default to automatic RMB pricing. Enter raw RMB cost and
GHS shipping for each offered delivery in every combination, or use the same
source costs for all combinations. The editor shows a private breakdown for
2–3 weeks (`express`) and 6–8 weeks (`two-months`) independently.

The **Live selling price** cards sit directly under the RMB and shipping inputs
and update on every edit without saving. They show the final whole-cedi selling
price for each offered delivery, including transaction/bank charges, shipping
and markup. Expand **Price breakdown** for the internal calculation details.
Each non-uniform variant combination has its own inline cost editor and price
cards. Uniform pricing has one shared editor; preorder laptop setup uses these
same cards. An incomplete or invalid delivery shows **Not ready** with the
reason instead of displaying a previous or estimated price. The preview calls
the same pricing function as the server; it does not persist calculated prices.

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
2. Payments up to and including the configured fee-free limit (default ¥200)
   have no transaction fee. Above that limit, multiply the **full raw RMB cost**
   by the configured fee percentage (default 3%), then convert that fee with
   the same exchange rate. Shipping and bank charges are not part of the fee base.
3. Calculate bank charges with `shared/bankCharges.ts`:
   - `percentage_min`: consume the existing transaction-fee output and round
     `(raw RMB cost + transaction fee RMB) × rate` half-up to pesewas. Charge
     `max(roundHalfUp(basePesewas × rateBps / 10000), minimumPesewas)`, capped
     by the maximum if set. A non-positive rounded base has zero charge.
   - `ranges`: select the existing fixed GHS charge from the converted **product
     cost alone**, before transaction fees or other charges. This behavior is
     unchanged.
4. Add each delivery's shipping and select its markup band from its own landed
   cost. Multiply landed cost by `1 + percent / 100`.
5. Round upward to a whole cedi and return integer pesewas, always a multiple
   of 100. Only the new bank-charge base and percentage charge are rounded
   half-up to pesewas; the existing transaction-fee and landed-cost arithmetic
   keep their exact precision through the final ceiling.

Fixed bank-charge tables support at most five rows. Profit-margin tables have no band-count limit. Endpoints are inclusive; leave the
maximum blank for an open-ended final band. Overlaps, inversions and negative
values are rejected. Fixed-bank and margin gaps withhold the affected delivery price
and appear as errors in Payments and the cost editor. One valid delivery can
remain priced when the other lacks a margin band. Payments at or below the
transaction cutoff are valid and add zero without an error. Amount inputs
support two decimal places, rates six, and percentages four. The admin cost formatter can show sub-pesewa amounts; customer
selling prices never show pesewas.

## Bank modes, storage and migration

The Bank charges card adds **Percentage with minimum** / **Fixed ranges**.
Rate is entered as a percentage with at most two decimal places and persisted
as integer `bankChargeRateBps` (0–10000). `bankChargeMinimumGhs` is a
non-negative two-decimal amount. Optional `bankChargeMaximumGhs` is stored as
`null` when blank and must be at least the minimum. `bankChargeMode` is stored
with the other settings through the existing authenticated/audited Save action.

New configurations default to percentage mode at 8.5% / ₵7.47 / no cap. For
backwards compatibility, existing documents with non-empty fixed ranges but no
mode are read as `ranges`; their prices do not change until the admin switches
modes. Missing percentage fields receive the defaults above. The next Save
persists the explicit mode and fields. Existing bank ranges are retained in
`bankCharges` when hidden, so switching back restores them. Both modes validate
retained range data; percentage mode does not require any ranges.

The live example and break-even display use the same integer helper as pricing.
The crossover is approximately ₵87.88 at the defaults. The product editor shows
the selected bank mode, its charge base and the bank charge. For a ¥1000 product
at 1.75 GHS/RMB, the existing fee calculation yields ¥30; the bank base is
₵1,802.50 and the bank charge is ₵153.21. Shipping does not affect the bank base.

No order migration is needed. Orders contain charged-price snapshots, rather
than internal RMB cost breakdowns; those snapshots and existing totals are never
updated when settings change. Cost and profit data remain admin-only.

## International-card transaction policy

**Payments → Exchange Rate & Charges → Transaction fees** has an editable
fee-free limit (inclusive), percentage and maximum per payment. The preset
restores ¥200 / 3% / ¥6,000. The cutoff follows
[Tencent’s official guidance](https://www.tencent.com/index.php/en-us/articles/2201652.html):
¥200 itself is fee-free. The ¥6,000 maximum is the configured store procurement
limit requested for this system, rather than a claim about every wallet’s
current international-card limits.

A raw cost above the configured payment limit withholds both automatic prices
and flags the item for admin review, including preorder laptops. The engine does
not silently omit or cap the fee, or assume split payments. Admin can adjust the
central limit after reviewing the procurement arrangement. In-stock laptops
remain unaffected.

Legacy settings documents with fixed `transactionFees` rows are normalized on
read to the new `transactionFee` percentage policy. Existing bank-charge ranges,
margin bands, exchange rates and raw costs are preserved. The next authenticated
settings save persists the new policy and removes obsolete fixed-fee rows.
Catalogue requests and checkout both use this same normalization, so existing
automatic products update without being opened or resaved. A malformed saved
policy produces a configuration error instead of being silently replaced.

Example: ¥500 at 2.10 GHS/RMB has a ¥15 fee (₵31.50), a ₵15 bank charge,
shipping of ₵80 / ₵150 and a 20% markup. The two landed costs are ₵1,176.50 /
₵1,246.50; final prices round up to **₵1,412 / ₵1,496**. Percentage fee fractions
are preserved through conversion and markup until the final ceiling.

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
the original fixed-bank ¥500 example (₵1,412 / ₵1,496), fee cutoff boundaries,
per-payment limits, legacy policy migration, exact ceiling rounding, fee and band
validation, bank statement examples, half-up rounding, minimum/cap handling,
transaction-fee-inclusive bank bases, mode persistence and legacy migration,
distinct delivery margins, global recalculation,
private-cost removal, manual stock prices, basket recovery, authoritative order
snapshots and admin authentication. UI verification uses isolated local
fixtures, never live example rates or test orders.
