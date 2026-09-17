/**
 * The adversarial payment cases from spec §8, end to end.
 *
 *   npm run test:e2e
 *
 * Needs a Firestore emulator on FIRESTORE_EMULATOR_HOST and a built server
 * (`npm run build`). Stands up a stub Paystack API and a stub mail API so the
 * real request/verify/webhook path runs without touching anyone's keys — there
 * is deliberately no way for this to reach live Paystack.
 *
 * Every case here must FAIL to move an order. A test that passes by not
 * reaching the code it claims to test is worse than no test, so each one also
 * asserts the order's state afterwards.
 */

import http from 'http';
import crypto from 'crypto';
import { Firestore } from '@google-cloud/firestore';

const SECRET = 'sk_test_e2e_secret_key';
const APP = 'http://127.0.0.1:8099';

const db = new Firestore({ projectId: 'demo-hackkey', ignoreUndefinedProperties: true });

// --- stub Paystack --------------------------------------------------------

interface StubTxn {
  status: string;
  amount: number;
  currency: string;
}
const transactions = new Map<string, StubTxn>();
let initialiseShouldFail = false;

const paystack = http.createServer((req, res) => {
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (req.url?.startsWith('/transaction/initialize')) {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (initialiseShouldFail) return send(500, { message: 'stub failure' });
      const body = JSON.parse(raw || '{}');
      // Initialising is not paying. Paystack reports a transaction as
      // abandoned until the customer actually goes through with it, and a stub
      // that says 'success' here would make every unpaid reference verify —
      // which would hide exactly the bug these tests exist to catch.
      transactions.set(body.reference, {
        status: 'abandoned',
        amount: body.amount,
        currency: body.currency
      });
      send(200, {
        status: true,
        data: { authorization_url: `https://stub.paystack/pay/${body.reference}`, reference: body.reference }
      });
    });
    return;
  }

  const verify = /^\/transaction\/verify\/(.+)$/.exec(req.url || '');
  if (verify) {
    const ref = decodeURIComponent(verify[1]);
    const txn = transactions.get(ref);
    if (!txn) return send(404, { status: false, message: 'Transaction not found' });
    return send(200, { status: true, data: { ...txn, reference: ref, paid_at: new Date().toISOString() } });
  }

  send(404, { message: 'not found' });
});

// --- stub mail ------------------------------------------------------------

const sentMail: Array<{ to: string[]; subject: string; from: string; replyTo: string }> = [];
const mail = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    try {
      const body = JSON.parse(raw || '{}');
      sentMail.push({
        to: body.to,
        subject: body.subject,
        from: body.from,
        // Resend's REST field is snake_case.
        replyTo: body.reply_to
      });
    } catch {
      /* ignore */
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'stub' }));
  });
});

// --- helpers --------------------------------------------------------------

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const post = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(APP + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { status: res.status, body: await res.json().catch(() => ({})) as any };
};

const getOrder = async (id: string) => (await db.collection('orders').doc(id).get()).data() as any;

/** The customer actually goes through with it, for `amountPesewas`. */
function customerPays(reference: string, amountPesewas?: number, currency = 'GHS') {
  const existing = transactions.get(reference);
  transactions.set(reference, {
    status: 'success',
    amount: amountPesewas ?? existing?.amount ?? 0,
    currency
  });
}

const sign = (body: string, key = SECRET) =>
  crypto.createHmac('sha512', key).update(Buffer.from(body, 'utf8')).digest('hex');

const webhook = async (reference: string, opts: { signature?: string } = {}) => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference } });
  return post('/api/paystack/webhook', body, {
    'x-paystack-signature': opts.signature ?? sign(body)
  });
};

async function buyOne(): Promise<{ orderId: string; amountPesewas: number }> {
  const { status, body } = await post('/api/orders/checkout', {
    customerName: 'E2E Buyer',
    phone: '0551230000',
    email: 'buyer@example.com',
    items: [{ variantId: 'AMOS01', selectedOs: 'Windows', quantity: 1 }]
  });
  if (!body.orders?.length) {
    throw new Error(`checkout returned no orders (status ${status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  const order = body.orders[0];
  console.log(`      [buy ${order.orderId} = ${order.amountPesewas}p, ${body.orders.length} order(s), http ${status}]`);
  return { orderId: order.orderId, amountPesewas: order.amountPesewas };
}

/**
 * The webhook acknowledges BEFORE doing its work — deliberately, so Paystack
 * does not retry a slow handler. That means a fixed sleep races it, and a
 * replayed webhook can still be applying when the next case starts. So: poll
 * for the expected state, then wait for quiescence before asserting.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(
  what: string,
  predicate: () => Promise<boolean>,
  timeoutMs = 15000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(150);
  }
  console.log(`      [timed out after ${timeoutMs}ms waiting for ${what}]`);
  return false;
}

/** Wait until the order has stopped changing, so late work cannot leak into
 *  the next case's assertions. */
async function settled(orderId: string, quietMs = 1500): Promise<void> {
  let previous = '';
  let stableSince = Date.now();
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    const snapshot = JSON.stringify((await getOrder(orderId)) || {});
    if (snapshot !== previous) {
      previous = snapshot;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= quietMs) {
      return;
    }
    await sleep(150);
  }
}

/** For the negative cases: nothing should change, so simply allow enough time
 *  for it to have changed if the control were missing. */
const settle = () => sleep(2500);

// --- cases ----------------------------------------------------------------

async function run(): Promise<void> {
  console.log('\n=== §0: the unverified endpoint is gone ===');
  {
    const { orderId } = await buyOne();
    const res = await post(`/api/orders/${orderId}/pay`);
    check('POST /api/orders/:id/pay returns 404', res.status === 404, `got ${res.status}`);
    const order = await getOrder(orderId);
    check('the order stayed unpaid', order.paymentStatus === 'pending', order.paymentStatus);
  }

  console.log('\n=== happy path: signed webhook, verified, right amount ===');
  {
    await db.collection('licencePool').doc('E2E-KEY-1').set({
      licenceId: 'E2E-KEY-1', variantId: 'AMOS01', licenceCode: 'AMOS-E2E-KEY', status: 'available'
    });
    sentMail.length = 0;
    const { orderId } = await buyOne();
    customerPays(orderId);
    await webhook(orderId);
    await waitFor('the order to be paid', async () => (await getOrder(orderId))?.paymentStatus === 'paid');
    await settled(orderId);

    const order = await getOrder(orderId);
    check('order is paid', order.paymentStatus === 'paid', order.paymentStatus);
    check('a licence was attached', order.activationCodeOrKey === 'AMOS-E2E-KEY', String(order.activationCodeOrKey));
    check('paidAt recorded', Boolean(order.paidAt));
    check('seller alert and customer receipt sent', sentMail.length === 2, `${sentMail.length} email(s)`);
    check('receiptSent flag set', order.receiptSent === true, String(order.receiptSent));
    check(
      'sent From the send. subdomain',
      sentMail.every((m) => m.from === 'Hack-Key Tech <orders@send.hackeytech.com>'),
      sentMail.map((m) => m.from).join(' | ')
    );
    check(
      'Reply-To is the root-domain inbox',
      sentMail.every((m) => m.replyTo === 'orders@hackeytech.com'),
      sentMail.map((m) => m.replyTo).join(' | ')
    );
  }

  console.log('\n=== adversarial: webhook with a wrong signature ===');
  {
    const { orderId } = await buyOne();
    const res = await webhook(orderId, { signature: 'e'.repeat(128) });
    await settle();
    const order = await getOrder(orderId);
    check('rejected with 401', res.status === 401, `got ${res.status}`);
    check('order NOT moved', order.paymentStatus === 'pending', order.paymentStatus);
  }

  console.log('\n=== adversarial: webhook replayed twice ===');
  {
    await db.collection('licencePool').doc('E2E-KEY-2').set({
      licenceId: 'E2E-KEY-2', variantId: 'AMOS01', licenceCode: 'REPLAY-KEY-A', status: 'available'
    });
    await db.collection('licencePool').doc('E2E-KEY-3').set({
      licenceId: 'E2E-KEY-3', variantId: 'AMOS01', licenceCode: 'REPLAY-KEY-B', status: 'available'
    });
    sentMail.length = 0;
    const { orderId } = await buyOne();
    customerPays(orderId);

    await Promise.all([webhook(orderId), webhook(orderId)]);
    await waitFor('the order to be paid', async () => (await getOrder(orderId))?.paymentStatus === 'paid');
    await webhook(orderId);
    // All three deliveries must finish before the licence count means anything.
    await settled(orderId, 2500);

    const order = await getOrder(orderId);
    const assigned = (await db.collection('licencePool').where('assignedOrderId', '==', orderId).get()).size;
    check('order paid exactly once', order.paymentStatus === 'paid', order.paymentStatus);
    check('exactly ONE licence assigned', assigned === 1, `${assigned} assigned`);
    check('receipt not re-sent on replay', sentMail.length === 2, `${sentMail.length} email(s)`);
  }

  console.log('\n=== adversarial: return URL hand-edited to another order ===');
  {
    const victim = await buyOne();      // never paid for
    const attacker = await buyOne();    // genuinely paid
    customerPays(attacker.orderId);
    await webhook(attacker.orderId);
    await waitFor('the attacker order to be paid', async () => (await getOrder(attacker.orderId))?.paymentStatus === 'paid');
    await settled(attacker.orderId);

    // The customer edits the return URL to the victim's reference. Paystack
    // reports that transaction as abandoned — it was initialised but never
    // paid — so verification refuses to move it.
    const res = await fetch(`${APP}/api/payments/return?reference=${victim.orderId}`);
    const body = (await res.json()) as any;
    const order = await getOrder(victim.orderId);
    check('victim order NOT paid', order.paymentStatus === 'pending', order.paymentStatus);
    check('response does not claim confirmation', body.confirmed === false, String(body.confirmed));
  }

  console.log('\n=== adversarial: Paystack reports the transaction failed ===');
  {
    const { orderId } = await buyOne();
    transactions.set(orderId, { status: 'failed', amount: 22000, currency: 'GHS' });
    // (explicitly failed, not merely abandoned)
    await webhook(orderId);
    await settle();
    const order = await getOrder(orderId);
    check('order NOT moved', order.paymentStatus === 'pending', order.paymentStatus);
  }

  console.log('\n=== adversarial: initialise tampered to a lower amount, then paid ===');
  {
    sentMail.length = 0;
    const { orderId, amountPesewas } = await buyOne();
    // The customer manipulated the initialise call and genuinely paid GHS 1.
    customerPays(orderId, 100);
    await webhook(orderId);
    await waitFor('the mismatch to be recorded', async () => Boolean((await getOrder(orderId))?.paymentMismatchNote));
    await settled(orderId);

    const order = await getOrder(orderId);
    check(
      'order NOT marked paid',
      order.paymentStatus === 'pending',
      `${order.paymentStatus} (order is ${amountPesewas}p, paid 100p)`
    );
    check('no licence issued', !order.activationCodeOrKey, String(order.activationCodeOrKey));
    check('mismatch recorded on the order', Boolean(order.paymentMismatchNote), order.paymentMismatchNote);
    check('seller alerted', sentMail.some((m) => /mismatch/i.test(m.subject)), JSON.stringify(sentMail.map((m) => m.subject)));
  }

  console.log('\n=== adversarial: wrong currency ===');
  {
    const { orderId } = await buyOne();
    customerPays(orderId, 22000, 'NGN');
    await webhook(orderId);
    await waitFor('the mismatch to be recorded', async () => Boolean((await getOrder(orderId))?.paymentMismatchNote));
    await settled(orderId);
    const order = await getOrder(orderId);
    check('order NOT marked paid', order.paymentStatus === 'pending', order.paymentStatus);
    check('mismatch recorded', /currency/i.test(order.paymentMismatchNote || ''), order.paymentMismatchNote);
  }

  console.log('\n=== an unhandled event is acknowledged, not errored ===');
  {
    const body = JSON.stringify({ event: 'charge.dispute.create', data: { reference: 'whatever' } });
    const res = await post('/api/paystack/webhook', body, { 'x-paystack-signature': sign(body) });
    check('returns 200', res.status === 200, `got ${res.status}`);
  }

  console.log('\n=== a failed initialise leaves the order pending, not deleted ===');
  {
    initialiseShouldFail = true;
    const { status, body } = await post('/api/orders/checkout', {
      customerName: 'Init Fail', phone: '0559990000', email: 'f@example.com',
      items: [{ variantId: 'AMOS01', quantity: 1 }]
    });
    initialiseShouldFail = false;
    check('checkout reports failure', status === 502, `got ${status}`);
    const order = await getOrder(body.orders[0].orderId);
    check('the order still exists and is pending', order?.paymentStatus === 'pending', String(order?.paymentStatus));
  }
}

// --- main -----------------------------------------------------------------

(async () => {
  await new Promise<void>((r) => paystack.listen(8097, '127.0.0.1', r));
  await new Promise<void>((r) => mail.listen(8098, '127.0.0.1', r));

  try {
    await run();
  } catch (err) {
    console.error('\nE2E harness error:', err);
    failures += 1;
  }

  paystack.close();
  mail.close();

  console.log(`\n${failures === 0 ? 'ALL CASES PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
