// Serve with `npx vite --host 127.0.0.1 --port 3002`, then open
// /tests/browser/laptop-gallery.html. Run at phone and desktop viewport sizes.
// No API calls or production data: the real detail, gallery, reveal CSS and
// Back handling must work while the gallery rail is still below the fold.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductDetailView } from '../../src/components/ProductDetailView';
import { useScrollReveal } from '../../src/utils/useScrollReveal';
import '../../src/index.css';
import type { CatalogueItem } from '../../shared/types';

const item: CatalogueItem = {
  kind: 'laptop', itemId: 'GALLERY-TEST', name: 'Gallery test laptop', categoryId: 'LAPTOP', sortOrder: 0, pricePesewas: 120000,
  bannerImageUrl: '/landing-workspace.webp', mobileBannerImageUrl: '/landing-workspace-mobile.webp',
  screenshots: ['/landing-workspace.webp', '/landing-workspace-mobile.webp'],
  description: 'Laptop details. '.repeat(200),
  laptop: { laptopId: 'GALLERY-TEST', title: 'Gallery test laptop', categoryId: 'LAPTOP', active: true, sortOrder: 0, picturesUrl: [], brand: 'Test', model: 'Laptop', processor: 'Intel Core i7', ram: '16GB', storage: '512GB SSD', availability: 'Available', screen: '14 inch', operatingSystem: 'Windows', colour: 'Silver', graphics: 'Integrated', ports: 'USB-C' },
};
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

function Regression() {
  useScrollReveal();
  const [status, setStatus] = useState('Ready. Tap the banner or run the regression.');
  async function run() {
    setStatus('Running…');
    try {
      history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
      await pause(400);
      const rail = document.querySelector('[aria-labelledby="product-gallery-title"]')!;
      assert(rail.getBoundingClientRect().top > innerHeight, 'Fixture must keep the gallery below the fold.');
      const banner = document.querySelector<HTMLElement>('[aria-label="Open image gallery for Gallery test laptop"]')!;
      for (const y of [0, 120]) {
        window.scrollTo(0, y);
        const before = scrollY;
        banner.click();
        await pause(400);
        const viewer = document.querySelector<HTMLElement>('.hk-gallery-lightbox');
        assert(!!viewer, 'Banner did not mount the gallery.');
        const bounds = viewer!.getBoundingClientRect();
        assert(Math.abs(bounds.top) < 1 && Math.abs(bounds.left) < 1 && Math.abs(bounds.height - innerHeight) < 1 && Math.abs(bounds.width - innerWidth) < 1, `Gallery does not cover the viewport: top ${bounds.top}, height ${bounds.height}.`);
        for (let ancestor: HTMLElement | null = viewer; ancestor; ancestor = ancestor.parentElement) {
          assert(Number(getComputedStyle(ancestor).opacity) > 0.99, 'Gallery is hidden by an ancestor’s opacity.');
        }
        assert(document.elementFromPoint(innerWidth - 36, 36)?.closest('[aria-label="Close gallery"]') != null, 'Gallery close button cannot receive taps above page content.');
        const image = viewer!.querySelector<HTMLImageElement>('img')!;
        assert(image.complete && image.naturalWidth > 0, 'Gallery image failed to load.');
        viewer!.querySelector<HTMLButtonElement>('[aria-label="Next image"]')!.click();
        await pause(400);
        assert(viewer!.textContent?.includes('2 / 2') === true, 'Gallery next-image control failed.');
        history.back();
        await pause(150);
        assert(!document.querySelector('.hk-gallery-lightbox'), 'Back did not close the gallery.');
        assert(Math.abs(scrollY - before) < 1, 'Back changed the detail scroll position.');
      }
      banner.click();
      await pause(300);
      document.querySelector<HTMLButtonElement>('[aria-label="Close gallery"]')!.click();
      await pause(150);
      assert(!document.querySelector('.hk-gallery-lightbox'), 'Close button did not dismiss the gallery.');
      setStatus('PASS: banner opens visible viewport gallery; images navigate; Back restores scroll; X closes; reopen works.');
    } catch (error) {
      setStatus(`FAIL: ${error instanceof Error ? error.message : error}`);
      document.querySelector<HTMLButtonElement>('[aria-label="Close gallery"]')?.click();
    }
  }
  return <><header className="sticky top-0 z-50 bg-white p-3 shadow"><button className="rounded bg-[#014040] px-3 py-2 text-white" onClick={run}>Run gallery regression</button><p role="status" className="mt-2 text-xs">{status}</p></header><main><ProductDetailView product={item} onClose={() => setStatus('Detail Back clicked')} onCompare={() => {}} /></main></>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Regression /></React.StrictMode>);
