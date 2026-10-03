import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Firestore } from '@google-cloud/firestore';
import { cleanHackPost, cleanHackTheme, cleanLaptopIssue, emptyHacksFilters, filterHackPosts, hackMatchedStep, publicHacks, HackPost, HackTheme, HACK_OPERATING_SYSTEMS, hackLinkCount } from '../shared/hacks';
import { getPublicHacks, recordHackView, saveHackPost } from '../server/hacksData';
import { createAdminHacksRouter, createLaptopIssueRouter, createHacksLimiter } from '../server/hacksRoutes';

const theme: HackTheme = { themeId: 'tips', name: 'Computer advice', description: 'Helpful fixes', active: true, sortOrder: 1 };
const post = (patch: Partial<HackPost> = {}): HackPost => ({ postId: 'dns', themeId: 'tips', title: 'Improve your connection', description: 'A quick fix.', active: true, steps: [{ body: 'Flush the DNS cache.', images: [{ src: 'catalogue/hacks-dns/guide/test.webp', alt: 'Windows settings', markers: [{ x: 50, y: 25, label: 'Click café settings' }] }] }], links: [{ label: 'Open network tool', url: 'https://example.com/network' }], createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '', views: 5, ...patch });

test('tutorial titles are optional; links and screenshot markers are validated', () => {
  const clean = cleanHackPost('dns', post());
  assert.equal(clean.steps[0].title, undefined);
  assert.equal(clean.steps[0].images![0].markers![0].x, 50);
  assert.throws(() => cleanHackPost('dns', post({ links: [{ label: 'Danger', url: 'javascript:alert(1)' }] })), /HTTPS/);
  assert.throws(() => cleanHackPost('dns', post({ steps: [{ body: 'Fix', images: [{ src: 'catalogue/hacks-other/guide/test.webp', alt: 'Screenshot' }] }] })), /invalid image/);
  assert.throws(() => cleanHackPost('dns', post({ steps: [{ body: 'Fix', images: [{ src: 'catalogue/hacks-dns/guide/test.webp', alt: 'Screenshot', markers: [{ x: 101, y: 0, label: 'Click' }] }] }] })), /within the image/);
  assert.throws(() => cleanHackPost('dns', post({ description: '', steps: [], links: [] })), /Add a message/);
  assert.throws(() => cleanHackPost('dns', post({ steps: [{ body: '' }] })), /needs a description/);
  assert.throws(() => cleanHackTheme('bad/id', theme), /valid ID/);
});

test('search covers messages, themes, tutorial descriptions, images, markers and tool URLs without splitting posts', () => {
  const catalogue = { themes: [theme], posts: [post()] };
  for (const query of ['quick fix', 'computer advice', 'dns CACHE', 'Windows settings', 'cafe', 'example.com/network', 'network tool']) {
    assert.deepEqual(filterHackPosts(catalogue, query, emptyHacksFilters()).map(p => p.postId), ['dns'], query);
  }
  assert.equal(hackMatchedStep(post(), 'dns'), 0);
  assert.equal(hackMatchedStep(post(), 'cafe'), 0);
  assert.equal(hackMatchedStep(post(), 'missing'), undefined);
  assert.equal(filterHackPosts(catalogue, 'dns missing', emptyHacksFilters()).length, 0);
});

test('themes, step and tool filters combine; popular/newest/oldest ordering is consistent', () => {
  const catalogue = { themes: [theme], posts: [post(), post({ postId: 'old', createdAt: '2026-09-01', views: 100, steps: [], links: [] }), post({ postId: 'new', themeId: 'ai', createdAt: '2026-10-02', views: 0, steps: [], links: [] })] };
  const sorted = (sort: any) => filterHackPosts(catalogue, '', { ...emptyHacksFilters(), sort }).map(p => p.postId);
  assert.deepEqual(sorted('popular'), ['old', 'dns', 'new']);
  assert.deepEqual(sorted('newest'), ['new', 'dns', 'old']);
  assert.deepEqual(sorted('oldest'), ['old', 'dns', 'new']);
  assert.deepEqual(sorted('with-steps'), ['dns']);
  assert.deepEqual(sorted('without-steps'), ['new', 'old']);
  assert.deepEqual(filterHackPosts(catalogue, '', { ...emptyHacksFilters(), themeId: 'tips', links: 'without-links' }).map(p => p.postId), ['old']);
  assert.deepEqual(filterHackPosts(catalogue, '', { ...emptyHacksFilters(), links: 'with-links' }).map(p => p.postId), ['dns']);
});

test('draft posts and posts under hidden or missing themes never reach the public catalogue', () => {
  assert.deepEqual(publicHacks([theme, { ...theme, themeId: 'hidden', active: false }], [post(), post({ postId: 'draft', active: false }), post({ postId: 'hidden', themeId: 'hidden' }), post({ postId: 'orphan', themeId: 'missing' })]).posts.map(p => p.postId), ['dns']);
});

function database() {
  const rows = new Map<string, any>([['hackThemes/tips', structuredClone(theme)], ['hackPosts/dns', structuredClone(post())]]);
  const snapshot = (ref: any) => ({ exists: rows.has(ref.key), data: () => structuredClone(rows.get(ref.key)) });
  const collection = (name: string) => {
    const query = (active?: boolean): any => ({
      doc: (id: string) => ({ key: `${name}/${id}` }),
      where: (_field: string, _op: string, value: boolean) => query(value),
      get: async () => ({ docs: [...rows].filter(([key, value]) => key.startsWith(`${name}/`) && (active === undefined || value.active === active)).map(([key, value]) => ({ id: key.split('/')[1], data: () => structuredClone(value) })) }),
    });
    return query();
  };
  const db = { collection, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({ get: async (ref: any) => snapshot(ref), set: (ref: any, value: any) => writes.push(() => rows.set(ref.key, structuredClone(value))), update: (ref: any, value: any) => writes.push(() => rows.set(ref.key, { ...rows.get(ref.key), ...value })) });
    writes.forEach(write => write()); return result;
  } } as unknown as Firestore;
  return { db, rows };
}

test('post updates preserve creation time and view count; views only increment for published content', async () => {
  const { db, rows } = database();
  const saved = await saveHackPost('dns', post({ title: 'Changed', createdAt: 'fake', views: 999999 }), db);
  assert.equal(saved.createdAt, post().createdAt);
  assert.equal(saved.views, 5);
  assert.equal(await recordHackView('dns', db), 6);
  rows.get('hackThemes/tips').active = false;
  await assert.rejects(recordHackView('dns', db), /not found/);
  assert.equal(rows.get('hackPosts/dns').views, 6);
  assert.equal((await getPublicHacks(db)).posts.length, 0);
  await assert.rejects(saveHackPost('dns', post({ themeId: 'missing' }), db), /Save the theme/);
});

test('laptop issues require valid contact details and keep laptop information in the private request payload', () => {
  const payload = cleanLaptopIssue({ customerName: ' Test ', phone: '0241234567', issue: ' No display ', model: 'ThinkPad', attempts: 'Restarted' });
  assert.equal(payload.customerName, 'Test');
  assert.equal(payload.details.issue, 'No display');
  assert.equal(payload.details.model, 'ThinkPad');
  assert.throws(() => cleanLaptopIssue({ customerName: 'Test', phone: '123', issue: 'Test' }), /valid phone/);
  assert.throws(() => cleanLaptopIssue({ customerName: 'Test', phone: '---------', issue: 'Test' }), /valid phone/);
  assert.throws(() => cleanLaptopIssue({ customerName: 'Test', phone: '0241234567', issue: 'Test', email: 'invalid' }), /valid email/);
});

test('every Hack-this admin endpoint refuses unauthenticated access; invalid issues are rejected before storage', async () => {
  const app = express(); app.use(express.json()); app.use('/admin', createAdminHacksRouter()); app.use('/issues', createLaptopIssueRouter());
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number }; const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const [method, path] of [['GET', '/admin'], ['PUT', '/admin/themes/tips'], ['PUT', '/admin/posts/dns'], ['POST', '/admin/posts/dns/images']]) {
      const response = await fetch(base + path, { method }); assert.equal(response.status, 401, path);
    }
    const response = await fetch(base + '/issues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(response.status, 400);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('request limiter expires full buckets and preserves limits for existing callers', () => {
  let now = 0;
  const limited = createHacksLimiter(2, () => now);
  assert.equal(limited('a', 1), false);
  assert.equal(limited('a', 1), true);
  assert.equal(limited('b', 1), false);
  assert.equal(limited('c', 1), true);
  now = 60000;
  assert.equal(limited('c', 1), false);
  assert.equal(limited('c', 1), true);
  assert.equal(limited('a', 1), false);
});


test('guide copy text preserves exact whitespace and step links validate their label and HTTPS URL', () => {
  const copyText = '  example text\n    preserve indentation\n';
  const clean = cleanHackPost('dns', post({ operatingSystem: 'Windows', steps: [{ body: 'Copy this text.', copyText, actionLabel: ' Open tool ', actionUrl: ' https://example.com/tool ' }] }));
  assert.equal(clean.operatingSystem, 'Windows');
  assert.equal(clean.steps[0].copyText, copyText);
  assert.equal(clean.steps[0].actionLabel, 'Open tool');
  assert.equal(clean.steps[0].actionUrl, 'https://example.com/tool');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', '/local']) assert.throws(() => cleanHackPost('dns', post({ steps: [{ body: 'Go', actionLabel: 'Open', actionUrl: url }] })), /HTTPS/);
  for (const step of [{ body: 'Go', actionLabel: 'Open' }, { body: 'Go', actionUrl: 'https://example.com' }]) assert.throws(() => cleanHackPost('dns', post({ steps: [step] })), /label and URL/);
  assert.throws(() => cleanHackPost('dns', post({ steps: [{ body: 'Copy', copyText: 'x'.repeat(4001) }] })), /copy text/);
  assert.equal(cleanHackPost('dns', post({ steps: [{ body: 'No actions', copyText: '   ', actionLabel: '', actionUrl: '' }] })).steps[0].copyText, undefined);
});

test('OS filters include All and General defaults for legacy posts, and combine with other filters', () => {
  const posts = [post(), ...HACK_OPERATING_SYSTEMS.map(os => post({ postId: os, operatingSystem: os }))];
  const catalogue = { themes: [theme], posts };
  assert.equal(cleanHackPost('dns', post()).operatingSystem, 'General');
  assert.equal(publicHacks([theme], [post()]).posts[0].operatingSystem, 'General');
  assert.equal(filterHackPosts(catalogue, '', emptyHacksFilters()).length, 5);
  for (const os of HACK_OPERATING_SYSTEMS) assert.equal(filterHackPosts(catalogue, '', { ...emptyHacksFilters(), os }).length, os === 'General' ? 2 : 1);
  assert.equal(filterHackPosts(catalogue, 'connection', { ...emptyHacksFilters(), os: 'Windows', themeId: 'tips', links: 'with-links' }).length, 1);
  assert.throws(() => cleanHackPost('dns', post({ operatingSystem: 'Linux' as any })), /tutorial OS/);
});

test('search and tool filtering include the text and links inside steps', () => {
  const guide = post({ links: [], steps: [{ body: 'Follow along.', copyText: 'unique copied phrase', actionLabel: 'Launch editor', actionUrl: 'https://example.com/editor' }] });
  const catalogue = { themes: [theme], posts: [guide] };
  for (const query of ['copied phrase', 'Launch editor', 'example.com/editor']) {
    assert.equal(filterHackPosts(catalogue, query, emptyHacksFilters()).length, 1);
    assert.equal(hackMatchedStep(guide, query), 0);
  }
  assert.equal(hackLinkCount(guide), 1);
  assert.equal(filterHackPosts(catalogue, '', { ...emptyHacksFilters(), links: 'with-links' }).length, 1);
  assert.equal(filterHackPosts(catalogue, '', { ...emptyHacksFilters(), links: 'without-links' }).length, 0);
});

test('editing existing steps persists OS and actions without resetting image markers, views or creation time', async () => {
  const { db } = database(); const original = post();
  const updated = post({ operatingSystem: 'macOS', steps: [{ ...original.steps[0], copyText: 'exact text\n', actionLabel: 'Open settings help', actionUrl: 'https://example.com/settings' }] });
  const saved = await saveHackPost('dns', updated, db);
  assert.equal(saved.createdAt, original.createdAt); assert.equal(saved.views, original.views);
  assert.equal(saved.steps[0].copyText, 'exact text\n'); assert.equal(saved.operatingSystem, 'macOS');
  assert.deepEqual(saved.steps[0].images, original.steps[0].images);
  assert.equal((await getPublicHacks(db)).posts[0].steps[0].actionUrl, 'https://example.com/settings');
});
