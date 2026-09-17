import express, { Request, Response } from 'express';
import path from 'path';
import { HealthResponse } from './src/types';
import { Order } from './src/types';
import { getCatalogue } from './server/catalogue';
import {
  attachDocument,
  createOrders,
  createRequest,
  getOrder,
  lookupOrdersByPhone,
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
  createSignedUpload,
  documentObjectPath,
  validateServiceAnswers,
  validateUpload
} from './server/storage';
import { createAdminRouter } from './server/adminRoutes';

// Cloud Run injects PORT (8080 by default); 3000 keeps local dev unchanged.
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

/** Order lookup is by phone number alone, so it is rate limited per caller. */
const LOOKUP_WINDOW_MS = 60_000;
const LOOKUP_MAX_PER_WINDOW = 10;
const lookupHits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (lookupHits.get(key) || []).filter((t) => now - t < LOOKUP_WINDOW_MS);
  hits.push(now);
  lookupHits.set(key, hits);
  return hits.length > LOOKUP_MAX_PER_WINDOW;
}

function failed(res: Response, err: unknown, message: string, status = 500) {
  console.error(`[API] ${message}:`, err);
  res.status(status).json({
    error: message,
    message: err instanceof Error ? err.message : 'Internal server error'
  });
}

/** Remove seller-only and storage-only fields from every public order response. */
function publicOrder(order: Order): Order {
  const {
    internalNotes: _internalNotes,
    offlinePaymentReason: _offlinePaymentReason,
    documentPath: _documentPath,
    fulfilmentHistory: _fulfilmentHistory,
    ...safe
  } = order;
  return safe as Order;
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

  // Every route below this mount is protected by the single Firebase custom-
  // claim middleware in createAdminRouter. There is no legacy shared token.
  app.use('/api/admin', createAdminRouter());

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

  // Checkout
  app.post('/api/orders/checkout', async (req: Request, res: Response) => {
    const { customerName, phone, email, items } = req.body;
    if (!customerName || !phone || !email || !items || !items.length) {
      return res.status(400).json({ error: 'Customer details and at least one item are required.' });
    }

    try {
      // Priced entirely from the catalogue. `items` names what was chosen —
      // variant ids, option ids, quantities — never what it costs.
      const orders = await createOrders({ customerName, phone, email, items });
      if (!orders.length) {
        return res.status(400).json({ error: 'Nothing to pay for.' });
      }

      const totalPesewas = orders.reduce((sum, o) => sum + o.amountPesewas, 0);
      const primary = orders[0];
      const reference = referenceForOrder(primary.orderId);

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
          authorizationUrl: init.authorizationUrl
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
      const order = await getOrder(reference);

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
    const { contentType, sizeBytes } = req.body;
    if (!contentType || sizeBytes === undefined) {
      return res.status(400).json({ error: 'contentType and sizeBytes are required.' });
    }

    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });

      // No upload URL exists for an unpaid order.
      if (order.paymentStatus !== 'paid') {
        return res.status(403).json({ error: 'This order has not been paid for.' });
      }

      const validation = validateUpload(String(contentType), Number(sizeBytes));
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      res.json(await createSignedUpload(order.orderId, String(contentType), Number(sizeBytes)));
    } catch (err) {
      failed(res, err, 'Failed to prepare the upload');
    }
  });

  // Called once the browser has finished uploading. The order advances only on
  // the strength of what is actually in the bucket.
  app.post('/api/orders/:orderId/document', async (req: Request, res: Response) => {
    const { contentType } = req.body;
    if (!contentType) {
      return res.status(400).json({ error: 'contentType is required.' });
    }

    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      if (order.paymentStatus !== 'paid') {
        return res.status(403).json({ error: 'This order has not been paid for.' });
      }

      const objectPath = documentObjectPath(order.orderId, String(contentType));
      const confirmed = await confirmUpload(objectPath);
      if (!confirmed.ok) {
        return res.status(400).json({ error: confirmed.error });
      }

      const result = await attachDocument(order.orderId, objectPath);
      if (!result.success) return res.status(400).json({ error: result.message });
      res.json({ ...result, order: result.order ? publicOrder(result.order) : undefined });
    } catch (err) {
      failed(res, err, 'Failed to record the document');
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
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
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
