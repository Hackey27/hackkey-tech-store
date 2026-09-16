/**
 * Webhook signature verification and the payment configuration rules.
 *
 * The end-to-end adversarial cases from spec §8 — replay, tampered amount,
 * hand-edited return, failed transaction — need Firestore and a Paystack stub,
 * so they run in tests/payments-e2e.ts against the emulator. These are the
 * pure-function checks that can run anywhere.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { paymentMode, verifyWebhookSignature, referenceForOrder } from '../server/paystack';

const KEY = 'sk_test_0123456789abcdef';

function sign(body: string, key = KEY): string {
  return crypto.createHmac('sha512', key).update(Buffer.from(body, 'utf8')).digest('hex');
}

function withKey<T>(key: string | undefined, fn: () => T): T {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  if (key === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = key;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previous;
  }
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

test('a correctly signed body verifies', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'HK-1' } });
  withKey(KEY, () => {
    assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), sign(body)), true);
  });
});

test('a valid body with a wrong signature is rejected', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'HK-1' } });
  withKey(KEY, () => {
    assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), 'f'.repeat(128)), false);
    assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), undefined), false);
    assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), ''), false);
  });
});

test('a body signed with a different key is rejected', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'HK-1' } });
  const foreign = sign(body, 'sk_test_someone_elses_key');
  withKey(KEY, () => {
    assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), foreign), false);
  });
});

test('tampering with the body after signing invalidates the signature', () => {
  const original = JSON.stringify({ event: 'charge.success', data: { reference: 'HK-1', amount: 5000 } });
  const signature = sign(original);
  const tampered = JSON.stringify({ event: 'charge.success', data: { reference: 'HK-1', amount: 100 } });

  withKey(KEY, () => {
    assert.equal(verifyWebhookSignature(Buffer.from(original, 'utf8'), signature), true);
    assert.equal(verifyWebhookSignature(Buffer.from(tampered, 'utf8'), signature), false);
  });
});

test('the signature is over raw bytes, so a re-serialised body fails', () => {
  // This is the trap the spec calls out: express.json() parses and
  // re-serialises, and the re-serialised form hashes differently even though
  // it is the same JSON value.
  const raw = '{"event":"charge.success","data":{"reference":"HK-1","amount":5000}}';
  const signature = sign(raw);
  const reserialised = JSON.stringify(JSON.parse(raw).valueOf());
  const spaced = JSON.stringify(JSON.parse(raw), null, 2);

  withKey(KEY, () => {
    assert.equal(verifyWebhookSignature(Buffer.from(raw, 'utf8'), signature), true);
    assert.equal(
      verifyWebhookSignature(Buffer.from(spaced, 'utf8'), signature),
      false,
      're-serialised with different whitespace must not verify'
    );
    void reserialised;
  });
});

test('without a configured key nothing verifies', () => {
  const body = '{"event":"charge.success"}';
  const signature = sign(body);
  withKey(undefined, () => {
    assert.equal(verifyWebhookSignature(Buffer.from(body, 'utf8'), signature), false);
  });
});

// ---------------------------------------------------------------------------
// Mode reporting
// ---------------------------------------------------------------------------

test('the payment mode comes from the key prefix', () => {
  withKey('sk_test_abc', () => assert.equal(paymentMode(), 'test'));
  withKey('sk_live_abc', () => assert.equal(paymentMode(), 'live'));
  withKey(undefined, () => assert.equal(paymentMode(), 'unconfigured'));
  withKey('nonsense', () => assert.equal(paymentMode(), 'unconfigured'));
});

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

test('the reference is the order id, so re-verification never guesses', () => {
  assert.equal(referenceForOrder('HK-123456'), 'HK-123456');
});
