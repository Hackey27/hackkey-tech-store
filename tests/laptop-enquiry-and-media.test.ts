import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from '@google-cloud/firestore';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { variantLaptop, variantSettings } from './fixtures/laptopVariants';
import { saveLaptop } from '../server/adminData';
import { laptopToCatalogueItems } from '../server/catalogue';
import { DEFAULT_PRICING_CONFIG } from '../server/pricingConfig';
import { laptopEnquiryDetails } from '../server/laptopEnquiry';
import { ProductCard } from '../src/components/ProductCard';
import { LaptopEnquiryConfirmation } from '../src/components/LaptopEnquiryConfirmation';
import { PaymentMethodPanel } from '../src/components/PaymentMethodPanel';

test('saving a stale laptop variant draft preserves new uploads and does not resurrect deleted media', async () => {
  const stale = variantLaptop();
  stale.bannerImagePath = 'catalogue/old-banner.png';
  stale.screenshots = ['catalogue/removed-gallery.png'];
  let stored = { ...variantLaptop(), bannerImagePath: 'catalogue/new-banner.png', mobileBannerImagePath: 'catalogue/mobile.png', cardImagePath: 'catalogue/card.png', imagePath: 'catalogue/icon.png', screenshots: ['catalogue/new-gallery.png'], picturesUrl: ['https://example.com/legacy.png'] };
  const db = { collection: () => ({ doc: () => ({}) }), runTransaction: async (fn: any) => fn({ get: async () => ({ exists: true, data: () => structuredClone(stored) }), set: (_ref: unknown, value: typeof stored) => { stored = structuredClone(value); } }) } as unknown as Firestore;
  stale.variantConfig!.rows[0].priceGhs = 1700;
  const saved = await saveLaptop(stale.laptopId, stale, db);
  assert.equal(stored.bannerImagePath, 'catalogue/new-banner.png');
  assert.equal(stored.mobileBannerImagePath, 'catalogue/mobile.png');
  assert.equal(stored.cardImagePath, 'catalogue/card.png');
  assert.equal(stored.imagePath, 'catalogue/icon.png');
  assert.deepEqual(stored.screenshots, ['catalogue/new-gallery.png']);
  assert.deepEqual(stored.picturesUrl, ['https://example.com/legacy.png']);
  assert.equal(saved.variantConfig!.rows[0].priceGhs, 1700);
  delete stored.bannerImagePath;
  stored.screenshots = [];
  const again = await saveLaptop(stale.laptopId, stale, db);
  assert.equal(again.bannerImagePath, undefined);
  assert.deepEqual(again.screenshots, []);
  assert.ok(laptopToCatalogueItems(saved, DEFAULT_PRICING_CONFIG).every(item => item.screenshots?.includes('/api/catalog/images?path=catalogue%2Fnew-gallery.png')));
});

test('laptop card headings omit variant specs and preorder cards show only configured delivery prices', () => {
  const laptop = variantLaptop('Pre-order');
  laptop.preorderDeliveryOptions = ['two-months'];
  laptop.screenshots = ['catalogue/gallery.png'];
  const item = laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG, variantSettings())[0];
  const html = renderToStaticMarkup(React.createElement(ProductCard, { product: item, onSelect: () => {}, onBuyNowClick: () => {} }));
  assert.match(html, /<h3[^>]*>HP Envy 14<\/h3>/);
  assert.doesNotMatch(html, /Starts at|starts at|2-3 weeks/);
  assert.match(html, /6-8 Weeks/);
  assert.match(html, /Delivery time/);
  assert.ok(html.indexOf('Delivery time') < html.indexOf('<b>CPU</b>'));
  assert.match(html, /gallery\.png/);
});

test('enquiry quotes use the current server-selected variant and delivery price and preserve the quote snapshot', () => {
  const laptop = variantLaptop('Pre-order'), settings = variantSettings();
  const item = laptopToCatalogueItems(laptop, DEFAULT_PRICING_CONFIG, settings)[1];
  const details = laptopEnquiryDetails(laptop, 'intel-16', 'two-months', settings, DEFAULT_PRICING_CONFIG);
  assert.equal(details.pricePesewas, item.preorderPricesPesewas!['two-months']);
  assert.equal(details.variantRowId, 'intel-16');
  assert.equal(details.delivery, 'two-months');
  settings.exchangeRate = 9;
  assert.notEqual(laptopEnquiryDetails(laptop, 'intel-16', 'two-months', settings, DEFAULT_PRICING_CONFIG).pricePesewas, details.pricePesewas);
  laptop.preorderDeliveryOptions = ['express'];
  assert.throws(() => laptopEnquiryDetails(laptop, 'intel-16', 'two-months', settings, DEFAULT_PRICING_CONFIG), /valid price/);
  const available = variantLaptop(); available.variantsEnabled = false;
  assert.equal(laptopEnquiryDetails(available, '', 'express', settings, DEFAULT_PRICING_CONFIG).pricePesewas, 77700);
});

test('successful enquiries offer payment and contact using the enquiry reference; saved MoMo details do not imply a paid order', () => {
  const options = { mode: 'momo' as const, momo: { merchantId: 'TEST-MERCHANT', merchantName: 'Test store', transferNumber: '0550000000', transferName: 'Test name', whatsappNumber: '0551111111' } };
  const html = renderToStaticMarkup(React.createElement(LaptopEnquiryConfirmation, { reference: 'REQ-test', pricePesewas: 150000, paymentOptions: options }));
  assert.match(html, /Pay now/); assert.match(html, /Contact Hack-Key Tech/);
  assert.match(html, /wa\.me\/233551111111/);
  assert.doesNotMatch(html, /TEST-MERCHANT/);
  const payment = renderToStaticMarkup(React.createElement(PaymentMethodPanel, { options, orderIds: [], reference: 'REQ-test', referenceLabel: 'Enquiry reference', intro: 'Pay against your enquiry reference.' }));
  assert.match(payment, /TEST-MERCHANT/); assert.match(payment, /0550000000/);
  assert.match(payment, /REQ-test/); assert.doesNotMatch(payment, /Order reference|₵0/);
});
