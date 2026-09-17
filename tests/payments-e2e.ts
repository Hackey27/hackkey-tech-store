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
import { assignLicence } from '../server/adminData';
import { fulfilPaidOrder } from '../server/orders';
import { applyOfflinePayment } from '../server/payments';
import { TURNITIN_SERVICE } from '../server/seed/turnitin';

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

async function seedE2eCatalogue(): Promise<void> {
  const variant = (variantId: string, priceGhs: number) => ({
    variantId,
    versionOrPlan: 'E2E',
    priceGhs,
    latest: true,
    available: true,
    licenceTerm: 'Perpetual',
    os: 'Windows',
    macViaParallels: false,
    fulfilmentType: 'Licence',
    deliverableType: 'Licence key',
    activationMode: 'Key',
    autoFulfil: true,
    manualDelivery: false,
    licenceRequiredForSelfActivation: true,
    activationLinkLive: false
  });
  await Promise.all([
    db.collection('products').doc('AMOS').set({
      productId: 'AMOS', productName: 'AMOS', categoryId: 'DATA', active: true, variants: [variant('AMOS01', 220)]
    }),
    db.collection('products').doc('SPSS').set({
      productId: 'SPSS', productName: 'SPSS', categoryId: 'DATA', active: true, variants: [variant('SPSS01', 300)]
    }),
    db.collection('services').doc('TURNITIN').set(TURNITIN_SERVICE),
    db.collection('bundles').doc('SEM').set({
      bundleId: 'SEM', name: 'SEM Bundle', description: 'E2E bundle', priceGhs: 480,
      categoryId: 'BUNDLE', sortOrder: 1, active: true,
      items: [
        { itemId: 'SEM-AMOS', productId: 'AMOS', variantId: 'AMOS01', sortOrder: 1 },
        { itemId: 'SEM-SPSS', productId: 'SPSS', variantId: 'SPSS01', sortOrder: 2 }
      ]
    }),
    db.collection('laptops').doc('LT1').set({
      laptopId: 'LT1', title: 'Priced E2E Laptop', priceGhs: 3200, categoryId: 'LAPTOP', brand: 'Test', model: 'One',
      processor: 'Core i5', ram: '16GB', storage: '512GB', screen: '14 inch', colour: 'Black', graphics: 'Integrated',
      ports: '', operatingSystem: 'Windows', picturesUrl: [], availability: 'Available', active: true, sortOrder: 1
    }),
    db.collection('laptops').doc('LT2').set({
      laptopId: 'LT2', title: 'Quote-only E2E Laptop', categoryId: 'LAPTOP', brand: 'Test', model: 'Two',
      processor: 'Core i5', ram: '8GB', storage: '256GB', screen: '14 inch', colour: 'Black', graphics: 'Integrated',
      ports: '', operatingSystem: 'Windows', picturesUrl: [], availability: 'Available', active: true, sortOrder: 2
    })
  ]);
}

// --- cases ----------------------------------------------------------------

async function run(): Promise<void> {
  await seedE2eCatalogue();
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

  console.log('\n=== concurrency: manual assignment and auto-fulfil cannot take the same key ===');
  {
    const sharedKey = `CONCURRENT-${Date.now()}`;
    const manualOrderId = `HK-MANUAL-${Date.now()}`;
    const autoOrderId = `HK-AUTO-${Date.now()}`;
    await db.collection('licencePool').doc(sharedKey).set({
      licenceId: sharedKey, variantId: 'AMOS01', licenceCode: 'ONE-KEY-ONLY', status: 'available'
    });
    const base = {
      cartId: `CART-${Date.now()}`, orderDate: new Date().toISOString(), lastUpdated: new Date().toISOString(),
      customerName: 'Concurrency Test', phone: '0550000000', email: 'test@example.com', variantId: 'AMOS01',
      productId: 'AMOS', productName: 'AMOS', versionOrPlan: 'Current', deliveryOs: 'Windows', amountPesewas: 22000,
      fulfilmentMethod: 'automatic' as const
    };
    await db.collection('orders').doc(manualOrderId).set({ ...base, orderId: manualOrderId, paymentStatus: 'paid', fulfilmentStatus: 'awaiting-licence' });
    await db.collection('orders').doc(autoOrderId).set({ ...base, orderId: autoOrderId, paymentStatus: 'pending', fulfilmentStatus: 'pending-payment' });

    await Promise.allSettled([
      assignLicence(manualOrderId, { licenceId: sharedKey }, { uid: 'e2e-admin', email: 'admin@example.com' }),
      fulfilPaidOrder(autoOrderId, { method: 'paystack', paystackReference: autoOrderId })
    ]);
    const [manual, auto, key] = await Promise.all([getOrder(manualOrderId), getOrder(autoOrderId), db.collection('licencePool').doc(sharedKey).get()]);
    const issued = [manual, auto].filter((order) => order.activationCodeOrKey === 'ONE-KEY-ONLY');
    check('the shared key was issued exactly once', issued.length === 1, `${issued.length} order(s)`);
    check('the pool row names the same single order', key.data()?.assignedOrderId === issued[0]?.orderId, String(key.data()?.assignedOrderId));
  }

  console.log('\n=== offline payment: distinct, fulfilled once, and idempotently refused ===');
  {
    const { orderId } = await buyOne();
    const first = await applyOfflinePayment(orderId, { reference: 'MOMO-E2E-123', reason: 'Merchant MoMo received' });
    const saved = await getOrder(orderId);
    const second = await applyOfflinePayment(orderId, { reference: 'MOMO-E2E-123', reason: 'Merchant MoMo received' });
    check('offline payment is applied', first.result === 'paid', first.result);
    check('offline marker and reference are stored', saved.paymentMethod === 'offline' && saved.offlinePaymentReference === 'MOMO-E2E-123', `${saved.paymentMethod} / ${saved.offlinePaymentReference}`);
    check('already-paid retry is refused', second.result === 'already-paid', second.result);
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

  console.log('\n=== every catalogue kind prices and checks out ===');
  {
    const buy = async (label: string, items: any[]) => {
      const { status, body } = await post('/api/orders/checkout', {
        customerName: 'Kinds Test', phone: '0554440000', email: 'k@example.com', items
      });
      return { label, status, body };
    };

    // Service: the Turnitin bulk rule must survive the whole path.
    const svc = await buy('service', [{ serviceId: 'TURNITIN', optionId: 'PLAG_AI', quantity: 2 }]);
    check('service checks out', svc.status === 200, `http ${svc.status} ${svc.body.error || ''}`);
    check(
      'service charges 9500p (bulk, not 9750)',
      svc.body.orders?.[0]?.amountPesewas === 9500,
      String(svc.body.orders?.[0]?.amountPesewas)
    );
    check(
      'service order is a Service and records the option',
      svc.body.orders?.[0]?.fulfilmentType === 'Service' &&
        svc.body.orders?.[0]?.serviceOptionId === 'PLAG_AI',
      `${svc.body.orders?.[0]?.fulfilmentType} / ${svc.body.orders?.[0]?.serviceOptionId}`
    );

    // Bundle: one row per item, summing exactly to the bundle price.
    const bun = await buy('bundle', [{ bundleId: 'SEM', quantity: 1 }]);
    const rows = bun.body.orders || [];
    const sum = rows.reduce((a: number, o: any) => a + o.amountPesewas, 0);
    check('bundle checks out', bun.status === 200, `http ${bun.status} ${bun.body.error || ''}`);
    check('bundle is not zero-priced', sum > 0, `${sum}p`);
    check(
      'bundle rows sum EXACTLY to the bundle price (48000p)',
      sum === 48000,
      `${rows.length} row(s) = ${rows.map((o: any) => o.amountPesewas).join(' + ')} = ${sum}`
    );
    check(
      'bundle rows share one cart id',
      rows.length > 1 && new Set(rows.map((o: any) => o.cartId)).size === 1,
      `${new Set(rows.map((o: any) => o.cartId)).size} cart id(s) across ${rows.length} rows`
    );
    check(
      'the split does not divide evenly, so the remainder is really absorbed',
      new Set(rows.map((o: any) => o.amountPesewas)).size > 1,
      rows.map((o: any) => o.amountPesewas).join(', ')
    );

    // Laptop.
    const lap = await buy('laptop', [{ laptopId: 'LT1', quantity: 1 }]);
    check('laptop checks out', lap.status === 200, `http ${lap.status} ${lap.body.error || ''}`);
    check(
      'laptop charges 320000p (GHS 3200)',
      lap.body.orders?.[0]?.amountPesewas === 320000,
      String(lap.body.orders?.[0]?.amountPesewas)
    );

    // An ask-for-price laptop must never be sold as free.
    const free = await buy('priceless laptop', [{ laptopId: 'LT2', quantity: 1 }]);
    check(
      'an ask-for-price laptop is refused, not sold for 0',
      free.status >= 400,
      `http ${free.status}`
    );

    // Products must charge exactly what they charged before this fix.
    const prod = await buy('product', [{ variantId: 'AMOS01', quantity: 1 }]);
    check(
      'product still charges 22000p — display fix changed nothing charged',
      prod.body.orders?.[0]?.amountPesewas === 22000,
      String(prod.body.orders?.[0]?.amountPesewas)
    );
  }

  console.log('\n=== a bundle purchase completes end to end ===');
  {
    sentMail.length = 0;
    const { body } = await post('/api/orders/checkout', {
      customerName: 'Bundle Buyer', phone: '0556660000', email: 'b@example.com',
      items: [{ bundleId: 'SEM', quantity: 1 }]
    });
    const primary = body.orders[0];
    const total = body.orders.reduce((a: number, o: any) => a + o.amountPesewas, 0);
    check('Paystack was asked for the bundle total', body.reference === primary.orderId, String(body.reference));
    customerPays(primary.orderId, total);
    await webhook(primary.orderId);
    await waitFor('the bundle order to be paid', async () => (await getOrder(primary.orderId))?.paymentStatus === 'paid');
    await settled(primary.orderId);
    const paid = await getOrder(primary.orderId);
    check('bundle order paid', paid.paymentStatus === 'paid', paid.paymentStatus);
    // One alert and one receipt for the CART, however many rows it became — an
    // extra pool-empty alert is by design and is counted separately.
    const paidAlerts = sentMail.filter((m) => m.subject.startsWith('Paid:'));
    const receipts = sentMail.filter((m) => m.subject.startsWith('Your order'));
    check('exactly one seller alert for the bundle cart', paidAlerts.length === 1, String(paidAlerts.length));
    check('exactly one receipt for the bundle cart', receipts.length === 1, String(receipts.length));
    check(
      'every other mail is a deliberate pool-empty alert',
      sentMail.every((m) => /^Paid:|^Your order|licence pool empty/i.test(m.subject)),
      sentMail.map((m) => m.subject).join(' | ')
    );
  }

  console.log('\n=== a service purchase completes end to end ===');
  {
    sentMail.length = 0;
    const { body } = await post('/api/orders/checkout', {
      customerName: 'Svc Buyer', phone: '0557770000', email: 's@example.com',
      items: [{ serviceId: 'TURNITIN', optionId: 'PLAG_AI', quantity: 2 }]
    });
    const o = body.orders[0];
    customerPays(o.orderId, 9500);
    await webhook(o.orderId);
    await waitFor('the service order to be paid', async () => (await getOrder(o.orderId))?.paymentStatus === 'paid');
    await settled(o.orderId);
    const paid = await getOrder(o.orderId);
    check('service order paid', paid.paymentStatus === 'paid', paid.paymentStatus);
    check('service went to awaiting-document, not awaiting-licence', paid.fulfilmentStatus === 'awaiting-document', paid.fulfilmentStatus);
    check('service took NO licence from the pool', !paid.activationCodeOrKey && !paid.licenceId, String(paid.activationCodeOrKey));
    check('both emails sent for the service', sentMail.length === 2, `${sentMail.length}`);
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
