import express, { Request, Response } from 'express';
import path from 'path';
import { storeDatabase } from './server/storeDatabase';
import { HealthResponse } from './src/types';

// Cloud Run injects PORT (8080 by default); 3000 keeps local dev unchanged.
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

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
      dataSource: 'Hack-Key Tech Authoritative Data Engine',
      currency: 'GHS',
      timezone: 'Africa/Accra'
    };
    res.json(healthData);
  });

  // Hydrated Catalog Endpoint
  app.get('/api/catalog', (req: Request, res: Response) => {
    try {
      const categoryFilter = req.query.category as string | undefined;
      const searchQuery = req.query.q as string | undefined;

      const catalogData = storeDatabase.getHydratedCatalog(categoryFilter, searchQuery);
      res.json(catalogData);
    } catch (err: any) {
      console.error('[API] Error retrieving catalogue:', err);
      res.status(500).json({
        error: 'Failed to retrieve catalogue from data source',
        message: err.message || 'Internal server error'
      });
    }
  });

  // Rate-Limited Order Lookup Endpoint (Sections 4 & 7)
  app.get('/api/orders/lookup', (req: Request, res: Response) => {
    const phone = req.query.phone as string;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `${clientIp}-${phone.trim()}`;

    if (storeDatabase.isRateLimited(rateLimitKey)) {
      return res.status(429).json({
        error: 'Too many search requests. Please wait a moment before trying again.'
      });
    }

    const orders = storeDatabase.lookupOrdersByPhone(phone);
    res.json({ orders, count: orders.length });
  });

  // Customer Input Submission (Lock Code or Hardware ID) (Section 4.3)
  app.post('/api/orders/:orderId/customer-input', (req: Request, res: Response) => {
    const orderId = String(req.params.orderId);
    const { inputValue } = req.body;

    if (!inputValue || !inputValue.trim()) {
      return res.status(400).json({ error: 'Input value is required.' });
    }

    const result = storeDatabase.submitCustomerInput(orderId, inputValue);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  });

  // Save Licence Code (Section 4.3)
  app.post('/api/orders/:orderId/save-licence', (req: Request, res: Response) => {
    const orderId = String(req.params.orderId);
    const { licenceCode } = req.body;

    if (!licenceCode || !licenceCode.trim()) {
      return res.status(400).json({ error: 'Licence code is required.' });
    }

    const result = storeDatabase.saveLicenceCode(orderId, licenceCode);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  });

  // Checkout and Order Placement (Sections 3 & 4)
  app.post('/api/orders/checkout', (req: Request, res: Response) => {
    const { customerName, phone, email, items } = req.body;
    if (!customerName || !phone || !email || !items || !items.length) {
      return res.status(400).json({ error: 'Customer details and at least one item are required.' });
    }

    const result = storeDatabase.createCartOrders({
      customerName,
      phone,
      email,
      items
    });

    res.json(result);
  });

  // Mark Order as Paid (Simulate Payment or Paystack Webhook)
  app.post('/api/orders/:orderId/pay', (req: Request, res: Response) => {
    const orderId = String(req.params.orderId);
    const updatedOrder = storeDatabase.markOrderAsPaid(orderId);
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({ success: true, order: updatedOrder });
  });

  // Software Request Submission
  app.post('/api/requests/software', (req: Request, res: Response) => {
    const { firstName, lastName, phone, email, softwareName, websiteUrl, notes } = req.body;
    if (!firstName || !lastName || !phone || !email || !softwareName) {
      return res.status(400).json({ error: 'Required fields missing.' });
    }

    const submission = {
      request_id: `SR-${Math.floor(100000 + Math.random() * 900000)}`,
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      software_name: softwareName,
      website_url: websiteUrl,
      notes,
      submitted_at: new Date().toISOString()
    };

    storeDatabase.softwareRequests.unshift(submission);
    res.json({ success: true, request: submission });
  });

  // Laptop Sourcing Request Submission
  app.post('/api/requests/laptop', (req: Request, res: Response) => {
    const { customerName, phone, email, location, budget, preferredBrand, storage, ram, specsNotes, purpose, condition, timeline, readiness, notes } = req.body;
    if (!customerName || !phone || !budget) {
      return res.status(400).json({ error: 'Name, phone, and budget are required.' });
    }

    const submission = {
      request_id: `LR-${Math.floor(100000 + Math.random() * 900000)}`,
      customer_name: customerName,
      phone,
      email,
      location,
      budget,
      preferred_brand: preferredBrand,
      storage,
      ram,
      specs_notes: specsNotes,
      purpose,
      condition,
      timeline,
      readiness,
      notes,
      submitted_at: new Date().toISOString()
    };

    storeDatabase.laptopRequests.unshift(submission);
    res.json({ success: true, request: submission });
  });

  // Service Inquiry Submission
  app.post('/api/services/submit', (req: Request, res: Response) => {
    const { serviceId, serviceName, customerName, phone, email, deadline, summary, answers } = req.body;
    if (!serviceId || !customerName || !phone || !email) {
      return res.status(400).json({ error: 'Customer details are required.' });
    }

    const submission = {
      submission_id: `SVC-${Math.floor(100000 + Math.random() * 900000)}`,
      service_id: serviceId,
      service_name: serviceName,
      customer_name: customerName,
      phone,
      email,
      deadline,
      summary: summary || '',
      answers: answers || {},
      submitted_at: new Date().toISOString()
    };

    storeDatabase.serviceSubmissions.unshift(submission);
    res.json({ success: true, submission });
  });

  // Admin Diagnostics and Data View (Section 8)
  // Returns orders, the licence key pool and customer PII, so it must never be
  // open on a public URL. In production it stays disabled until ADMIN_TOKEN is
  // set, and then requires that value in the x-admin-token header. Local
  // development is unaffected.
  app.get('/api/admin/data', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      const adminToken = process.env.ADMIN_TOKEN;
      if (!adminToken) {
        return res.status(404).json({ error: 'Not found.' });
      }
      if (req.header('x-admin-token') !== adminToken) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }
    }

    res.json({
      orders: storeDatabase.orders,
      licensePool: storeDatabase.licenseKeyPool,
      softwareRequests: storeDatabase.softwareRequests,
      laptopRequests: storeDatabase.laptopRequests,
      serviceSubmissions: storeDatabase.serviceSubmissions,
      pricingConfig: storeDatabase.pricingConfig
    });
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

