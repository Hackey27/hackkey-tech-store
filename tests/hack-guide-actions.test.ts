import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HackStepActions } from '../src/components/HackStepActions';
import { HackGuideSupport, hackStoreExamples } from '../src/components/HackGuideSupport';
import { HackShareButton } from '../src/components/HackShareButton';
import { hackShareUrl, shareHackPost } from '../src/utils/hackSharing';
import { SECTION_TABS } from '../src/config/sections';
import type { CatalogueItem, PreorderProduct } from '../shared/types';

test('copy fields are text only and labelled step links preserve the guide in another tab', () => {
  const html = renderToStaticMarkup(React.createElement(HackStepActions, { step: { body: 'Test', copyText: '<script>text only</script>\n  spacing', actionLabel: 'Open tool', actionUrl: 'https://example.com/tool' } }));
  assert.match(html, /&lt;script&gt;text only&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, />Copy<\/button>/);
  assert.match(html, /href="https:\/\/example.com\/tool"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.equal(renderToStaticMarkup(React.createElement(HackStepActions, { step: { body: 'Legacy step' } })), '<div class="min-w-0 space-y-4"></div>');
});

test('closing guide support includes all other store sections with descriptions and a coming-soon technicians label', () => {
  const html = renderToStaticMarkup(React.createElement(HackGuideSupport));
  assert.match(html, /recommending Hack-Key Tech/);
  for (const tab of SECTION_TABS.filter(tab => tab.id !== 'hacks')) assert.ok(html.includes(`href="${tab.path}"`));
  assert.doesNotMatch(html, /href="\/hacks"/);
  assert.match(html, /statistical software, plagiarism checks and data analysis/);
  assert.match(html, /Tools and replacement parts/);
  assert.match(html, /For technicians.*Coming soon/);
});

test('store examples use distinct current catalogue names rather than repeating laptop variants', () => {
  const items = [
    { kind: 'product', name: 'SPSS' }, { kind: 'service', name: 'Turnitin' },
    { kind: 'laptop', name: 'HP one', laptop: { brand: 'HP', model: 'Envy' } },
    { kind: 'laptop', name: 'HP two', laptop: { brand: 'HP', model: 'Envy' } },
  ] as CatalogueItem[];
  const preorders = [{ name: 'Accessory', active: true }, { name: 'Hidden product', active: false }] as PreorderProduct[];
  assert.deepEqual(hackStoreExamples(items, preorders), { software: 'SPSS, Turnitin', laptops: 'HP Envy', preorder: 'Accessory' });
});

test('share icon provides a stable post URL, native sharing and a clipboard fallback without opening the post', async () => {
  const post = { postId: 'HACK-test', title: 'Connection guide' };
  const url = 'https://store.example/hacks/posts/HACK-test';
  assert.equal(hackShareUrl(post.postId, 'https://store.example'), url);
  const html = renderToStaticMarkup(React.createElement(HackShareButton, { post }));
  assert.match(html, /aria-label="Share Connection guide"/); assert.match(html, /lucide-share-2/);
  const shares: ShareData[] = []; const copies: string[] = [];
  assert.equal(await shareHackPost(post, 'https://store.example', { share: async data => { shares.push(data); }, clipboard: { writeText: async value => { copies.push(value); } } }), 'shared');
  assert.deepEqual(shares, [{ title: post.title, url }]); assert.equal(copies.length, 0);
  assert.equal(await shareHackPost(post, 'https://store.example', { clipboard: { writeText: async value => { copies.push(value); } } }), 'copied');
  assert.deepEqual(copies, [url]);
  assert.equal(await shareHackPost(post, 'https://store.example', { share: async () => { const error = new Error('Cancelled'); error.name = 'AbortError'; throw error; }, clipboard: { writeText: async value => { copies.push(value); } } }), 'cancelled');
  assert.deepEqual(copies, [url]);
  assert.equal(await shareHackPost(post, 'https://store.example', { share: async () => { throw new Error('Unsupported'); }, clipboard: { writeText: async value => { copies.push(value); } } }), 'copied');
  await assert.rejects(shareHackPost(post, 'https://store.example', {}), /Copy the post link/);
});
