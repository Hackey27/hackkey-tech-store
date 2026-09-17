# Finishing the pricing fix — 4 issues found in testing

The pesewas fixes in `2fbc6a2` are about 80% there, but the attached
screenshots show 4 issues still outstanding — 2 of them critical blockers
that would prevent real purchases:

1. The order-summary sidebar at checkout still shows 100× prices (e.g.
   "₵850,000" for the 15-inch MacBook Pro). The card grid and cart are fixed,
   so this is a **separate display bug** — that component has its own price
   formatter that wasn't caught in the original sweep.

2. Adding Turnitin to the cart now shows a non-zero price (good), but checking
   out returns "Unable to place order" (still broken). Points to the
   service-specific `createOrders` path not being fully fixed — **Turnitin is
   still not purchasable end to end** despite the cart price resolving. Trace
   this flow all the way through `createOrders` and fulfil.

3. Laptop prices are still ₵0 on the detail modal. If `/api/catalog` resolves
   them correctly (you said it did), there's a laptop-specific display path
   that's still missing the pesewas conversion, likely in the detail-page
   component. **Price resolution is not fully fixed** for this kind.

4. Choosing Turnitin's "Plagiarism + AI Check" option (₵50) defaults to the
   "Plagiarism only" price of ₵15 in the cart. The option-matching logic in
   the service-line resolver is buggy — it's picking the first defined price
   rather than the one matching the chosen `optionId`. **The most popular
   Turnitin SKU can't actually be bought.**

Do not release `2fbc6a2` to production as-is. 1 and 3 are confusing but not
fatal — a determined buyer could still check out at the right price. But 2
and 4 mean Turnitin is still not purchasable at all (attempt fails) and its
top option can't be selected (no way to get the ₵50 price). Deploying this
would restore the product cards but leave revenue fixes unfinished.

To complete the fix:

1. Check the order-summary component's price formatter. Convert it to use
   `formatPesewas` like the other display paths.

2. Step through the service flow in `createOrders`. It's clearly not working
   for Turnitin despite the cart price resolving. Confirm the option lookup
   (may relate to issue 4) and the write to Firestore. **Test this exact flow
   end to end** — the price is not enough.

3. Scan for other laptop-specific price displays (likely the detail-page
   component) and pipe them through `resolvePricePesewas` as the central
   fix did for other kinds.

4. Fix the option matching in the service-line resolver. It needs to compare
   the submitted `optionId` against each option's `optionId`, not just grab
   the first price it sees.

Then re-test a full checkout for:

- MacBook Pro 2019 — price should be ₵850,000 everywhere
- Turnitin Plagiarism + AI — price should be ₵5,000 everywhere, not 1,500
- Smart PLS bundle — price should still be ₵35,000 and **allocate exactly**

Let me know when I can re-review the fix end to end. Do not deploy before
these are confirmed resolved — we can't ship a storefront that doesn't sell
Turnitin.