import express, { Request, Response } from 'express';
import path from 'path';
import { HealthResponse } from './src/types';
import { getCatalogue } from './server/catalogue';
import {
  createOrders,
  createRequest,
  getOrder,
  listLicencePool,
  listOrders,
  listRequests,
  lookupOrdersByPhone,
  markOrderPaidAndFulfil,
  submitCustomerInput
} from './server/orders';

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

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    const healthData: HealthResponse = {
      status: 'ok',
      service: 'Hack-Key Tech Platform',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      dataSource: 'Firestore',
      currency: 'GHS',
      timezone: 'Africa/Accra'
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
      res.json({ orders, count: orders.length });
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
      res.json(result);
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
      const orders = await createOrders({ customerName, phone, email, items });
      res.json({ success: true, orders, cartId: orders[0]?.cartId });
    } catch (err) {
      failed(res, err, 'Failed to place order', 400);
    }
  });

  // Mark an order paid (simulated payment, or a Paystack webhook)
  app.post('/api/orders/:orderId/pay', async (req: Request, res: Response) => {
    try {
      const outcome = await markOrderPaidAndFulfil(String(req.params.orderId));
      if (!outcome) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      // Say plainly when no licence could be issued, rather than implying one
      // is on its way.
      res.json({
        success: true,
        order: outcome.order,
        licenceIssued: outcome.licenceIssued,
        message: outcome.licenceIssued
          ? 'Payment recorded and licence issued.'
          : outcome.order.fulfilmentStatus === 'awaiting-licence'
            // Say that the licence still has to be issued. Never imply one is
            // already on its way when the pool held none.
            ? 'Payment recorded. This order still needs a licence: the team has been notified and will contact you once it is issued.'
            : 'Payment recorded. The team will complete activation and contact you.'
      });
    } catch (err) {
      failed(res, err, 'Failed to record payment');
    }
  });

  app.get('/api/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      res.json({ order });
    } catch (err) {
      failed(res, err, 'Failed to retrieve order');
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

  // Admin diagnostics.
  // Returns orders, the licence pool and customer PII, so it must never be
  // open on a public URL. In production it stays disabled until ADMIN_TOKEN is
  // set, and then requires that value in the x-admin-token header. Local
  // development is unaffected.
  app.get('/api/admin/data', async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      const adminToken = process.env.ADMIN_TOKEN;
      if (!adminToken) {
        return res.status(404).json({ error: 'Not found.' });
      }
      if (req.header('x-admin-token') !== adminToken) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
    }

    try {
      const [orders, licencePool, requests] = await Promise.all([
        listOrders(),
        listLicencePool(),
        listRequests()
      ]);
      res.json({ orders, licencePool, requests });
    } catch (err) {
      failed(res, err, 'Failed to retrieve admin data');
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
