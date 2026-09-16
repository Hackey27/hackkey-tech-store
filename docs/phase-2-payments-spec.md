# Phase 2 — Payments (Paystack), seller alerts and customer receipts

Implementation spec for `github.com/Hackey27/hackkey-tech-store`. Executes
against the code Phase 1 and Phase 1.5 delivered.

**Goal:** the storefront takes money through Paystack, and nothing is ever
marked paid on anyone's say-so. Every paid order alerts the seller and sends the
customer a receipt.

---

## 0. The defect this phase closes

`POST /api/orders/{orderId}/pay` currently marks an order paid and attempts
licence fulfilment with **no verification of any kind** — no authentication, no
payment provider, no signature. Order IDs follow `HKT-<date>-<time>-<digits>`.
Anyone who knows or guesses one can take stock.

Harm is limited today only because the licence pool is empty. That protection
disappears the moment licences are loaded.

**Step one of this phase, before anything else: delete that endpoint.** Not
gate it behind `ADMIN_TOKEN` — delete it. After this phase, the only thing that
may set `payment_status: 'Paid'` is code that has verified a reference against
the Paystack API. A manual "mark as paid" for offline payments belongs in the
Phase 3 admin portal, behind admin auth, and is out of scope here.

---

## 1. Money is integers in pesewas

Non-negotiable, and the single most common source of silent loss.

- Store and compute every amount as an integer number of pesewas.
  ₵47.50 → `4750`.
- Paystack's `amount` field is already in pesewas. Send the integer directly;
  never multiply a float by 100 at the boundary — `Math.round(x * 100)` on a
  float that is already `47.499999` is how you get `4749`.
- Convert to cedis only for display, at the edge.
- Phase 1 stored cedis-as-number and got away with it because every price was a
  whole number. Phase 1.5 introduced ₵47.50. This phase must finish the
  conversion, including a migration of existing stored amounts if any are
  fractional.

Add `amount_pesewas` and treat `amount_ghs` as display-only, or convert
outright — either is fine, but pick one and make the compiler enforce it.

---

## 2. Configuration

| Variable | Notes |
|---|---|
| `PAYSTACK_SECRET_KEY` | Secret Manager. Server only. Never in `dist/`. |
| `PAYSTACK_PUBLIC_KEY` | Not needed for the redirect flow — omit unless inline is added later. |
| `PUBLIC_BASE_URL` | `https://store.hackeytech.com` — used to build the callback URL. |
| `MAIL_PROVIDER_API_KEY` | Secret Manager. See §7. |
| `SELLER_ALERT_EMAIL` | Where seller alerts go. |

Boot-time check: if `PAYSTACK_SECRET_KEY` is absent in production, refuse to
start rather than silently falling back to a "free" checkout. A storefront that
boots without payment configuration is the defect in §0 wearing a new coat.

The key's prefix tells you the mode — `sk_test_` vs `sk_live_`. Log the mode
(not the key) at boot, and surface it on `/api/health` as `paymentMode`. You
will otherwise, at some point, believe live orders are test orders.

---

## 3. Checkout — initialise and redirect

`POST /api/orders/checkout` already creates the order. Extend it:

1. Create the order server-side with `payment_status: 'Pending'`,
   `fulfilment_status: 'Pending Payment'`.
2. **Compute the amount on the server from the catalogue**, applying pricing
   rules and, for services, the bulk logic in the Phase 1.5 spec §3. Never
   trust an amount sent by the browser. The client sends what was chosen —
   variant ids, option ids, quantities — not what it costs.
3. Call Paystack `POST /transaction/initialize`:
   - `email` — the customer's
   - `amount` — integer pesewas
   - `currency` — `GHS`
   - `reference` — **use the order id**, or a deterministic derivative of it.
     One order, one reference, so re-verification never has to guess.
   - `callback_url` — `${PUBLIC_BASE_URL}/payment/return`
   - `metadata` — `{ orderId }`
4. Store `paystack_reference` on the order.
5. Return `authorization_url`; the browser navigates to it.

If initialisation fails, the order stays `Pending Payment` and the customer sees
a plain failure with a retry. Do not delete the order — an orphaned pending
order is diagnosable; a vanished one is not.

---

## 4. Return handling

Paystack sends the buyer back to `callback_url` with `?reference=` or
`?trxref=` (it has historically sent both; read `reference` and fall back to
`trxref`).

**The return is a navigation, not proof of payment.** The customer can edit the
URL. Treat it purely as a prompt to check:

1. Read the reference from the query string.
2. Call the shared verification routine (§6).
3. Render the order's current state from the database — not from the query
   string, and not from the verification response.

If verification says the transaction is not successful, show "we haven't
received confirmation yet" with the order reference and a refresh, rather than
an error. The webhook frequently lands first; a customer who sees "payment
failed" on a successful payment will pay twice.

---

## 5. Webhook

`POST /api/paystack/webhook`, registered in the Paystack dashboard.

```
raw body  ──▶ verify HMAC-SHA512 with PAYSTACK_SECRET_KEY
                    │
                    ▼
          take ONLY the reference from the payload
                    │
                    ▼
          re-verify that reference against Paystack's API
                    │
                    ▼
                apply (§6)
```

**Both checks, not either.** The signature proves the request came from
Paystack; the re-verification proves the amount and status, so a replayed or
tampered body cannot move an order. This is what the Apps Script system did.
Do not regress it.

Mechanics that break this if missed:

- **The signature is computed over the raw request body.** Express's JSON parser
  will have already re-serialised it and the hash will not match. Mount
  `express.raw({ type: 'application/json' })` on this route *before* the global
  JSON middleware, and parse yourself after verifying.
- Compare with a **timing-safe** comparison, not `===`.
- Header is `x-paystack-signature`.
- **Return `200` fast.** Acknowledge, then do the work — or at minimum keep the
  work short. Paystack retries on non-2xx, and a slow handler turns one payment
  into several retries.
- Return `200` for events you do not handle. Only `charge.success` matters here.

---

## 6. Apply — one routine, one transaction

Both the return handler and the webhook call the same function. Neither has its
own copy of this logic.

```
applyVerifiedPayment(reference):
  resp = GET https://api.paystack.co/transaction/verify/{reference}
  if resp.data.status != 'success'        -> no-op
  order = lookup by reference
  if !order                               -> log, no-op
  if order.payment_status == 'Paid'       -> no-op   (idempotent)
  if resp.data.amount != order.amount_pesewas  -> flag, do NOT fulfil
  if resp.data.currency != 'GHS'          -> flag, do NOT fulfil

  in a Firestore transaction:
    set payment_status = 'Paid'
    set fulfilment_status per §6.1
    if auto-fulfil software: assign a licence from the pool
```

- **Idempotency is required**, not nice to have. The webhook retries, and the
  customer's return fires at roughly the same moment. Without the paid-check
  inside the transaction, one payment issues two licences.
- **The amount check is the anti-tamper control.** Without it, a customer who
  manipulates the initialise call pays ₵1 for a ₵500 licence and every signature
  check still passes.
- An amount or currency mismatch is a seller alert, never an automatic refusal
  to the customer — it needs a human.

### 6.1 Resulting fulfilment status

| Case | Status after payment |
|---|---|
| Auto-fulfil licence, pool has a key | `Ready` |
| Auto-fulfil licence, pool empty | `awaiting-licence` |
| Needs lock code / hardware ID | `Awaiting Customer Input` |
| Manual software | `Awaiting Seller Activation` |
| Service, upload route | `Awaiting Document` |
| Service, WhatsApp route | `Awaiting Document` |

Services never touch the licence pool (Phase 1.5 §5).

---

## 7. Email — seller alerts and customer receipts

Triggered from `applyVerifiedPayment`, **after** the transaction commits, and
guarded by the same idempotency so retries do not re-send.

**Provider:** Resend or Postmark. Both are simple HTTP APIs with good
deliverability from Cloud Run and neither needs SMTP. Do not send via the Gmail
API — an OAuth refresh failure at 2am is a silent revenue-affecting outage.

**Seller alert** to `SELLER_ALERT_EMAIL`, on every paid order:
order reference, customer name/phone/email, what was bought, amount, and — most
useful — **what the seller must now do**: nothing (Ready), issue a licence
(empty pool), await a document, activate manually. Alerts that do not say what
to do get ignored within a fortnight.

Also alert on: empty licence pool at fulfilment time, amount mismatch,
verification failure after a signature-valid webhook.

**Customer receipt**, on every paid order: order reference prominently,
itemised purchase, amount, and next steps that match the fulfilment status —
including, for the WhatsApp service route, the deep link with the reference
prefilled (Phase 1.5 §6).

Set `receipt_sent` and `email_status` on the order; they already exist on the
type. **Email failure must never fail the payment.** Catch, record the failure
on the order, alert the seller, and move on. The money arrived; that is what
matters.

### DNS — do this before switching to live keys

On `hackeytech.com` at Cloudflare:

- **SPF** — one `TXT` at the root. If a record already exists, *edit* it;
  a second SPF record invalidates both.
- **DKIM** — the `CNAME` or `TXT` records the provider gives you.
- **DMARC** — `TXT` at `_dmarc`, start at `p=none`.

These are DNS-only records; the grey-cloud rule for the `store` CNAME does not
apply to them. Verify in the provider's dashboard before relying on it.

---

## 8. Rollout

1. Implement with `sk_test_`. Register the webhook against a deployed test URL —
   Paystack cannot reach `localhost`.
2. Test-card a purchase end to end: order created, redirect, return, webhook,
   licence assigned, both emails delivered.
3. **Adversarial tests, all of which must fail to move the order:**
   - webhook with a valid body and a wrong signature
   - webhook replayed twice with a valid signature (one licence, not two)
   - return URL hand-edited with another order's reference
   - a reference for a transaction Paystack reports as `failed`
   - an initialise tampered to a lower amount, then genuinely paid
4. Confirm `POST /api/orders/{orderId}/pay` returns **404** — it is gone.
5. Swap to `sk_live_`, update the webhook URL in the live dashboard (test and
   live have separate webhook settings — this is a step people miss), confirm
   `/api/health` reports live mode, and buy something real and small.
6. Only then load licences into the pool.

---

## 9. Definition of done

- `npm run lint` and `npm run build` pass; production path verified per
  `CLAUDE.md`.
- `/api/orders/{orderId}/pay` no longer exists.
- Amounts are integer pesewas throughout; ₵47.50 survives a round trip exactly.
- Checkout prices from the server catalogue, never from the request body.
- The webhook verifies signature **and** re-verifies the reference.
- Paying twice or replaying the webhook yields one paid order and one licence.
- An amount mismatch blocks fulfilment and alerts the seller.
- Seller alert and customer receipt sent on every paid order; an email failure
  is recorded but does not affect the order.
- SPF, DKIM and DMARC present on `hackeytech.com`.
- `/api/health` reports whether the service is in test or live mode.

---

## 10. Out of scope

Refunds and partial payments. Saved cards and recurring billing. Mobile money
outside Paystack's own channels. Manual "mark as paid" for offline payment —
Phase 3, behind admin auth. The admin portal itself.
