import express, { Router } from 'express';
import { sendCustomerDelivery, sendCustomerReceipt } from './email';
import { AdminRequest, requireAdmin } from './adminAuth';
import { writeAdminAudit } from './adminAudit';
import {
  addInternalNote,
  addTurnitinReport,
  adminBootstrap,
  assignLicence,
  assignSalesCode,
  importLicences,
  markDocumentReceived,
  markFulfilled,
  revealLicence,
  saveAnnouncement,
  saveService,
  updateProductImages,
  updateCatalogueMedia,
  updateCatalogueOrder,
  updateLandingImage,
  updateOrderWorkflow,
  deleteUnpaidOrder,
  saveProductConfiguration,
  saveCategory,
  saveBundle,
  saveLaptop,
  savePricingConfiguration
} from './adminData';
import { createOrderAccessToken, getOrder } from './orders';
import { applyOfflinePayment } from './payments';
import {
  catalogueImageObjectPath,
  deleteCatalogueImage,
  isCatalogueImagePath,
  MAX_CATALOGUE_IMAGE_BYTES,
  saveCatalogueImage,
  createSignedDownload,
  createSignedReportUpload,
  confirmUpload,
  isReportObjectPathForOrder,
  safeDocumentLabel,
  safeOriginalFilename,
  validateUpload,
  validateCatalogueImage
} from './storage';

function actor(req: AdminRequest) {
  if (!req.adminActor) throw new Error('Missing authenticated admin actor.');
  return req.adminActor;
}

function routeError(res: any, err: unknown, fallback: string) {
  console.error(`[admin] ${fallback}:`, err);
  const validationErrors = (err as { validationErrors?: unknown }).validationErrors;
  res.status(400).json({
    error: err instanceof Error ? err.message : fallback,
    validationErrors
  });
}

function whatsappRecipient(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return `233${digits.slice(1)}`;
  return digits;
}

function publicBaseUrl(req: AdminRequest): string {
  const configured = String(process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (configured) return configured;
  const forwarded = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return `${forwarded}://${req.get('host')}`;
}

export function createAdminRouter(): Router {
  const router = Router();
  // One gate for the whole subtree. Adding a route below cannot accidentally
  // bypass authentication by forgetting its own check.
  router.use(requireAdmin());

  router.get('/data', async (_req, res) => {
    try {
      res.json(await adminBootstrap());
    } catch (err) {
      routeError(res, err, 'Failed to load the admin portal.');
    }
  });

  router.post(
    '/catalogue/:kind/:itemId/images',
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], limit: MAX_CATALOGUE_IMAGE_BYTES }),
    async (req: AdminRequest, res) => {
      const kind = String(req.params.kind || '') as 'product' | 'bundle' | 'service' | 'laptop' | 'category';
      const itemId = String(req.params.itemId || '').trim();
      const role = ['icon', 'card', 'banner', 'mobile-banner', 'gallery'].includes(String(req.query.role)) ? String(req.query.role) as 'icon' | 'card' | 'banner' | 'mobile-banner' | 'gallery' : null;
      const contentType = String(req.header('content-type') || '').split(';')[0].trim();
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!['product', 'bundle', 'service', 'laptop', 'category'].includes(kind) || !itemId || !role) return res.status(400).json({ error: 'A catalogue item and image role are required.' });
      if (kind === 'category' && !['icon', 'card'].includes(role)) return res.status(400).json({ error: 'Categories use icon and clipped card artwork only.' });
      const validation = validateCatalogueImage(contentType, bytes.length);
      if (!validation.ok) return res.status(400).json({ error: validation.error });
      const objectPath = catalogueImageObjectPath(`${kind}-${itemId}`, role, contentType);
      let attached = false;
      try {
        await saveCatalogueImage(objectPath, bytes, contentType);
        const updated = await updateCatalogueMedia(kind, itemId, { role, objectPath });
        attached = true;
        if (updated.replacedPath) await deleteCatalogueImage(updated.replacedPath).catch(() => undefined);
        await writeAdminAudit(actor(req), { action: `catalogue.${role}-upload`, targetType: kind, targetId: itemId, details: { objectPath } });
        res.json(updated);
      } catch (err) {
        if (!attached) await deleteCatalogueImage(objectPath).catch(() => undefined);
        routeError(res, err, 'Failed to upload catalogue artwork.');
      }
    }
  );

  router.delete('/catalogue/:kind/:itemId/images', async (req: AdminRequest, res) => {
    const kind = String(req.params.kind || '') as 'product' | 'bundle' | 'service' | 'laptop' | 'category';
    const itemId = String(req.params.itemId || '').trim();
    const objectPath = String(req.body?.objectPath || '').trim();
    if (!['product', 'bundle', 'service', 'laptop', 'category'].includes(kind) || !itemId || !isCatalogueImagePath(objectPath)) return res.status(400).json({ error: 'A valid catalogue image is required.' });
    try {
      const updated = await updateCatalogueMedia(kind, itemId, { role: 'remove', objectPath });
      await deleteCatalogueImage(objectPath);
      res.json(updated);
    } catch (err) { routeError(res, err, 'Failed to remove catalogue artwork.'); }
  });

  router.post('/landing/images', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_CATALOGUE_IMAGE_BYTES }), async (req: AdminRequest, res) => {
    const role = req.query.role === 'desktop' ? 'desktop' : req.query.role === 'mobile' ? 'mobile' : null;
    const contentType = String(req.header('content-type') || '').split(';')[0].trim();
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!role) return res.status(400).json({ error: 'Choose desktop or mobile artwork.' });
    const validation = validateCatalogueImage(contentType, bytes.length);
    if (!validation.ok) return res.status(400).json({ error: validation.error });
    const objectPath = catalogueImageObjectPath('landing', role, contentType);
    try {
      await saveCatalogueImage(objectPath, bytes, contentType);
      const result = await updateLandingImage(role, objectPath);
      if (result.replacedPath) await deleteCatalogueImage(result.replacedPath).catch(() => undefined);
      await writeAdminAudit(actor(req), { action: `landing.${role}-upload`, targetType: 'settings', targetId: 'landing', details: { objectPath } });
      res.json(result);
    } catch (err) { await deleteCatalogueImage(objectPath).catch(() => undefined); routeError(res, err, 'Failed to upload landing artwork.'); }
  });

  router.post('/catalogue/order', async (req: AdminRequest, res) => {
    try {
      const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
      await updateCatalogueOrder(updates);
      await writeAdminAudit(actor(req), { action: 'catalogue.order-update', targetType: 'settings', targetId: 'catalogue-order', details: { count: updates.length } });
      res.json({ success: true });
    } catch (err) { routeError(res, err, 'Failed to update catalogue order.'); }
  });

  router.post(
    '/products/:productId/images',
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_CATALOGUE_IMAGE_BYTES }),
    async (req: AdminRequest, res) => {
      const productId = String(req.params.productId || '').trim();
      const role = req.query.role === 'banner' ? 'banner' : req.query.role === 'gallery' ? 'gallery' : null;
      const contentType = String(req.header('content-type') || '').split(';')[0].trim();
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!productId || !role) return res.status(400).json({ error: 'A product and image role are required.' });
      const validation = validateCatalogueImage(contentType, bytes.length);
      if (!validation.ok) return res.status(400).json({ error: validation.error });

      const objectPath = catalogueImageObjectPath(productId, role, contentType);
      let attached = false;
      try {
        await saveCatalogueImage(objectPath, bytes, contentType);
        const updated = await updateProductImages(productId, { role, objectPath });
        attached = true;
        if (updated.replacedPath && updated.replacedPath !== objectPath) {
          await deleteCatalogueImage(updated.replacedPath).catch((err) => {
            console.error('[admin] Failed to remove replaced banner:', err);
          });
        }
        await writeAdminAudit(actor(req), {
          action: `product.${role}-upload`,
          targetType: 'product',
          targetId: productId,
          details: { objectPath, sizeBytes: bytes.length }
        });
        res.json({ product: updated.product, objectPath });
      } catch (err) {
        if (!attached) await deleteCatalogueImage(objectPath).catch(() => undefined);
        routeError(res, err, 'Failed to upload the product image.');
      }
    }
  );

  router.delete('/products/:productId/images', async (req: AdminRequest, res) => {
    const productId = String(req.params.productId || '').trim();
    const objectPath = String(req.body?.objectPath || '').trim();
    if (!productId || !isCatalogueImagePath(objectPath)) {
      return res.status(400).json({ error: 'A valid catalogue image is required.' });
    }
    try {
      const expectedPrefix = `catalogue/${productId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}/`;
      if (!objectPath.startsWith(expectedPrefix)) {
        return res.status(400).json({ error: 'That image does not belong to this product.' });
      }
      const updated = await updateProductImages(productId, { role: 'remove', objectPath });
      await deleteCatalogueImage(objectPath);
      await writeAdminAudit(actor(req), {
        action: 'product.image-remove',
        targetType: 'product',
        targetId: productId,
        details: { objectPath }
      });
      res.json({ product: updated.product });
    } catch (err) {
      routeError(res, err, 'Failed to remove the product image.');
    }
  });

  router.get('/licences/:licenceId/reveal', async (req: AdminRequest, res) => {
    try {
      const licence = await revealLicence(String(req.params.licenceId));
      if (!licence) return res.status(404).json({ error: 'Licence not found.' });
      await writeAdminAudit(actor(req), {
        action: 'licence.reveal',
        targetType: 'licence',
        targetId: licence.licenceId,
        orderId: licence.assignedOrderId
      });
      res.json({ licenceCode: licence.licenceCode });
    } catch (err) {
      routeError(res, err, 'Failed to reveal licence.');
    }
  });

  router.post('/licences/import', async (req: AdminRequest, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const result = await importLicences(rows);
      if (result.errors.length) return res.status(400).json(result);
      await writeAdminAudit(actor(req), {
        action: 'licence.import',
        targetType: 'licence',
        targetId: result.licenceIds?.join(',') || 'batch',
        details: { count: result.imported }
      });
      res.json(result);
    } catch (err) {
      routeError(res, err, 'Failed to import licences.');
    }
  });

  router.post('/orders/:orderId/assign-licence', async (req: AdminRequest, res) => {
    try {
      const order = await assignLicence(String(req.params.orderId), req.body || {}, actor(req));
      let emailError: string | undefined;
      if (order.fulfilmentStatus === 'ready') {
        await sendCustomerDelivery(order).catch((err) => {
          emailError = err instanceof Error ? err.message : 'Delivery email failed.';
        });
      }
      await writeAdminAudit(actor(req), {
        action: 'order.assign-licence',
        targetType: 'order',
        targetId: order.orderId,
        orderId: order.orderId,
        details: { licenceId: order.licenceId, source: req.body?.manualKey ? 'manual' : 'pool', emailError }
      });
      res.json({ order, emailError });
    } catch (err) {
      routeError(res, err, 'Failed to assign licence.');
    }
  });

  router.post('/orders/:orderId/whatsapp-link', async (req: AdminRequest, res) => {
    try {
      const existing = await getOrder(String(req.params.orderId));
      if (!existing) return res.status(404).json({ error: 'Order not found.' });
      if (existing.fulfilmentStatus !== 'ready') {
        return res.status(409).json({ error: 'Complete the order before notifying the customer on WhatsApp.' });
      }
      const { order, token } = await createOrderAccessToken(existing.orderId);
      const orderUrl = `${publicBaseUrl(req)}/order/${encodeURIComponent(order.orderId)}?access=${encodeURIComponent(token)}`;
      const message = `Hello ${order.customerName}, your Hack-Key Tech order ${order.orderId} for ${order.productName} is complete. Use this secure link to submit any required details and view your deliverables: ${orderUrl}`;
      const whatsappUrl = `https://wa.me/${whatsappRecipient(order.phone)}?text=${encodeURIComponent(message)}`;
      await writeAdminAudit(actor(req), {
        action: 'order.whatsapp-link-create', targetType: 'order', targetId: order.orderId, orderId: order.orderId
      });
      res.json({ orderUrl, whatsappUrl });
    } catch (err) {
      routeError(res, err, 'Failed to prepare the WhatsApp notification.');
    }
  });

  router.post('/orders/:orderId/assign-sales-code', async (req: AdminRequest, res) => {
    try {
      const order = await assignSalesCode(String(req.params.orderId), req.body || {}, actor(req));
      await writeAdminAudit(actor(req), {
        action: 'order.assign-sales-code', targetType: 'order', targetId: order.orderId,
        orderId: order.orderId, details: { licenceId: order.licenceId }
      });
      res.json({ order });
    } catch (err) { routeError(res, err, 'Failed to assign the Sales ID.'); }
  });

  router.post('/orders/:orderId/mark-document-received', async (req: AdminRequest, res) => {
    try {
      const order = await markDocumentReceived(String(req.params.orderId), actor(req));
      await writeAdminAudit(actor(req), {
        action: 'order.document-received',
        targetType: 'order',
        targetId: order.orderId,
        orderId: order.orderId
      });
      res.json({ order });
    } catch (err) {
      routeError(res, err, 'Failed to mark the document received.');
    }
  });

  router.post('/orders/:orderId/fulfil', async (req: AdminRequest, res) => {
    try {
      const order = await markFulfilled(String(req.params.orderId), req.body || {}, actor(req));
      let emailError: string | undefined;
      await sendCustomerDelivery(order).catch((err) => {
        emailError = err instanceof Error ? err.message : 'Delivery email failed.';
      });
      await writeAdminAudit(actor(req), {
        action: 'order.fulfil',
        targetType: 'order',
        targetId: order.orderId,
        orderId: order.orderId,
        details: { emailError }
      });
      res.json({ order, emailError });
    } catch (err) {
      routeError(res, err, 'Failed to fulfil the order.');
    }
  });

  router.post('/orders/:orderId/record-offline-payment', async (req: AdminRequest, res) => {
    const reference = String(req.body?.reference || '').trim();
    const reason = String(req.body?.reason || '').trim();
    if (!reference || !reason) {
      return res.status(400).json({ error: 'A payment reference and reason are required.' });
    }
    try {
      const result = await applyOfflinePayment(String(req.params.orderId), { reference, reason });
      if (result.result === 'unknown-order') return res.status(404).json({ error: 'Order not found.' });
      if (result.result === 'already-paid') return res.status(409).json({ error: 'This order is already paid.' });
      await writeAdminAudit(actor(req), {
        action: 'order.record-offline-payment',
        targetType: 'order',
        targetId: result.order.orderId,
        orderId: result.order.orderId,
        details: { reference, reason }
      });
      res.json(result);
    } catch (err) {
      routeError(res, err, 'Failed to record offline payment.');
    }
  });

  router.post('/orders/:orderId/note', async (req: AdminRequest, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'A note is required.' });
    try {
      const order = await addInternalNote(String(req.params.orderId), text, actor(req));
      await writeAdminAudit(actor(req), {
        action: 'order.add-note',
        targetType: 'order',
        targetId: order.orderId,
        orderId: order.orderId
      });
      res.json({ order });
    } catch (err) {
      routeError(res, err, 'Failed to add the note.');
    }
  });

  router.put('/orders/:orderId/workflow', async (req: AdminRequest, res) => {
    try {
      const order = await updateOrderWorkflow(String(req.params.orderId), req.body || {}, actor(req));
      await writeAdminAudit(actor(req), { action: 'order.workflow-update', targetType: 'order', targetId: order.orderId, orderId: order.orderId });
      res.json({ order });
    } catch (err) { routeError(res, err, 'Failed to update the order workflow.'); }
  });

  router.delete('/orders/:orderId', async (req: AdminRequest, res) => {
    try {
      const orderId = String(req.params.orderId);
      await deleteUnpaidOrder(orderId);
      await writeAdminAudit(actor(req), { action: 'order.delete-unpaid', targetType: 'order', targetId: orderId, orderId });
      res.json({ success: true });
    } catch (err) { routeError(res, err, 'Failed to delete the order.'); }
  });

  router.post('/orders/:orderId/resend', async (req: AdminRequest, res) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      const kind = req.body?.kind === 'delivery' ? 'delivery' : 'receipt';
      if (kind === 'delivery') await sendCustomerDelivery(order);
      else await sendCustomerReceipt(order);
      await writeAdminAudit(actor(req), {
        action: `order.resend-${kind}`,
        targetType: 'order',
        targetId: order.orderId,
        orderId: order.orderId
      });
      res.json({ success: true });
    } catch (err) {
      routeError(res, err, 'Failed to resend email.');
    }
  });

  router.post('/orders/:orderId/nudge', async (req: AdminRequest, res) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      if (order.fulfilmentStatus !== 'awaiting-customer-input') {
        return res.status(409).json({ error: 'This order is not awaiting customer input.' });
      }
      await sendCustomerReceipt(order);
      await writeAdminAudit(actor(req), {
        action: 'order.nudge-customer',
        targetType: 'order',
        targetId: order.orderId,
        orderId: order.orderId
      });
      res.json({ success: true });
    } catch (err) {
      routeError(res, err, 'Failed to send the customer reminder.');
    }
  });

  router.get('/orders/:orderId/document', async (req: AdminRequest, res) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order?.documentPath) return res.status(404).json({ error: 'No document on this order.' });
      const url = await createSignedDownload(order.documentPath, order.documentOriginalName);
      await writeAdminAudit(actor(req), {
        action: 'order.document-download',
        targetType: 'order',
        targetId: order.orderId,
        orderId: order.orderId
      });
      res.json({ url });
    } catch (err) {
      routeError(res, err, 'Failed to prepare the document download.');
    }
  });

  router.post('/orders/:orderId/reports/upload-url', async (req: AdminRequest, res) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      if (order.paymentStatus !== 'paid') return res.status(409).json({ error: 'The order is not paid.' });
      if (order.productId !== 'TURNITIN' && order.variantId !== 'TURNITIN') return res.status(409).json({ error: 'This is not a Turnitin order.' });
      const contentType = String(req.body?.contentType || '');
      const validation = validateUpload(contentType, Number(req.body?.sizeBytes));
      if (!validation.ok) return res.status(400).json({ error: validation.error });
      const originalName = safeOriginalFilename(String(req.body?.originalName || ''));
      const label = safeDocumentLabel(String(req.body?.label || ''));
      res.json({ ...(await createSignedReportUpload(order.orderId, contentType)), originalName, label });
    } catch (err) {
      routeError(res, err, 'Failed to prepare the report upload.');
    }
  });

  router.post('/orders/:orderId/reports', async (req: AdminRequest, res) => {
    try {
      const orderId = String(req.params.orderId);
      const objectPath = String(req.body?.objectPath || '');
      if (!isReportObjectPathForOrder(objectPath, orderId)) return res.status(400).json({ error: 'That report upload does not belong to this order.' });
      const confirmed = await confirmUpload(objectPath);
      if (!confirmed.ok) return res.status(400).json({ error: confirmed.error });
      const order = await addTurnitinReport(orderId, {
        storagePath: objectPath,
        originalName: safeOriginalFilename(String(req.body?.originalName || '')),
        label: safeDocumentLabel(String(req.body?.label || '')),
        sizeBytes: confirmed.sizeBytes
      }, actor(req));
      const report = order.reportDocuments?.at(-1);
      await writeAdminAudit(actor(req), {
        action: 'order.report-upload', targetType: 'order', targetId: orderId, orderId,
        details: { reportId: report?.reportId, label: report?.label }
      });
      res.json({ order, report });
    } catch (err) {
      routeError(res, err, 'Failed to attach the Turnitin report.');
    }
  });

  router.get('/orders/:orderId/reports/:reportId', async (req: AdminRequest, res) => {
    try {
      const order = await getOrder(String(req.params.orderId));
      const report = order?.reportDocuments?.find((candidate) => candidate.reportId === String(req.params.reportId));
      if (!report?.storagePath) return res.status(404).json({ error: 'Report not found.' });
      const url = await createSignedDownload(report.storagePath, report.originalName);
      await writeAdminAudit(actor(req), {
        action: 'order.report-download', targetType: 'order', targetId: order!.orderId, orderId: order!.orderId,
        details: { reportId: report.reportId }
      });
      res.json({ url });
    } catch (err) {
      routeError(res, err, 'Failed to prepare the report download.');
    }
  });

  const saveServiceHandler = async (req: AdminRequest, res: any) => {
    try {
      const service = await saveService({ ...req.body, serviceId: String(req.params.serviceId || req.body?.serviceId || '') });
      await writeAdminAudit(actor(req), {
        action: 'service.save',
        targetType: 'service',
        targetId: service.serviceId
      });
      res.json({ service });
    } catch (err) {
      routeError(res, err, 'Failed to save the service.');
    }
  };
  router.post('/services', saveServiceHandler);
  router.put('/services/:serviceId', saveServiceHandler);

  router.put('/products/:productId/configuration', async (req: AdminRequest, res) => {
    try {
      const product = await saveProductConfiguration(String(req.params.productId), req.body);
      await writeAdminAudit(actor(req), { action: 'product.configuration-save', targetType: 'product', targetId: product.productId });
      res.json({ product });
    } catch (err) { routeError(res, err, 'Failed to save product configuration.'); }
  });

  router.put('/categories/:categoryId', async (req: AdminRequest, res) => {
    try {
      const category = await saveCategory(String(req.params.categoryId), req.body);
      await writeAdminAudit(actor(req), { action: 'category.configuration-save', targetType: 'category', targetId: category.categoryId });
      res.json({ category });
    } catch (err) { routeError(res, err, 'Failed to save category configuration.'); }
  });

  router.put('/bundles/:bundleId', async (req: AdminRequest, res) => {
    try {
      const bundle = await saveBundle(String(req.params.bundleId), req.body);
      await writeAdminAudit(actor(req), { action: 'bundle.configuration-save', targetType: 'bundle', targetId: bundle.bundleId });
      res.json({ bundle });
    } catch (err) { routeError(res, err, 'Failed to save bundle configuration.'); }
  });

  router.put('/laptops/:laptopId', async (req: AdminRequest, res) => {
    try {
      const laptop = await saveLaptop(String(req.params.laptopId), req.body);
      await writeAdminAudit(actor(req), { action: 'laptop.save', targetType: 'laptop', targetId: laptop.laptopId });
      res.json({ laptop });
    } catch (err) { routeError(res, err, 'Failed to save laptop properties.'); }
  });

  router.put('/pricing', async (req: AdminRequest, res) => {
    try {
      const pricing = await savePricingConfiguration(req.body || {});
      await writeAdminAudit(actor(req), {
        action: 'pricing.configuration-save',
        targetType: 'settings',
        targetId: 'pricing',
        details: {
          silentAdjustmentActive: pricing.silentAdjustment.active,
          globalPromotionActive: pricing.globalPromotion.active,
          itemSpecificPromotionActive: pricing.itemSpecificPromotion.active
        }
      });
      res.json({ pricing });
    } catch (err) { routeError(res, err, 'Failed to save pricing and promotions.'); }
  });

  const saveAnnouncementHandler = async (req: AdminRequest, res: any) => {
    try {
      const announcement = await saveAnnouncement({
        ...req.body,
        announcementId: String(req.params.announcementId || req.body?.announcementId || '')
      });
      await writeAdminAudit(actor(req), {
        action: 'announcement.save',
        targetType: 'announcement',
        targetId: announcement.announcementId,
        details: { active: announcement.active }
      });
      res.json({ announcement });
    } catch (err) {
      routeError(res, err, 'Failed to save the announcement.');
    }
  };
  router.post('/announcements', saveAnnouncementHandler);
  router.put('/announcements/:announcementId', saveAnnouncementHandler);

  return router;
}
