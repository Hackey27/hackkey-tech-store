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
