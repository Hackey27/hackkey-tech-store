import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import type { CatalogueItemKind } from '../types';
import { renderableProductImageUrl } from './ProductImage';

interface ProductGalleryProps {
  images: string[];
  productName: string;
  kind: CatalogueItemKind;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, kind }) => {
  const [active, setActive] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);
  const validImages = images.map(renderableProductImageUrl).filter((value): value is string => Boolean(value));

  const move = (direction: number) => {
    setActive((current) => {
      if (current == null) return current;
      return (current + direction + validImages.length) % validImages.length;
    });
  };

  useEffect(() => {
    if (active == null) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null);
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowLeft') move(-1);
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [active, validImages.length]);

  if (!validImages.length) return null;

  return (
    <section aria-labelledby="product-gallery-title" className="space-y-4">
      <div>
        <h2 id="product-gallery-title" className="text-xl font-black text-[#014040]">
          {kind === 'laptop' ? 'Laptop image gallery' : kind === 'service' ? 'Service gallery' : kind === 'bundle' ? 'Bundle gallery' : 'Software gallery'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">Images of {productName}.</p>
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {validImages.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            className="aspect-[4/3] overflow-hidden rounded-2xl border border-[#d8e7e4] bg-[#edf5f3] focus:outline-none focus:ring-2 focus:ring-[#014040]"
            aria-label={STORE_COPY.gallery.openImage(index + 1)}
          >
            <img
              src={image}
              alt={STORE_COPY.gallery.imageAlt(productName, index + 1)}
              width="640"
              height="480"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
            />
          </button>
        ))}
      </div>

      {active != null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#001f1f]/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={STORE_COPY.gallery.lightboxLabel}
          onClick={() => setActive(null)}
          onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            if (touchStart.current == null) return;
            const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
            if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
            touchStart.current = null;
          }}
        >
          <button type="button" onClick={() => setActive(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.close}>
            <X className="h-5 w-5" />
          </button>
          {validImages.length > 1 && (
            <button type="button" onClick={(event) => { event.stopPropagation(); move(-1); }} className="absolute left-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.previous}>
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <img
            src={validImages[active]}
            alt={STORE_COPY.gallery.imageAlt(productName, active + 1)}
            width="1400"
            height="1050"
            className="max-h-[88vh] max-w-[88vw] rounded-2xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          {validImages.length > 1 && (
            <button type="button" onClick={(event) => { event.stopPropagation(); move(1); }} className="absolute right-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.next}>
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </section>
  );
};
