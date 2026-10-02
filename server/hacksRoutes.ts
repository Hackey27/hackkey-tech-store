import express, { Router, Request } from 'express';
import { getHacksData, getPublicHacks, recordHackView, saveHackPost, saveHackTheme } from './hacksData';
import { requireAdmin, AdminRequest } from './adminAuth';
import { writeAdminAudit } from './adminAudit';
import { COLLECTIONS, getFirestore } from './firestore';
import { catalogueImageObjectPath, deleteCatalogueImage, MAX_CATALOGUE_IMAGE_BYTES, saveCatalogueImage, validateCatalogueImage } from './storage';
import { cleanLaptopIssue } from '../shared/hacks';
import { createRequest } from './orders';

export function createHacksLimiter(capacity = 10000, clock = Date.now) {
  const hits = new Map<string, { start: number; count: number }>();
  return (key: string, max: number, windowMs = 60000) => {
    const now = clock();
    if (hits.size >= capacity) for (const [id, entry] of hits) if (now - entry.start >= windowMs) hits.delete(id);
    if (hits.size >= capacity && !hits.has(key)) return true;
    const previous = hits.get(key);
    const entry = previous && now - previous.start < windowMs ? previous : { start: now, count: 0 };
    entry.count++; hits.set(key, entry);
    return entry.count > max;
  };
}
const limited = createHacksLimiter();
// Match the admin limiter's Cloud Run proxy handling.
const callerIp = (req: Request) => String(req.headers['x-forwarded-for'] || '').split(',').map(value => value.trim()).filter(Boolean).at(-1) || req.socket.remoteAddress || 'unknown';
const safeId = (value: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,69}$/.test(value);
export function createHacksRouter(): Router {
  const router = Router();
  router.get('/', async (_req, res) => { try { res.json(await getPublicHacks()); } catch { res.status(500).json({ error: 'Could not load tips and tools.' }); } });
  router.post('/posts/:postId/view', async (req, res) => {
    const postId = String(req.params.postId);
    if (!safeId(postId)) return res.status(400).json({ error: 'Invalid post.' });
    if (limited(`view:${callerIp(req)}:${postId}`, 1, 60000)) return res.status(204).end();
    if (limited(`views:${callerIp(req)}`, 40)) return res.status(429).json({ error: 'Please wait before opening more posts.' });
    try { res.json({ views: await recordHackView(postId) }); } catch { res.status(404).json({ error: 'Post not found.' }); }
  });
  return router;
}
export function createLaptopIssueRouter(): Router {
  const router = Router();
  router.post('/', async (req, res) => {
    if (limited(`issue:${callerIp(req)}`, 5)) return res.status(429).json({ error: 'Please wait a minute before submitting another issue.' });
    let payload;
    try { payload = cleanLaptopIssue(req.body); } catch (error) { return res.status(400).json({ error: (error as Error).message }); }
    try { const request = await createRequest('laptop-issue', payload); res.status(201).json({ success: true, requestId: request.requestId }); }
    catch { res.status(500).json({ error: 'Could not submit your issue. Please try again.' }); }
  });
  return router;
}
export function createAdminHacksRouter(): Router {
  const router = Router();
  router.use(requireAdmin());
  const failure = (res: any, error: unknown) => res.status(400).json({ error: error instanceof Error ? error.message : 'Could not save Hack-this content.' });
  router.get('/', async (_req, res) => { try { res.json(await getHacksData()); } catch (error) { failure(res, error); } });
  router.put('/themes/:themeId', async (req: AdminRequest, res) => {
    try { const theme = await saveHackTheme(String(req.params.themeId), req.body); await writeAdminAudit(req.adminActor!, { action: 'hack.theme-save', targetType: 'hack-theme', targetId: theme.themeId }); res.json({ theme }); } catch (error) { failure(res, error); }
  });
  router.put('/posts/:postId', async (req: AdminRequest, res) => {
    try { const post = await saveHackPost(String(req.params.postId), req.body); await writeAdminAudit(req.adminActor!, { action: 'hack.post-save', targetType: 'hack-post', targetId: post.postId }); res.json({ post }); } catch (error) { failure(res, error); }
  });
  router.post('/posts/:postId/images', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_CATALOGUE_IMAGE_BYTES }), async (req: AdminRequest, res) => {
    const postId = String(req.params.postId);
    if (!safeId(postId)) return res.status(400).json({ error: 'Invalid post.' });
    const type = String(req.header('content-type') || '').split(';')[0].trim();
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const validation = validateCatalogueImage(type, bytes.length);
    if (!validation.ok) return res.status(400).json({ error: validation.error });
    const objectPath = catalogueImageObjectPath(`hacks-${postId}`, 'guide', type);
    try {
      const post = await getFirestore().collection(COLLECTIONS.hackPosts).doc(postId).get();
      if (!post.exists) return res.status(404).json({ error: 'Save the post before uploading tutorial images.' });
      await saveCatalogueImage(objectPath, bytes, type);
      await writeAdminAudit(req.adminActor!, { action: 'hack.image-upload', targetType: 'hack-post', targetId: postId, details: { objectPath, sizeBytes: bytes.length } });
      res.json({ objectPath });
    } catch (error) { await deleteCatalogueImage(objectPath).catch(() => undefined); failure(res, error); }
  });
  return router;
}
