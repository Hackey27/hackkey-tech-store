import assert from 'node:assert/strict';
import test from 'node:test';
import { sendSellerOrderSubmittedAlert } from '../server/email';
import { Order } from '../src/types';

const order: Order = {
  orderId: 'HKT-EMAIL-1',
  cartId: 'CART-EMAIL-1',
  orderDate: '2026-09-23T10:00:00.000Z',
  lastUpdated: '2026-09-23T10:00:00.000Z',
  customerName: 'Email Test',
  phone: '0550000000',
  email: 'customer@example.com',
  variantId: 'SPSS-31',
  productName: 'SPSS',
  versionOrPlan: '31',
  deliveryOs: 'Windows',
  amountPesewas: 30000,
  paymentStatus: 'pending',
  fulfilmentStatus: 'pending-payment'
};

test('submission alerts retry a transient rejection with one idempotency key', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.MAIL_PROVIDER_API_KEY;
  const originalSeller = process.env.SELLER_ALERT_EMAIL;
  process.env.MAIL_PROVIDER_API_KEY = 'test-key';
  process.env.SELLER_ALERT_EMAIL = 'seller@example.com';
  const seenKeys: string[] = [];
  let calls = 0;

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    seenKeys.push(new Headers(init?.headers).get('Idempotency-Key') || '');
    if (calls === 1) {
      return new Response('busy', { status: 429, headers: { 'retry-after': '0.001' } });
    }
    return new Response(JSON.stringify({ id: 'mail-provider-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }) as typeof fetch;

  try {
    const receipt = await sendSellerOrderSubmittedAlert([order], order.amountPesewas);
    assert.equal(receipt.providerId, 'mail-provider-1');
    assert.equal(calls, 2);
    assert.deepEqual(seenKeys, [
      'seller-order-submitted/HKT-EMAIL-1',
      'seller-order-submitted/HKT-EMAIL-1'
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.MAIL_PROVIDER_API_KEY;
    else process.env.MAIL_PROVIDER_API_KEY = originalKey;
    if (originalSeller === undefined) delete process.env.SELLER_ALERT_EMAIL;
    else process.env.SELLER_ALERT_EMAIL = originalSeller;
  }
});
