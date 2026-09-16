import crypto from 'crypto';

/**
 * Paystack client and configuration.
 *
 * Nothing in this file marks an order paid. It talks to Paystack and verifies
 * signatures; applying a verified payment is server/payments.ts, so there is
 * exactly one place that can set paymentStatus.
 */

/** Overridable so the adversarial tests can point at a stub API. */
const API_BASE = process.env.PAYSTACK_API_BASE || 'https://api.paystack.co';

export type PaymentMode = 'test' | 'live' | 'unconfigured';

export function secretKey(): string | undefined {
  return process.env.PAYSTACK_SECRET_KEY || undefined;
}

/**
 * The key's prefix is the only reliable statement of which mode you are in.
 * Surfaced on /api/health because otherwise, at some point, you will believe
 * live orders are test orders.
 */
export function paymentMode(): PaymentMode {
  const key = secretKey();
  if (!key) return 'unconfigured';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unconfigured';
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
}

/**
 * Refuse to start in production without a secret key.
 *
 * A storefront that boots without payment configuration silently offers a free
 * checkout — the defect this phase closes, wearing a new coat.
 */
export function assertPaymentConfig(): void {
  const mode = paymentMode();

  if (process.env.NODE_ENV === 'production' && mode === 'unconfigured') {
    throw new Error(
      'PAYSTACK_SECRET_KEY is missing or malformed (it must start with sk_test_ or ' +
        'sk_live_). Refusing to start: a storefront without payment configuration ' +
        'would take orders without taking money.'
    );
  }

  if (process.env.NODE_ENV === 'production' && !publicBaseUrl()) {
    throw new Error('PUBLIC_BASE_URL is required in production to build the payment callback URL.');
  }

  // The mode, never the key.
  console.log(`[payments] Paystack mode: ${mode}`);
}

export interface InitialiseResult {
  authorizationUrl: string;
  reference: string;
}

export interface VerifiedTransaction {
  status: string;
  reference: string;
  amountPesewas: number;
  currency: string;
  paidAt?: string;
}

async function paystackFetch(path: string, init?: RequestInit): Promise<any> {
  const key = secretKey();
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured.');

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Paystack ${path} failed: ${res.status} ${(body as any)?.message || 'unknown error'}`
    );
  }
  return body;
}

/**
 * Start a transaction.
 *
 * `amountPesewas` is already an integer — Paystack's `amount` is in pesewas, so
 * it is sent straight through. Multiplying a float by 100 here is how a ₵47.50
 * order becomes 4749.
 */
export async function initialiseTransaction(params: {
  email: string;
  amountPesewas: number;
  reference: string;
  orderId: string;
}): Promise<InitialiseResult> {
  if (!Number.isInteger(params.amountPesewas) || params.amountPesewas <= 0) {
    throw new Error(`Refusing to initialise a non-integer amount: ${params.amountPesewas}`);
  }

  const body = await paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amountPesewas,
      currency: 'GHS',
      reference: params.reference,
      callback_url: `${publicBaseUrl()}/payment/return`,
      metadata: { orderId: params.orderId }
    })
  });

  const url = body?.data?.authorization_url;
  if (!url) throw new Error('Paystack did not return an authorization_url.');

  return { authorizationUrl: url, reference: body?.data?.reference || params.reference };
}

/** Ask Paystack what actually happened. The only source of truth for payment. */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction | null> {
  const body = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
  const data = body?.data;
  if (!data) return null;

  return {
    status: String(data.status || ''),
    reference: String(data.reference || reference),
    // Paystack reports the amount in pesewas already.
    amountPesewas: Number(data.amount),
    currency: String(data.currency || ''),
    paidAt: data.paid_at || data.paidAt || undefined
  };
}

/**
 * Verify a webhook signature over the RAW request body.
 *
 * Express's JSON parser re-serialises the body, and the hash of the
 * re-serialised form does not match, so this must be given the exact bytes
 * Paystack sent. The comparison is timing-safe.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const key = secretKey();
  if (!key || !signature) return false;

  const expected = crypto.createHmac('sha512', key).update(rawBody).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  // timingSafeEqual throws on a length mismatch, which is itself a signal.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** One order, one reference, so re-verification never has to guess. */
export function referenceForOrder(orderId: string): string {
  return orderId;
}
