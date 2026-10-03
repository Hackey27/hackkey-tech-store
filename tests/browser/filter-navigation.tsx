// Local-only fixture, served by Vite at /tests/browser/filter-navigation.html.
// The real App runs against fake catalogue APIs; no database or order writes.
// Test price Minimum/Maximum while viewport height changes and while filtering
// shortens a scrolled listing. Test product -> Back -> listing on both tabs.
// The report samples the first 30 paint frames after Back for any visible-nav
// flash. A real downward scroll should then reveal the bar after settling.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
import { variantLaptop } from '../fixtures/laptopVariants';
import type { CatalogueItem, PreorderProduct } from '../../shared/types';

const laptops: CatalogueItem[] = Array.from({ length: 18 }, (_, i) => ({
  kind: 'laptop', itemId: `LAPTOP-${i}`, name: `Test laptop ${i}`, categoryId: 'LAPTOP', categoryName: 'Laptops on sale', sortOrder: i, pricePesewas: (i + 1) * 100000,
  bannerImageUrl: '/landing-workspace.webp', screenshots: ['/landing-workspace.webp'],
  laptop: { ...variantLaptop(), laptopId: `LAPTOP-${i}`, title: `Test laptop ${i}`, model: `Test model ${i}` },
}));
const preorders: PreorderProduct[] = Array.from({ length: 18 }, (_, i) => ({
  productId: `PREORDER-${i}`, name: `Test preorder ${i}`, description: 'Test description', categoryId: 'TEST', details: [], galleryImagePaths: [], variantAxes: [], imageAssignments: [], deliveryOptions: ['express', 'two-months'], active: true,
  combinations: [{ combinationId: 'default', selections: {}, priceExpressPesewas: (i + 1) * 100000, priceTwoMonthsPesewas: (i + 1) * 90000 }],
}));
const paymentOptions = { mode: 'momo', paystackEnabled: false, momo: { merchantId: 'QA-ONLY', transferNumber: '0000000000', whatsappNumber: '0000000000' } };
const catalogue = { categories: [{ categoryId: 'LAPTOP', name: 'Laptops on sale' }], products: laptops, laptops: laptops.map(item => item.laptop), bundles: [], services: [], totalProducts: laptops.length, source: 'local fixture', timestamp: '', paymentOptions };
window.fetch = async input => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  const data = url === '/api/catalog' ? catalogue : url === '/api/payment-options' ? paymentOptions : url === '/api/preorder/catalogue' ? { categories: [{ categoryId: 'TEST', name: 'Test products', parentId: null }], products: preorders } : {};
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};
history.replaceState({}, '', '/laptops');
window.addEventListener('popstate', () => {
  let frames = 0, flashes = 0;
  const sample = () => {
    const nav = document.getElementById('mobile-bottom-nav');
    if (nav && getComputedStyle(nav).visibility !== 'hidden' && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().top < innerHeight) flashes++;
    if (++frames < 30) requestAnimationFrame(sample);
    else document.getElementById('regression-report')!.textContent = flashes ? `FAIL: ${flashes} visible nav frames after Back` : 'PASS: 0 visible nav frames after Back';
  };
  requestAnimationFrame(sample);
});
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
