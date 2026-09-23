import express, { Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'path';
import { HealthResponse } from './src/types';
import { getCatalogue } from './server/catalogue';
import {
  attachDocument,
  createOrders,
  createRequest,
  getOrder,
  getOrderByAccessToken,
  getOrderByPaystackReference,
  getOrdersByCartId,
  lookupOrdersByPhone,
  markDocumentUploadPending,
  normalisePhone,
  recordCheckoutMode,
  recordOrderSubmissionAlert,
  recordPaystackReference,
  saveServiceAnswers,
  submitCustomerInput
} from './server/orders';
import { findService } from './server/catalogue';
import { applyVerifiedPayment } from './server/payments';
import {
  assertPaymentConfig,
  initialiseTransaction,
  paymentMode,
  referenceForOrder,
  verifyWebhookSignature
} from './server/paystack';
import {
  catalogueImageFile,
  confirmUpload,
  createSignedDownload,
  createSignedUpload,
  isDocumentObjectPathForOrder,
  safeOriginalFilename,
  validateServiceAnswers,
  validateUpload
} from './server/storage';
import { createAdminRouter } from './server/adminRoutes';
import { publicOrder } from './server/publicOrder';
import { turnitinDocumentUploadPolicy } from './server/documentUploadPolicy';
import { renderProductSocialPreview } from './server/socialPreview';
import { getPublicPaymentOptions, paymentModeUsesPaystack } from './server/paymentSettings';
import { sendSellerOrderSubmittedAlert } from './server/email';
import { sendDuePaymentReminders } from './server/paymentReminders';
import { requireTaskCaller } from './server/taskAuth';
import { retryFailedSubmissionAlerts } from './server/submissionAlerts';

// Cloud Run injects PORT (8080 by default); 3000 keeps local dev unchanged.
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

/** Order lookup is by phone number alone, so it is rate limited per caller. */
const LOOKUP_WINDOW_MS = 60_000;
const LOOKUP_MAX_PER_WINDOW = 10;
const lookupHits = new Map<string, number[]>();
const adminApiHits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (lookupHits.get(key) || []).filter((t) => now - t < LOOKUP_WINDOW_MS);
  hits.push(now);
  lookupHits.set(key, hits);
  return hits.length > LOOKUP_MAX_PER_WINDOW;
}

function isAdminApiRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (adminApiHits.get(key) || []).filter((time) => now - time < 60_000);
  hits.push(now);
  adminApiHits.set(key, hits);
  return hits.length > 120;
}

function failed(res: Response, err: unknown, message: string, status = 500) {
  console.error(`[API] ${message}:`, err);
  res.status(status).json({
    error: message,
    message: err instanceof Error ? err.message : 'Internal server error'
  });
}

async function startServer() {
  // Refuse to start in production without payment configuration, and log the
  // mode (never the key).
  assertPaymentConfig();

  const app = express();

  // ---- Paystack webhook -------------------------------------------------
  //
  // Mounted BEFORE the global JSON parser and with a raw body parser, because
  // the signature is computed over the exact bytes Paystack sent. Once
  // express.json() has parsed and re-serialised the body the hash no longer
  // matches, and the failure looks like a configuration problem rather than a
  // parsing one.
  app.post(
    '/api/paystack/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''));

      if (!verifyWebhookSignature(raw, req.header('x-paystack-signature'))) {
        console.error('[webhook] Rejected: signature did not verify.');
        return res.status(401).json({ error: 'Invalid signature.' });
      }

      let event: any;
      try {
        event = JSON.parse(raw.toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'Malformed body.' });
      }

      // Acknowledge everything we do not handle. Paystack retries on non-2xx.
      if (event?.event !== 'charge.success') {
        return res.status(200).json({ received: true, ignored: event?.event });
      }

      // ONLY the reference is taken from the payload. Everything that matters —
      // status, amount, currency — is re-verified against Paystack's API, so a
      // replayed or tampered body cannot move an order even with a valid
      // signature over it.
      const reference = String(event?.data?.reference || '');
      if (!reference) {
        return res.status(200).json({ received: true, ignored: 'no reference' });
      }

      // Acknowledge first: a slow handler turns one payment into several
      // retries. The work continues after the response.
      res.status(200).json({ received: true });

      try {
        const outcome = await applyVerifiedPayment(reference);
        console.log(`[webhook] ${reference}: ${outcome.result}`);
      } catch (err) {
        console.error(`[webhook] Failed to apply ${reference}:`, err);
      }
    }
  );

  app.use(express.json());

  // The admin URL is intentionally discoverable, but must never be indexed,
  // framed, or cached with authenticated content by an intermediary.
  app.use('/admin', (_req: Request, res: Response, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Every route below this mount is protected by the single Firebase custom-
  // claim middleware in createAdminRouter. There is no legacy shared token.
  app.use('/api/admin', (req: Request, res: Response, next) => {
    // Cloud Run appends the immediate upstream address to X-Forwarded-For.
    // Use the right-most value so a caller cannot select an arbitrary rate-
    // limit bucket by prepending a forged address.
    const forwardedValues = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const forwarded = forwardedValues.at(-1) || req.socket.remoteAddress || 'unknown';
    if (isAdminApiRateLimited(forwarded)) return res.status(429).json({ error: 'Too many admin requests. Please wait a minute and try again.' });
    next();
  }, createAdminRouter());

  // Health endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    const healthData: HealthResponse = {
      status: 'ok',
      service: 'Hack-Key Tech Platform',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      dataSource: 'Firestore',
      currency: 'GHS',
      timezone: 'Africa/Accra',
      // Without this you will, at some point, believe live orders are test
      // orders.
      paymentMode: paymentMode()
    };
    res.json(healthData);
  });

  // Catalogue: products, bundles, services and laptops, each tagged with kind.
  app.get('/api/catalog', async (req: Request, res: Response) => {
    try {
      const categoryFilter = req.query.category as string | undefined;
      const searchQuery = req.query.q as string | undefined;
      res.json(await getCatalogue(categoryFilter, searchQuery));
    } catch (err) {
      failed(res, err, 'Failed to retrieve catalogue from Firestore');
    }
  });

  app.get('/api/payment-options', async (_req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=15');
      res.json(await getPublicPaymentOptions());
    } catch (err) {
      failed(res, err, 'Failed to retrieve payment options');
    }
  });

  // Cloud Scheduler calls this with a Google-signed OIDC token. The storefront
  // is public, so trusting only a scheduler header would let anyone trigger
  // seller email; the caller service account and audience are both verified.
  app.post('/api/tasks/payment-reminders', requireTaskCaller, async (_req: Request, res: Response) => {
    try {
      const [paymentReminders, submissionAlerts] = await Promise.all([
        sendDuePaymentReminders(),
        retryFailedSubmissionAlerts()
      ]);
      res.json({ paymentReminders, submissionAlerts });
    } catch (err) {
      failed(res, err, 'Failed to process payment reminders');
    }
  });

  // Catalogue artwork is public content but the bucket is not. Only objects in
  // the dedicated prefix can be streamed; customer documents remain private.
  app.get('/api/catalog/images', async (req: Request, res: Response) => {
    const objectPath = String(req.query.path || '');
    try {
      const { file, contentType } = await catalogueImageFile(objectPath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      file.createReadStream()
        .on('error', (err) => {
          console.error('[catalogue-image] stream failed:', err);
          if (!res.headersSent) res.status(404).end();
          else res.destroy(err as Error);
        })
        .pipe(res);
    } catch (err) {
      failed(res, err, 'Catalogue image not found', 404);
    }
  });

  // Rate-limited order lookup
  app.get('/api/orders/lookup', async (req: Request, res: Response) => {
    const phone = req.query.phone as string;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(`${clientIp}-${phone.trim()}`)) {
      return res.status(429).json({
        error: 'Too many search requests. Please wait a moment before trying again.'
      });
    }

    try {
      const orders = await lookupOrdersByPhone(phone);
      res.json({ orders: orders.map(publicOrder), count: orders.length });
    } catch (err) {
      failed(res, err, 'Failed to look up orders');
    }
  });

  // A high-entropy link created by an authenticated administrator opens one
  // order without exposing the customer's phone number in the URL. Phone lookup
  // remains available independently and continues to return all matching orders.
  app.get('/api/orders/:orderId/access', async (req: Request, res: Response) => {
    const orderId = String(req.params.orderId || '');
    const token = String(req.query.token || '');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!orderId || !token) return res.status(400).json({ error: 'The order link is incomplete.' });
    if (isRateLimited(`${clientIp}-access-${orderId}`)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    try {
      const order = await getOrderByAccessToken(orderId, token);
      if (!order) return res.status(404).json({ error: 'This order link is invalid or no longer available.' });
      res.json({ order: publicOrder(order) });
    } catch (err) {
      failed(res, err, 'Failed to open the order link');
    }
  });

  // Customer input (lock code or hardware ID)
  app.post('/api/orders/:orderId/customer-input', async (req: Request, res: Response) => {
    const { inputValue } = req.body;
    if (!inputValue || !String(inputValue).trim()) {
      return res.status(400).json({ error: 'Input value is required.' });
    }

    try {
      const result = await submitCustomerInput(String(req.params.orderId), String(inputValue));
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      res.json({ ...result, order: result.order ? publicOrder(result.order) : undefined });
    } catch (err) {
      failed(res, err, 'Failed to save customer input');
    }
  });

  // Start payment again from Find Order. The amount is read from Firestore at
  // click time, so an administrator's adjusted price is reflected immediately.
  app.post('/api/orders/:orderId/pay', async (req: Request, res: Response) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      if (order.paymentStatus === 'paid') return res.status(409).json({ error: 'This order is already paid.' });
      if (normalisePhone(String(req.body?.phone || '')) !== order.phone) {
        return res.status(403).json({ error: 'The phone number does not match this order.' });
      }
      const cart = await getOrdersByCartId(order.cartId);
      if (cart.some((row) => row.paymentStatus === 'paid')) {
        return res.status(409).json({ error: 'Part of this checkout is already paid. Please contact support.' });
      }
      const totalPesewas = cart.reduce((sum, row) => sum + row.amountPesewas, 0);
      const paymentOptions = await getPublicPaymentOptions();
      await recordCheckoutMode(cart, paymentOptions.mode);
      if (!paymentModeUsesPaystack(paymentOptions.mode)) {
        return res.json({ success: true, orderIds: cart.map((row) => row.orderId), totalPesewas, paymentOptions });
      }
      const reference = `${order.orderId}-R${Date.now()}`;
      const init = await initialiseTransaction({ email: order.email, amountPesewas: totalPesewas, reference, orderId: order.orderId });
      await recordPaystackReference(cart, init.reference);
      res.json({ authorizationUrl: init.authorizationUrl, reference: init.reference, orderIds: cart.map((row) => row.orderId), totalPesewas, paymentOptions });
    } catch (err) { failed(res, err, 'Failed to start payment', 400); }
  });

  // Checkout
  app.post('/api/orders/checkout', async (req: Request, res: Response) => {
    const { customerName, phone, email, items } = req.body;
    if (!customerName || !phone || !email || !items || !items.length) {
      return res.status(400).json({ error: 'Customer details and at least one item are required.' });
    }

    try {
      const paymentOptions = await getPublicPaymentOptions();
      // Priced entirely from the catalogue. `items` names what was chosen —
      // variant ids, option ids, quantities — never what it costs.
      const orders = await createOrders({ customerName, phone, email, items, checkoutMode: paymentOptions.mode });
      if (!orders.length) {
        return res.status(400).json({ error: 'Nothing to pay for.' });
      }

      const totalPesewas = orders.reduce((sum, o) => sum + o.amountPesewas, 0);
      const primary = orders[0];
      const reference = referenceForOrder(primary.orderId);

      // A submitted checkout and a confirmed online payment are deliberately
      // separate seller alerts. This first message never says the order is paid.
      await sendSellerOrderSubmittedAlert(orders, totalPesewas).then(async (receipt) => {
        await recordOrderSubmissionAlert(primary.orderId, {
          status: 'sent', providerId: receipt.providerId, incrementAttempt: true
        });
      }).catch(async (error) => {
        console.error(`[MAIL] New-order alert failed for ${primary.orderId}:`, error);
        await recordOrderSubmissionAlert(primary.orderId, {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          incrementAttempt: true
        }).catch(() => undefined);
      });

      if (!paymentModeUsesPaystack(paymentOptions.mode)) {
        return res.json({
          success: true,
          orders: orders.map(publicOrder),
          cartId: primary.cartId,
          totalPesewas,
          paymentOptions
        });
      }

      try {
        const init = await initialiseTransaction({
          email: primary.email,
          amountPesewas: totalPesewas,
          reference,
          orderId: primary.orderId
        });

        await recordPaystackReference(orders, init.reference);

        res.json({
          success: true,
          orders,
          cartId: primary.cartId,
          reference: init.reference,
          authorizationUrl: init.authorizationUrl,
          totalPesewas,
          paymentOptions
        });
      } catch (err) {
        // The order stays Pending Payment. An orphaned pending order is
        // diagnosable; a vanished one is not, so it is never deleted.
        console.error('[checkout] Paystack initialise failed:', err);
        res.status(502).json({
          error: 'We could not start the payment. Please try again.',
          orders,
          reference
        });
      }
    } catch (err) {
      failed(res, err, 'Failed to place order', 400);
    }
  });

  // ---- Payment return ---------------------------------------------------
  //
  // The customer's browser lands here after Paystack. A navigation is NOT
  // proof of payment — the URL can be edited — so it is treated purely as a
  // prompt to check, and the order is rendered from the database afterwards.
  app.get('/api/payments/return', async (req: Request, res: Response) => {
    // Paystack has historically sent both; read reference, fall back to trxref.
    const reference = String(req.query.reference || req.query.trxref || '');
    if (!reference) {
      return res.status(400).json({ error: 'No payment reference was supplied.' });
    }

    try {
      const outcome = await applyVerifiedPayment(reference);
      // Rendered from the database, not from the query string and not from the
      // verification response.
      const order = 'order' in outcome ? outcome.order : await getOrder(reference) || await getOrderByPaystackReference(reference);

      if (!order) {
        return res.status(404).json({ error: 'We could not find that order.', reference });
      }

      res.json({
        reference,
        order: publicOrder(order),
        // Not "payment failed": the webhook frequently lands first, and a
        // customer told their successful payment failed will pay twice.
        confirmed: order.paymentStatus === 'paid',
        pending: outcome.result === 'not-successful' && order.paymentStatus !== 'paid'
      });
    } catch (err) {
      failed(res, err, 'Failed to confirm the payment');
    }
  });

  app.get('/api/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      res.json({ order: publicOrder(order) });
    } catch (err) {
      failed(res, err, 'Failed to retrieve order');
    }
  });

  // ---- Service document submission -------------------------------------
  //
  // An upload is only ever issued against an existing paid order, and the size
  // and type limits are enforced here rather than trusted from the browser.

  app.post('/api/orders/:orderId/document-url', async (req: Request, res: Response) => {
    const { contentType, sizeBytes, originalName, phone } = req.body;
    if (!contentType || sizeBytes === undefined || !originalName || !phone) {
      return res.status(400).json({ error: 'File details and the order phone number are required.' });
    }

    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });

      // No upload URL exists for an unpaid order.
      const policy = turnitinDocumentUploadPolicy(order, String(phone), true);
      if (!policy.ok) return res.status(policy.status || 403).json({ error: policy.error });

      const validation = validateUpload(String(contentType), Number(sizeBytes));
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      const signed = await createSignedUpload(order.orderId, String(contentType), Number(sizeBytes));
      await markDocumentUploadPending(order.orderId);
      res.json({ ...signed, originalName: safeOriginalFilename(String(originalName)) });
    } catch (err) {
      failed(res, err, 'Failed to prepare the upload');
    }
  });

  // Called once the browser has finished uploading. The order advances only on
  // the strength of what is actually in the bucket.
  app.post('/api/orders/:orderId/document', async (req: Request, res: Response) => {
    const { contentType, objectPath, originalName, phone } = req.body;
    if (!contentType || !objectPath || !originalName || !phone) {
      return res.status(400).json({ error: 'Upload confirmation details are required.' });
    }

    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      const policy = turnitinDocumentUploadPolicy(order, String(phone));
      if (!policy.ok) return res.status(policy.status || 403).json({ error: policy.error });
      if (!isDocumentObjectPathForOrder(String(objectPath), order.orderId)) {
        return res.status(400).json({ error: 'That upload does not belong to this order.' });
      }

      const confirmed = await confirmUpload(String(objectPath));
      if (!confirmed.ok) {
        return res.status(400).json({ error: confirmed.error });
      }

      const result = await attachDocument(order.orderId, String(objectPath), safeOriginalFilename(String(originalName)), confirmed.sizeBytes);
      if (!result.success) return res.status(400).json({ error: result.message });
      res.json({ ...result, order: result.order ? publicOrder(result.order) : undefined });
    } catch (err) {
      failed(res, err, 'Failed to record the document');
    }
  });

  app.get('/api/orders/:orderId/reports/:reportId', async (req: Request, res: Response) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      const policy = turnitinDocumentUploadPolicy(order, String(req.query.phone || ''));
      if (!policy.ok) return res.status(policy.status || 403).json({ error: policy.error });
      const report = order.reportDocuments?.find((candidate) => candidate.reportId === String(req.params.reportId));
      if (!report?.storagePath) return res.status(404).json({ error: 'Report not found.' });
      res.json({ url: await createSignedDownload(report.storagePath, report.originalName) });
    } catch (err) {
      failed(res, err, 'Failed to prepare the report download');
    }
  });

  // The answers to a purchasable service's submission form.
  app.post('/api/orders/:orderId/service-answers', async (req: Request, res: Response) => {
    const { answers } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers are required.' });
    }

    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });

      const service = await findService(order.variantId);
      if (service?.fields?.length) {
        // showIf is honoured, so an upload hidden because the customer chose
        // WhatsApp is not treated as missing.
        const validation = validateServiceAnswers(service.fields, answers);
        if (!validation.ok) {
          return res.status(400).json({
            error: `Please complete: ${validation.missing.join(', ')}.`,
            missing: validation.missing
          });
        }
      }

      const updated = await saveServiceAnswers(order.orderId, answers);
      if (!updated) return res.status(404).json({ error: 'Order not found.' });
      res.json({ success: true, order: publicOrder(updated) });
    } catch (err) {
      failed(res, err, 'Failed to save answers');
    }
  });

  // Software request
  app.post('/api/requests/software', async (req: Request, res: Response) => {
    const { firstName, lastName, phone, email, softwareName, websiteUrl, notes } = req.body;
    if (!firstName || !lastName || !phone || !email || !softwareName) {
      return res.status(400).json({ error: 'Required fields missing.' });
    }

    try {
      const request = await createRequest('software-request', {
        customerName: `${firstName} ${lastName}`.trim(),
        phone,
        email,
        notes,
        details: { firstName, lastName, softwareName, websiteUrl }
      });
      res.json({ success: true, request });
    } catch (err) {
      failed(res, err, 'Failed to submit request');
    }
  });

  // Laptop sourcing request
  app.post('/api/requests/laptop', async (req: Request, res: Response) => {
    const {
      customerName, phone, email, location, budget, preferredBrand, storage, ram,
      specsNotes, purpose, condition, timeline, readiness, notes
    } = req.body;
    if (!customerName || !phone || !budget) {
      return res.status(400).json({ error: 'Name, phone, and budget are required.' });
    }

    try {
      const request = await createRequest('laptop-request', {
        customerName,
        phone,
        email,
        notes,
        details: {
          location, budget, preferredBrand, storage, ram, specsNotes,
          purpose, condition, timeline, readiness
        }
      });
      res.json({ success: true, request });
    } catch (err) {
      failed(res, err, 'Failed to submit request');
    }
  });

  app.post('/api/requests/laptop-enquiry', async (req: Request, res: Response) => {
    const { customerName, phone, email, laptopId, laptopName, location, notes } = req.body;
    if (!customerName || !phone || !email || !laptopId) {
      return res.status(400).json({ error: 'Name, phone, email, and laptop are required.' });
    }
    try {
      const request = await createRequest('laptop-enquiry', {
        customerName, phone, email, notes,
        details: { laptopId, laptopName, location }
      });
      res.json({ success: true, request });
    } catch (err) {
      failed(res, err, 'Failed to submit laptop enquiry');
    }
  });

  app.post('/api/requests/custom-bundle', async (req: Request, res: Response) => {
    const { customerName, phone, email, notes, software } = req.body;
    if (!customerName || !phone || !email || !Array.isArray(software) || software.length < 2) {
      return res.status(400).json({ error: 'Name, phone, email, and at least two software titles are required.' });
    }
    try {
      const request = await createRequest('custom-bundle', {
        customerName, phone, email, notes,
        details: { software: software.map((item: any) => ({ itemId: String(item.itemId || ''), name: String(item.name || '') })) }
      });
      res.json({ success: true, request });
    } catch (err) {
      failed(res, err, 'Failed to submit custom bundle request');
    }
  });

  // Service enquiry
  app.post('/api/services/submit', async (req: Request, res: Response) => {
    const { serviceId, serviceName, customerName, phone, email, deadline, summary, answers } = req.body;
    if (!serviceId || !customerName || !phone || !email) {
      return res.status(400).json({ error: 'Customer details are required.' });
    }

    try {
      const request = await createRequest('service-enquiry', {
        customerName,
        phone,
        email,
        notes: summary,
        details: { serviceId, serviceName, deadline, answers: answers || {} }
      });
      res.json({ success: true, submission: request });
    } catch (err) {
      failed(res, err, 'Failed to submit enquiry');
    }
  });

  // Vite development middleware or production static asset server
  if (process.env.NODE_ENV !== 'production') {
    // Imported lazily so the production image never needs vite (a devDependency).
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    const indexTemplate = await readFile(indexPath, 'utf8');

    // Social crawlers do not run the React app. Serve product-specific Open
    // Graph metadata while keeping the same SPA shell for the human visitor.
    app.get('/product/:itemId', async (req: Request, res: Response) => {
      try {
        const catalogue = await getCatalogue();
        const item = catalogue.products.find((candidate) => candidate.itemId === req.params.itemId);
        if (!item) return res.sendFile(indexPath);
        const requestBase = `${req.protocol}://${req.get('host')}`;
        const baseUrl = process.env.PUBLIC_BASE_URL || requestBase;
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.type('html').send(renderProductSocialPreview(indexTemplate, item, baseUrl));
      } catch (err) {
        console.error('[social-preview] Failed to render product metadata:', err);
        res.sendFile(indexPath);
      }
    });

    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Hack-Key Tech Platform] Server running at http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Hack-Key Tech Platform] Fatal server startup error:', err);
  process.exit(1);
});
