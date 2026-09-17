import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productInitials, renderableProductImageUrl } from '../src/components/ProductImage';
import {
  catalogueImageObjectPath,
  isCatalogueImagePath,
  MAX_CATALOGUE_IMAGE_BYTES,
  validateCatalogueImage
} from '../server/storage';

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

test('fallback initials are deterministic for the same product name', () => {
  assert.equal(productInitials('IBM SPSS'), 'IS');
  assert.equal(productInitials('AMOS'), 'AM');
  assert.equal(productInitials(''), 'HK');
});

test('catalogue uploads accept resized web images and reject unsafe input', () => {
  assert.equal(validateCatalogueImage('image/webp', 250_000).ok, true);
  assert.equal(validateCatalogueImage('application/pdf', 250_000).ok, false);
  assert.equal(validateCatalogueImage('image/jpeg', MAX_CATALOGUE_IMAGE_BYTES + 1).ok, false);
});

test('catalogue image paths stay inside their dedicated product prefix', () => {
  const path = catalogueImageObjectPath('AMOS', 'gallery', 'image/webp');
  assert.match(path, /^catalogue\/AMOS\/gallery\/.+\.webp$/);
  assert.equal(isCatalogueImagePath(path), true);
  assert.equal(isCatalogueImagePath('orders/ORDER-1/document.pdf'), false);
  assert.equal(isCatalogueImagePath('catalogue/../orders/document.pdf'), false);
});
