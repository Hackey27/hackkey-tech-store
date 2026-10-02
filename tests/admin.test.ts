import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAccessConfigured, allowedAdminEmails, bearerToken, hasRecentAdminAuth, requireAdmin, validateAdminClaims } from '../server/adminAuth';
import { validateLicenceRows, validateServiceDefinition } from '../server/adminValidation';
import { Order, Service, TurnitinReportDocument } from '../shared/types';
import express from 'express';
import { createAdminRouter } from '../server/adminRoutes';
import { announcementStorageKey, shouldShowAnnouncement } from '../src/components/AnnouncementModal';
import { assertWorkflowPaymentTransition, turnitinReportReadyPatch } from '../server/adminData';

const PROJECT = 'hack-key-tech-store-staging';
const validClaims = {
  uid: 'admin-1',
  email: 'admin@example.com',
  email_verified: true,
  aud: PROJECT,
  iss: `https://securetoken.google.com/${PROJECT}`,
  admin: true
};
const ALLOWED = ['admin@example.com'];

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; }
  };
}

test('bearer token parsing refuses missing and malformed authorization', () => {
  assert.equal(bearerToken(), null);
  assert.equal(bearerToken('Basic abc'), null);
  assert.equal(bearerToken('Bearer token-value'), 'token-value');
});

test('software and version creation/edit routes require administrator authentication', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    for (const [method, path] of [['POST', '/products'], ['POST', '/products/AMOS/versions'], ['PUT', '/products/AMOS/versions/AMOS01']]) {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/admin${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 401, `${method} ${path}`);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('assigned-value corrections require a recent verified sign-in', () => {
  const now = 1_800_000_000;
  assert.equal(hasRecentAdminAuth({ uid: 'admin-1', authTime: now - 60 }, now), true);
  assert.equal(hasRecentAdminAuth({ uid: 'admin-1', authTime: now - 301 }, now), false);
  assert.equal(hasRecentAdminAuth({ uid: 'admin-1' }, now), false);
  assert.equal(hasRecentAdminAuth({ uid: 'admin-1', authTime: now + 60 }, now), false);
});

test('admin middleware rejects a request with no token', async () => {
  const res = responseRecorder();
  let nextCalled = false;
  const middleware = requireAdmin(async () => validClaims);
  await middleware({ header: () => undefined } as any, res as any, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('admin middleware rejects an expired token', async () => {
  const res = responseRecorder();
  const middleware = requireAdmin(async () => { throw new Error('ID token has expired'); });
  await middleware({ header: () => 'Bearer expired' } as any, res as any, () => assert.fail('must not call next'));
  assert.equal(res.statusCode, 401);
});

test('a valid token without the admin claim is forbidden', async () => {
  const res = responseRecorder();
  const middleware = requireAdmin(async () => validateAdminClaims({ ...validClaims, admin: false }, PROJECT));
  await middleware({ header: () => 'Bearer ordinary-user' } as any, res as any, () => assert.fail('must not call next'));
  assert.equal(res.statusCode, 403);
});

test('a token from another Firebase project is rejected', async () => {
  const res = responseRecorder();
  const middleware = requireAdmin(async () => validateAdminClaims({
    ...validClaims,
    aud: 'another-project',
    iss: 'https://securetoken.google.com/another-project'
  }, PROJECT));
  await middleware({ header: () => 'Bearer cross-project' } as any, res as any, () => assert.fail('must not call next'));
  assert.equal(res.statusCode, 401);
});

test('a valid project token with admin claim reaches the route', async () => {
  const res = responseRecorder();
  let nextCalled = false;
  const req = { header: () => 'Bearer valid' } as any;
  const middleware = requireAdmin(async () => validateAdminClaims(validClaims, PROJECT, ALLOWED));
  await middleware(req, res as any, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.adminActor, { uid: 'admin-1', email: 'admin@example.com' });
});

test('the allowlist is parsed from commas, whitespace and mixed case', () => {
  assert.deepEqual(allowedAdminEmails('Owner@Example.com, second@example.com'), ['owner@example.com', 'second@example.com']);
  assert.deepEqual(allowedAdminEmails('  one@example.com\n two@example.com '), ['one@example.com', 'two@example.com']);
  assert.deepEqual(allowedAdminEmails(''), []);
  assert.deepEqual(allowedAdminEmails(undefined), []);
});

test('an admin-claimed account that is not on the allowlist is refused', async () => {
  const res = responseRecorder();
  const middleware = requireAdmin(async () =>
    validateAdminClaims({ ...validClaims, uid: 'someone-else', email: 'stranger@example.com' }, PROJECT, ALLOWED));
  await middleware({ header: () => 'Bearer granted-in-the-console' } as any, res as any, () => assert.fail('must not call next'));
  assert.equal(res.statusCode, 403);
});

test('the allowlist matches regardless of case and surrounding space', () => {
  const actor = validateAdminClaims({ ...validClaims, email: '  Admin@Example.COM ' }, PROJECT, ALLOWED);
  assert.equal(actor.uid, 'admin-1');
});

test('an unverified email is refused even when it is on the allowlist', async () => {
  const res = responseRecorder();
  const middleware = requireAdmin(async () =>
    validateAdminClaims({ ...validClaims, email_verified: false }, PROJECT, ALLOWED));
  await middleware({ header: () => 'Bearer unverified' } as any, res as any, () => assert.fail('must not call next'));
  assert.equal(res.statusCode, 403);
});

test('a token with no email address cannot satisfy the allowlist', async () => {
  const res = responseRecorder();
  const middleware = requireAdmin(async () =>
    validateAdminClaims({ ...validClaims, email: undefined }, PROJECT, ALLOWED));
  await middleware({ header: () => 'Bearer no-email' } as any, res as any, () => assert.fail('must not call next'));
  assert.equal(res.statusCode, 403);
});

test('an empty allowlist leaves claim-only access, which only development permits', () => {
  // Kept deliberately: the tests and the emulator run without the variable.
  const actor = validateAdminClaims(validClaims, PROJECT, []);
  assert.equal(actor.uid, 'admin-1');

  const previousEnv = process.env.NODE_ENV;
  const previousList = process.env.ADMIN_ALLOWED_EMAILS;
  try {
    // ...but production refuses to serve the admin API at all in that state.
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_ALLOWED_EMAILS;
    assert.equal(adminAccessConfigured(), false);
    process.env.ADMIN_ALLOWED_EMAILS = 'owner@example.com';
    assert.equal(adminAccessConfigured(), true);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
    if (previousList === undefined) delete process.env.ADMIN_ALLOWED_EMAILS; else process.env.ADMIN_ALLOWED_EMAILS = previousList;
  }
});

test('a second allowed address works, so access is not single-account by accident', () => {
  const list = ['owner@example.com', 'assistant@example.com'];
  assert.equal(validateAdminClaims({ ...validClaims, email: 'assistant@example.com' }, PROJECT, list).uid, 'admin-1');
  assert.throws(() => validateAdminClaims({ ...validClaims, email: 'third@example.com' }, PROJECT, list));
});

test('a refusal is logged with its reason but never tells the client which rule failed', async () => {
  const warnings: string[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  const res = responseRecorder();
  try {
    const middleware = requireAdmin(async () =>
      validateAdminClaims({ ...validClaims, email: 'stranger@example.com' }, PROJECT, ALLOWED));
    await middleware({ header: () => 'Bearer stranger' } as any, res as any, () => assert.fail('must not call next'));
  } finally {
    console.warn = realWarn;
  }
  assert.equal(res.statusCode, 403);
  // The operator can tell why; the caller cannot.
  assert.ok(warnings.some((line) => line.includes('not an allowed administrator')), warnings.join('|'));
  assert.deepEqual(res.body, { error: 'Administrator access required.' });
});

test('the document download route returns 401 without admin authentication', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/orders/example/document`);
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('the report upload route returns 401 without admin authentication', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/orders/example/reports/upload-url`, { method: 'POST' });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('installation screenshot upload requires admin authentication', async () => {
  const app = express();
  app.use('/api/admin', createAdminRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/products/SPSS/guide-images`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: new Uint8Array([1, 2, 3]) });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('saving payment settings returns 401 without admin authentication', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/payments`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'momo' })
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('the generic workflow cannot mark an unpaid order paid', () => {
  assert.throws(() => assertWorkflowPaymentTransition('pending', 'paid'), /Record offline payment/i);
  assert.doesNotThrow(() => assertWorkflowPaymentTransition('paid', 'paid'));
  assert.doesNotThrow(() => assertWorkflowPaymentTransition('pending', 'pending'));
});

test('attaching a Turnitin report automatically makes the order ready', () => {
  const order = {
    orderId: 'ORDER-1', cartId: 'CART-1', orderDate: '2026-09-18T10:00:00.000Z', lastUpdated: '2026-09-18T10:00:00.000Z',
    customerName: 'Customer', phone: '0540000000', email: 'customer@example.com', variantId: 'TURNITIN', productId: 'TURNITIN',
    productName: 'Turnitin', versionOrPlan: 'Plagiarism + AI Check', deliveryOs: 'N/A', amountPesewas: 5000,
    paymentStatus: 'paid', fulfilmentStatus: 'awaiting-seller-activation',
    reportDocuments: [{ reportId: 'REP-OLD', label: 'Similarity report', originalName: 'old.pdf', uploadedAt: '2026-09-18T10:05:00.000Z' }],
    fulfilmentHistory: [{ status: 'awaiting-seller-activation', at: '2026-09-18T10:05:00.000Z' }]
  } as Order;
  const uploadedAt = '2026-09-18T10:10:00.000Z';
  const report: TurnitinReportDocument = { reportId: 'REP-NEW', label: 'AI report', originalName: 'ai.pdf', storagePath: 'reports/ORDER-1/ai.pdf', uploadedAt };
  const patch = turnitinReportReadyPatch(order, report, { uid: 'admin-1', email: 'admin@example.com' }, uploadedAt);

  assert.equal(patch.fulfilmentStatus, 'ready');
  assert.equal(patch.fulfilledAt, uploadedAt);
  assert.deepEqual(patch.reportDocuments?.map((item) => item.reportId), ['REP-OLD', 'REP-NEW']);
  assert.equal(patch.fulfilmentHistory?.at(-1)?.status, 'ready');
});

test('licence imports report unknown variants and both kinds of duplicates per row', () => {
  const errors = validateLicenceRows([
    { row: 1, variantId: 'PLS01', licenceCode: 'DUP' },
    { row: 2, variantId: 'AMOS01', licenceCode: 'DUP' },
    { row: 3, variantId: 'AMOS01', licenceCode: 'EXISTING' }
  ], new Set(['AMOS01']), new Set(['EXISTING']));
  assert.ok(errors.some((error) => error.row === 1 && /Unknown variant id: PLS01/.test(error.message)));
  assert.ok(errors.some((error) => error.row === 2 && /Duplicate key in this batch/.test(error.message)));
  assert.ok(errors.some((error) => error.row === 3 && /already exists/.test(error.message)));
});

test('service composer validation catches broken conditions, selects, duplicates and bulk pairs', () => {
  const service: Service = {
    serviceId: 'NEW', name: 'New', tagline: 'New', description: 'New', categoryId: 'services',
    ctaLabel: 'Buy', active: true, sortOrder: 1,
    fields: [
      { key: 'route', label: 'Route', type: 'select', required: true, options: [] },
      { key: 'route', label: 'Duplicate', type: 'text', required: false },
      { key: 'doc', label: 'Document', type: 'file', required: true, showIf: { field: 'missing', equals: 'Upload' } }
    ],
    options: [{ optionId: 'ONE', name: 'One', unitPriceGhs: 10, bulkPriceGhs: 8 }]
  };
  const errors = validateServiceDefinition(service);
  assert.ok(errors.some((error) => /Duplicate field key/.test(error.message)));
  assert.ok(errors.some((error) => /at least one option/.test(error.message)));
  assert.ok(errors.some((error) => /depends on missing field/.test(error.message)));
  assert.ok(errors.some((error) => /both a bulk price and bulk-from quantity/.test(error.message)));
});

test('show-once announcements stop rendering after their browser marker is stored', () => {
  const values = new Map<string, string>();
  const previous = (globalThis as any).localStorage;
  (globalThis as any).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
  try {
    const announcement = { announcementId: 'ANN-1', title: 'Notice', message: 'Message', showOnce: true, active: true };
    assert.equal(shouldShowAnnouncement(announcement), true);
    values.set(announcementStorageKey(announcement.announcementId), '1');
    assert.equal(shouldShowAnnouncement(announcement), false);
    assert.equal(shouldShowAnnouncement({ ...announcement, showOnce: false }), true);
  } finally {
    if (previous === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = previous;
  }
});
