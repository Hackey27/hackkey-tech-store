import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productInitials, renderableProductImageUrl } from '../src/components/ProductImage';
import {
  catalogueImageObjectPath,
  isCatalogueImagePath,
  MAX_CATALOGUE_IMAGE_BYTES,
  validateCatalogueImage
} from '../server/storage';
import { searchCatalogue } from '../src/utils/catalogueSearch';
import type { CatalogueItem } from '../src/types';
import { renderProductSocialPreview } from '../server/socialPreview';

test('Google Drive share links become renderable image URLs', () => {
  assert.equal(
    renderableProductImageUrl('https://drive.google.com/file/d/abc123/view?usp=drive_link'),
    'https://drive.google.com/thumbnail?id=abc123&sz=w512'
  );
  assert.equal(
    renderableProductImageUrl('https://example.com/icon.png'),
    'https://example.com/icon.png'
  );
});

test('Google Photos share pages are not rendered as broken catalogue images', () => {
  assert.equal(renderableProductImageUrl('https://photos.app.goo.gl/example-share'), undefined);
});

test('fallback initials are deterministic for the same product name', () => {
  assert.equal(productInitials('IBM SPSS'), 'IS');
  assert.equal(productInitials('AMOS'), 'AM');
  assert.equal(productInitials(''), 'HK');
});

test('catalogue uploads accept resized web images and reject unsafe input', () => {
  assert.equal(validateCatalogueImage('image/webp', 250_000).ok, true);
  assert.equal(validateCatalogueImage('image/gif', 250_000).ok, true);
  assert.equal(validateCatalogueImage('application/pdf', 250_000).ok, false);
  assert.equal(validateCatalogueImage('image/jpeg', MAX_CATALOGUE_IMAGE_BYTES + 1).ok, false);
});

test('catalogue image paths stay inside their dedicated product prefix', () => {
  const path = catalogueImageObjectPath('AMOS', 'gallery', 'image/webp');
  assert.match(path, /^catalogue\/AMOS\/gallery\/.+\.webp$/);
  assert.match(catalogueImageObjectPath('category-DATA', 'icon', 'image/gif'), /^catalogue\/category-DATA\/icon\/.+\.gif$/);
  assert.equal(isCatalogueImagePath(path), true);
  assert.equal(isCatalogueImagePath('orders/ORDER-1/document.pdf'), false);
  assert.equal(isCatalogueImagePath('catalogue/../orders/document.pdf'), false);
});

test('catalogue search matches version, operating system and laptop specifications locally', () => {
  const items = [
    {
      kind: 'product', itemId: 'SPSS', name: 'IBM SPSS', categoryId: 'DATA', sortOrder: 1,
      variants: [{ variantId: 'SPSS-31-MAC', versionOrPlan: '31', os: 'macOS', available: true }]
    },
    {
      kind: 'laptop', itemId: 'LAP-1', name: 'EliteBook', categoryId: 'LAPTOP', sortOrder: 2,
      laptop: { brand: 'HP', model: '840 G8', processor: 'Core i7', ram: '16 GB', storage: '512 GB SSD' }
    }
  ] as CatalogueItem[];
  assert.deepEqual(searchCatalogue(items, 'spss mac'), [items[0]]);
  assert.deepEqual(searchCatalogue(items, '840 16 gb'), [items[1]]);
  assert.deepEqual(searchCatalogue(items, 'missing'), []);
});

test('shared product pages expose an absolute banner preview to social crawlers', () => {
  const template = '<html><head><title>Store</title><meta name="description" content="Store" /><meta property="og:title" content="Store" /><meta property="og:description" content="Store" /></head><body></body></html>';
  const item = {
    kind: 'service', itemId: 'Similarity & AI', name: 'Similarity & AI Check', categoryId: 'SERVICES', sortOrder: 1,
    description: 'Check your document before submission.',
    bannerImageUrl: '/api/catalog/images?path=catalogue%2FTURNITIN%2Fbanner.webp'
  } as CatalogueItem;
  const html = renderProductSocialPreview(template, item, 'https://store.hackeytech.com/');

  assert.match(html, /<title>Similarity &amp; AI Check \| Hack-Key Tech Store<\/title>/);
  assert.match(html, /property="og:image" content="https:\/\/store\.hackeytech\.com\/api\/catalog\/images\?path=catalogue%2FTURNITIN%2Fbanner\.webp"/);
  assert.match(html, /property="og:url" content="https:\/\/store\.hackeytech\.com\/product\/Similarity%20%26%20AI"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test('shared product metadata escapes catalogue text and falls back to store artwork', () => {
  const template = '<head><title>Store</title><meta name="description" content="Store" /><meta property="og:title" content="Store" /><meta property="og:description" content="Store" /></head>';
  const item = {
    kind: 'product', itemId: 'SAFE', name: '<Safe & Sound>', categoryId: 'SOFTWARE', sortOrder: 1,
    description: 'Install "safely" & quickly.'
  } as CatalogueItem;
  const html = renderProductSocialPreview(template, item, 'https://store.hackeytech.com');

  assert.doesNotMatch(html, /<title><Safe/);
  assert.match(html, /&lt;Safe &amp; Sound&gt;/);
  assert.match(html, /content="Install &quot;safely&quot; &amp; quickly\."/);
  assert.match(html, /og:image" content="https:\/\/store\.hackeytech\.com\/landing-workspace\.webp"/);
});

test('shared product metadata converts legacy Google Drive banners into image previews', () => {
  const template = '<head><title>Store</title><meta name="description" content="Store" /><meta property="og:title" content="Store" /><meta property="og:description" content="Store" /></head>';
  const item = {
    kind: 'laptop', itemId: 'LAPTOP', name: 'Laptop', categoryId: 'LAPTOPS', sortOrder: 1,
    bannerImageUrl: 'https://drive.google.com/file/d/banner123/view?usp=sharing'
  } as CatalogueItem;
  const html = renderProductSocialPreview(template, item, 'https://store.hackeytech.com');
  assert.match(html, /og:image" content="https:\/\/drive\.google\.com\/thumbnail\?id=banner123&amp;sz=w1200"/);
});
