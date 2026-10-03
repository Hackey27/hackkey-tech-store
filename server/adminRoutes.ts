import { getRmbPricingSettings, saveRmbPricingSettings } from './rmbPricingSettings';
import { priceRmbProduct, priceRmbLaptop } from '../shared/rmbPricing';
import express, { Router } from 'express';
import { sendCustomerDelivery, sendCustomerOrderNotification, sendCustomerReceipt } from './email';
import { AdminRequest, hasRecentAdminAuth, requireAdmin } from './adminAuth';
import { writeAdminAudit } from './adminAudit';
import {
  addInternalNote,
  addTurnitinReport,
  adminBootstrap,
  assignLicence,
  assignSalesCode,
  addGeneratedActivationCode,
  correctAssignedOrderValue,
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
import { savePaymentSettings } from './paymentSettings';
import { saveSupportSettings } from './supportSettings';
import { setPaymentLater } from './paymentReminders';
import { buildOrderNotification, validateNotificationPurpose } from '../src/utils/orderNotification';
import { CustomerNotificationPurpose, Order, PreorderCategory, PreorderProduct } from '../shared/types';
import { assignItemToPackage, createPreorderPackage, savePreorderCategory, savePreorderProduct, listPreorderProducts, setPackageStatus, setPreorderItemStatus } from './preorderData';
import { invalidatePreorderCatalogueCache } from './preorderCatalogue';
import { PreorderItemStatus, PreorderPackageStatus } from '../shared/types';

/** The five item statuses and the three a package owns, in order. Kept here so
 *  a body cannot smuggle in a status the admin screens never offer. */
const PREORDER_ITEM_STATUSES: PreorderItemStatus[] = [
  'awaiting-order',
  'delivered-in-china',
  'received-by-shipping',
  'received-in-ghana',
  'delivered-to-client',
];
const PREORDER_PACKAGE_STATUSES: PreorderPackageStatus[] = [
  'delivered-in-china',
  'received-by-shipping',
  'received-in-ghana',
];
import { COLLECTIONS, getFirestore } from './firestore';
import { createSoftwareProduct, saveSoftwareVariant } from './softwareSetupData';
import { createAdminHacksRouter } from './hacksRoutes';
import { MAX_CATALOGUE_IMAGE_BYTES, catalogueImageObjectPath, confirmUpload, createSignedDownload, createSignedReportUpload, deleteCatalogueImage, isCatalogueImagePath, isReportObjectPathForOrder, isRequestImagePath, safeDocumentLabel, safeOriginalFilename, saveCatalogueImage, validateCatalogueImage, validateUpload } from './storage';

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

const notificationPurposes: CustomerNotificationPurpose[] = [
  'payment-reminder', 'customer-input', 'status-update', 'complete', 'turnitin-document', 'turnitin-document-received', 'turnitin-report'
];

function notificationPurpose(value: unknown): CustomerNotificationPurpose | null {
  const purpose = String(value || '') as CustomerNotificationPurpose;
  return notificationPurposes.includes(purpose) ? purpose : null;
}

async function prepareOrderNotification(req: AdminRequest, order: Order, purpose: CustomerNotificationPurpose) {
  const validationError = validateNotificationPurpose(order, purpose);
  if (validationError) throw new Error(validationError);
  const access = await createOrderAccessToken(order.orderId);
  const orderUrl = `${publicBaseUrl(req)}/order/${encodeURIComponent(access.order.orderId)}?access=${encodeURIComponent(access.token)}`;
  return { order: access.order, orderUrl, content: buildOrderNotification(access.order, purpose, orderUrl) };
}

export function createAdminRouter(): Router {
  const router = Router();
  // One gate for the whole subtree. Adding a route below cannot accidentally
  // bypass authentication by forgetting its own check.
  router.use(requireAdmin());
  router.use('/hacks', createAdminHacksRouter());

  router.get('/rmb-pricing', async (_req, res) => {
    try {
      const [settings, products, laptops] = await Promise.all([getRmbPricingSettings(), listPreorderProducts(true), getFirestore().collection(COLLECTIONS.laptops).get()]);
      const issues = [...products.flatMap(product => priceRmbProduct(product, settings).errors), ...laptops.docs.flatMap(doc => priceRmbLaptop(doc.data() as import('../shared/types').Laptop, settings).errors)];
      res.json({ settings, issues });
    } catch (error) { routeError(res, error, 'Could not load Exchange Rate & Charges.'); }
  });
  router.put('/rmb-pricing', async (req: AdminRequest, res) => {
    try { res.json({ settings: await saveRmbPricingSettings(req.body, actor(req)) }); }
    catch (error) { routeError(res, error, 'Could not save Exchange Rate & Charges.'); }
  });

  router.get('/data', async (_req, res) => {
    try {
      res.json(await adminBootstrap());
    } catch (err) {
      routeError(res, err, 'Failed to load the admin portal.');
    }
  });

  router.put('/payments', async (req: AdminRequest, res) => {
    try {
      const { newValue } = await savePaymentSettings(req.body, actor(req));
      res.json({ payments: newValue });
    } catch (err) {
      routeError(res, err, 'Failed to save payment settings.');
    }
  });

  router.put('/support', async (req: AdminRequest, res) => {
    try {
      const { newValue } = await saveSupportSettings(req.body, actor(req));
      res.json({ support: newValue });
    } catch (err) {
      routeError(res, err, 'Failed to save support tools.');
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
    '/products/:productId/guide-images',
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_CATALOGUE_IMAGE_BYTES }),
    async (req: AdminRequest, res) => {
      const productId = String(req.params.productId || '').trim();
      const contentType = String(req.header('content-type') || '').split(';')[0].trim();
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!productId) return res.status(400).json({ error: 'A software product is required.' });
      const validation = validateCatalogueImage(contentType, bytes.length);
      if (!validation.ok) return res.status(400).json({ error: validation.error });
      const objectPath = catalogueImageObjectPath(productId, 'guide', contentType);
      try {
        const product = await getFirestore().collection(COLLECTIONS.products).doc(productId).get();
        if (!product.exists) return res.status(404).json({ error: 'Software product not found.' });
        await saveCatalogueImage(objectPath, bytes, contentType);
        await writeAdminAudit(actor(req), { action: 'product.guide-image-upload', targetType: 'product', targetId: productId, details: { objectPath, sizeBytes: bytes.length } });
        res.json({ objectPath });
      } catch (err) {
        await deleteCatalogueImage(objectPath).catch(() => undefined);
        routeError(res, err, 'Failed to upload installation screenshot.');
      }
    }
  );

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
      const purpose = notificationPurpose(req.body?.purpose || 'complete');
      if (!purpose) return res.status(400).json({ error: 'Unsupported WhatsApp notification type.' });
      const prepared = await prepareOrderNotification(req, existing, purpose);
      const whatsappUrl = `https://wa.me/${whatsappRecipient(prepared.order.phone)}?text=${encodeURIComponent(prepared.content.message)}`;
      await writeAdminAudit(actor(req), {
        action: 'order.whatsapp-link-create', targetType: 'order', targetId: prepared.order.orderId, orderId: prepared.order.orderId, details: { purpose }
      });
      res.json({ orderUrl: prepared.orderUrl, whatsappUrl });
    } catch (err) {
      routeError(res, err, 'Failed to prepare the WhatsApp notification.');
    }
  });

  router.post('/orders/:orderId/notify', async (req: AdminRequest, res) => {
    try {
      const existing = await getOrder(String(req.params.orderId));
      if (!existing) return res.status(404).json({ error: 'Order not found.' });
      const purpose = notificationPurpose(req.body?.purpose);
      const channel = req.body?.channel === 'email' ? 'email' : req.body?.channel === 'whatsapp' ? 'whatsapp' : null;
      if (!purpose || !channel) return res.status(400).json({ error: 'Choose a supported notification and channel.' });
      const prepared = await prepareOrderNotification(req, existing, purpose);
      let whatsappUrl: string | undefined;
      if (channel === 'email') {
        await sendCustomerOrderNotification(prepared.order, prepared.content.subject, prepared.content.message);
      } else {
        whatsappUrl = `https://wa.me/${whatsappRecipient(prepared.order.phone)}?text=${encodeURIComponent(prepared.content.message)}`;
      }
      await writeAdminAudit(actor(req), {
        action: `order.notify-${channel}`, targetType: 'order', targetId: prepared.order.orderId, orderId: prepared.order.orderId,
        // Never persist the bearer link itself in the audit collection.
        details: { purpose }
      });
      res.json({ success: true, orderUrl: prepared.orderUrl, whatsappUrl });
    } catch (err) {
      routeError(res, err, 'Failed to notify the customer.');
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

  router.post('/orders/:orderId/generated-licence', async (req: AdminRequest, res) => {
    try {
      await addGeneratedActivationCode(String(req.params.orderId), String(req.body?.code || ''), actor(req));
      await writeAdminAudit(actor(req), { action: 'order.add-generated-licence', targetType: 'order', targetId: String(req.params.orderId), orderId: String(req.params.orderId) });
      res.json({ success: true });
    } catch (err) { routeError(res, err, 'Failed to add the generated licence.'); }
  });

  router.put('/orders/:orderId/assigned-value', async (req: AdminRequest, res) => {
    const kind = String(req.body?.kind || '');
    if (!['sales-id', 'licence', 'momo-reference'].includes(kind)) return res.status(400).json({ error: 'Choose the assigned value to correct.' });
    if (!hasRecentAdminAuth(actor(req))) return res.status(403).json({ error: 'Re-enter your admin password before changing an assigned value.' });
    try {
      await correctAssignedOrderValue(String(req.params.orderId), kind as 'sales-id' | 'licence' | 'momo-reference', String(req.body?.value || ''), String(req.body?.reason || ''), actor(req));
      await writeAdminAudit(actor(req), { action: `order.correct-${kind}`, targetType: 'order', targetId: String(req.params.orderId), orderId: String(req.params.orderId), details: { reason: String(req.body?.reason || '').trim(), removed: !String(req.body?.value || '').trim() } });
      res.json({ success: true });
    } catch (err) { routeError(res, err, 'Failed to correct the assigned value.'); }
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
    const suppliedReference = String(req.body?.reference || '').trim();
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A payment reason is required.' });
    const reference = suppliedReference || `MOMO-NO-ID-${Date.now()}`;
    try {
      const result = await applyOfflinePayment(String(req.params.orderId), { reference, reason });
      if (result.result === 'unknown-order') return res.status(404).json({ error: 'Order not found.' });
      if (result.result === 'already-paid') return res.status(409).json({ error: 'This order is already paid.' });
      await writeAdminAudit(actor(req), {
        action: 'order.record-offline-payment',
        targetType: 'order',
        targetId: result.order.orderId,
        orderId: result.order.orderId,
        details: { reference, reason, transactionIdProvided: Boolean(suppliedReference) }
      });
      res.json(result);
    } catch (err) {
      routeError(res, err, 'Failed to record offline payment.');
    }
  });

  router.post('/orders/:orderId/payment-later', async (req: AdminRequest, res) => {
    try {
      const reminderDate = String(req.body?.reminderDate || '').trim() || undefined;
      const order = await setPaymentLater(String(req.params.orderId), reminderDate, actor(req));
      await writeAdminAudit(actor(req), {
        action: 'order.payment-later', targetType: 'order', targetId: order.orderId, orderId: order.orderId,
        details: { reminderDate: reminderDate || null }
      });
      res.json({ order });
    } catch (err) {
      routeError(res, err, 'Failed to record payment-later arrangement.');
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

  router.post('/products', async (req: AdminRequest, res) => {
    try {
      const product = await createSoftwareProduct(req.body);
      await writeAdminAudit(actor(req), { action: 'product.create', targetType: 'product', targetId: product.productId });
      res.status(201).json({ product });
    } catch (err) { routeError(res, err, 'Failed to create software.'); }
  });
  router.post('/products/:productId/versions', async (req: AdminRequest, res) => {
    try {
      const product = await saveSoftwareVariant(String(req.params.productId), req.body, true);
      await writeAdminAudit(actor(req), { action: 'product.version-create', targetType: 'product', targetId: product.productId });
      res.status(201).json({ product });
    } catch (err) { routeError(res, err, 'Failed to create the version.'); }
  });
  router.put('/products/:productId/versions/:variantId', async (req: AdminRequest, res) => {
    try {
      if (req.body?.variantId !== req.params.variantId) throw new Error('Version IDs cannot be renamed.');
      const product = await saveSoftwareVariant(String(req.params.productId), req.body, false);
      await writeAdminAudit(actor(req), { action: 'product.version-save', targetType: 'product', targetId: product.productId });
      res.json({ product });
    } catch (err) { routeError(res, err, 'Failed to save the version.'); }
  });

  /* -- pre-order setup ---------------------------------------------------
   *
   * savePreorderProduct runs validatePreorderProduct and throws on an error,
   * so a duplicate selection cannot be written by this route even if the
   * portal's own check were bypassed. Warnings come back in the response for
   * the seller to read: a deliberate gap in the variant grid is legitimate.  */

  router.put('/preorder/products/:productId', async (req: AdminRequest, res) => {
    try {
      const product: PreorderProduct = { ...req.body, productId: String(req.params.productId) };
      const { warnings } = await savePreorderProduct(product);
      // The storefront caches this catalogue for 60 seconds. Without this a
      // seller saves, reloads the shop, sees the old product and saves again.
      invalidatePreorderCatalogueCache();
      await writeAdminAudit(actor(req), { action: 'preorder.product-save', targetType: 'preorder-product', targetId: product.productId });
      res.json({ product, warnings });
    } catch (err) { routeError(res, err, 'Failed to save the pre-order product.'); }
  });

  /**
   * Artwork for a pre-order product.
   *
   * Unlike the catalogue route this only stores the file and hands back its
   * path; it attaches nothing. A pre-order product is edited as a whole draft
   * and written by one PUT, so the browser puts the returned path wherever the
   * seller was working — the preview image, the gallery, or one variant's
   * image assignment — and it is saved with everything else. Attaching here
   * would write the product twice and lose whatever else was being edited.
   */
  router.post(
    '/preorder/products/:productId/images',
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_CATALOGUE_IMAGE_BYTES }),
    async (req: AdminRequest, res) => {
      const productId = String(req.params.productId || '').trim();
      const contentType = String(req.header('content-type') || '').split(';')[0].trim();
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!productId) return res.status(400).json({ error: 'A pre-order product is required.' });
      const validation = validateCatalogueImage(contentType, bytes.length);
      if (!validation.ok) return res.status(400).json({ error: validation.error });
      // Namespaced away from the software catalogue's own ids, which are a
      // separate collection and could otherwise collide on a shared name.
      const objectPath = catalogueImageObjectPath(`preorder-${productId}`, 'gallery', contentType);
      try {
        await saveCatalogueImage(objectPath, bytes, contentType);
        await writeAdminAudit(actor(req), {
          action: 'preorder.image-upload',
          targetType: 'preorder-product',
          targetId: productId,
          details: { objectPath, sizeBytes: bytes.length },
        });
        res.json({ objectPath });
      } catch (err) {
        await deleteCatalogueImage(objectPath).catch(() => undefined);
        routeError(res, err, 'Failed to upload pre-order artwork.');
      }
    }
  );

  /** Removes the stored file. The product still has to be saved to drop the
   *  reference, which is why this never touches the document. */
  router.delete('/preorder/products/:productId/images', async (req: AdminRequest, res) => {
    const objectPath = String(req.body?.objectPath || '').trim();
    if (!isCatalogueImagePath(objectPath)) return res.status(400).json({ error: 'A valid image is required.' });
    try {
      await deleteCatalogueImage(objectPath);
      res.json({ success: true });
    } catch (err) { routeError(res, err, 'Failed to remove pre-order artwork.'); }
  });

  /**
   * A short-lived link to one picture attached to a product request.
   *
   * The same shape customer documents use: the bytes are never public, and the
   * admin is handed a signed URL that expires rather than a permanent one. A
   * browser cannot put an Authorization header on an <img>, so returning a URL
   * is what lets the portal show a thumbnail at all.
   *
   * Not written to admin_audit. These are pictures a customer attached so that
   * somebody would look at them, and a thumbnail grid would write an audit row
   * per image per view — noise that would bury the reveals that do matter.
   */
  router.get('/requests/images', async (req: AdminRequest, res) => {
    const objectPath = String(req.query.path || '');
    if (!isRequestImagePath(objectPath)) return res.status(400).json({ error: 'That is not a request image.' });
    try {
      res.json({ url: await createSignedDownload(objectPath) });
    } catch (err) { routeError(res, err, 'Failed to open that picture.'); }
  });

  /* -- pre-order management ----------------------------------------------
   *
   * Statuses one and two, and the last, are set on an item. Three and four are
   * set on the PACKAGE and cascade to everything inside it, which is what the
   * transaction in preorderData guarantees: a partial write would leave some
   * items claiming to be in Ghana and others still with the shipper, with
   * nothing on screen to say which is right.                                */

  router.put('/preorder/orders/:preorderId/items/:itemId/status', async (req: AdminRequest, res) => {
    try {
      const status = String(req.body?.status || '') as PreorderItemStatus;
      if (!PREORDER_ITEM_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'That is not a pre-order item status.' });
      }
      await setPreorderItemStatus(String(req.params.preorderId), String(req.params.itemId), status);
      await writeAdminAudit(actor(req), {
        action: 'preorder.item-status',
        targetType: 'preorder',
        targetId: String(req.params.preorderId),
        details: { itemId: String(req.params.itemId), status },
      });
      res.json({ success: true });
    } catch (err) { routeError(res, err, 'Failed to update the item status.'); }
  });

  router.post('/preorder/packages', async (req: AdminRequest, res) => {
    try {
      const packageId = String(req.body?.packageId || '').trim();
      const label = String(req.body?.label || '').trim();
      if (!packageId) return res.status(400).json({ error: 'A package needs the identifier written on the box.' });
      const now = new Date().toISOString();
      await createPreorderPackage({
        packageId,
        label: label || packageId,
        createdAt: now,
        lastUpdated: now,
        status: 'delivered-in-china',
        closed: false,
      });
      await writeAdminAudit(actor(req), { action: 'preorder.package-create', targetType: 'preorder-package', targetId: packageId });
      res.json({ success: true });
    } catch (err) { routeError(res, err, 'Failed to create the package.'); }
  });

  router.put('/preorder/orders/:preorderId/items/:itemId/package', async (req: AdminRequest, res) => {
    try {
      const packageId = String(req.body?.packageId || '').trim();
      if (!packageId) return res.status(400).json({ error: 'Choose a package.' });
      await assignItemToPackage(String(req.params.preorderId), String(req.params.itemId), packageId);
      await writeAdminAudit(actor(req), {
        action: 'preorder.package-assign',
        targetType: 'preorder',
        targetId: String(req.params.preorderId),
        details: { itemId: String(req.params.itemId), packageId },
      });
      res.json({ success: true });
    } catch (err) { routeError(res, err, 'Failed to assign the item to that package.'); }
  });

  router.put('/preorder/packages/:packageId/status', async (req: AdminRequest, res) => {
    try {
      const status = String(req.body?.status || '') as PreorderPackageStatus;
      if (!PREORDER_PACKAGE_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'That is not a package status.' });
      }
      const { itemsUpdated } = await setPackageStatus(String(req.params.packageId), status);
      await writeAdminAudit(actor(req), {
        action: 'preorder.package-status',
        targetType: 'preorder-package',
        targetId: String(req.params.packageId),
        details: { status, itemsUpdated },
      });
      res.json({ itemsUpdated });
    } catch (err) { routeError(res, err, 'Failed to move the package on.'); }
  });

  router.put('/preorder/categories/:categoryId', async (req: AdminRequest, res) => {
    try {
      const category: PreorderCategory = {
        ...req.body,
        categoryId: String(req.params.categoryId),
        parentId: req.body?.parentId || null
      };
      await savePreorderCategory(category);
      invalidatePreorderCatalogueCache();
      await writeAdminAudit(actor(req), { action: 'preorder.category-save', targetType: 'preorder-category', targetId: category.categoryId });
      res.json({ category });
    } catch (err) { routeError(res, err, 'Failed to save the pre-order category.'); }
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
