import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import type { CatalogueItemKind } from '../../shared/types';
import { renderableProductImageUrl } from './ProductImage';
import { ImageLightbox } from './ImageLightbox';

interface ProductGalleryProps {
  images: string[];
  productName: string;
  kind: CatalogueItemKind;
  /** Increment to open the lightbox from another control, such as a laptop banner. */
  openRequest?: number;
}

/**
 * The catalogue's image rail, plus the shared viewer.
 *
 * The viewing behaviour lives in ImageLightbox, which the pre-order product
 * page opens too. What stays here is this gallery's own presentation: a
 * horizontal snap rail with its heading and scroll buttons.
 */
export const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, kind, openRequest = 0 }) => {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const railRef = useRef<HTMLDivElement>(null);
  const previousOpenRequest = useRef(openRequest);
  const validImages = images
    .map(renderableProductImageUrl)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !failed.has(value));

  useEffect(() => setFailed(new Set()), [images]);

  useEffect(() => {
    if (openRequest !== previousOpenRequest.current && openRequest > 0 && validImages.length) setOpenAt(0);
    previousOpenRequest.current = openRequest;
  }, [openRequest, validImages.length]);

  if (!validImages.length) return null;

  const imageAlt = (index: number) =>
    `${kind === 'product' ? `${productName} installation` : productName} image ${index + 1}`;

  return (
    <section aria-labelledby="product-gallery-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div><h2 id="product-gallery-title" className="text-xl font-black text-[#014040]">
          {kind === 'product' ? 'Successful installations' : 'Image Gallery'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{kind === 'product' ? 'These images are installations completed for a sample of other clients.' : kind === 'laptop' ? 'Images of the laptop' : `Images of ${productName}.`}</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => railRef.current?.scrollBy({ left: -320, behavior: 'smooth' })} className="rounded-full border bg-white p-2 text-[#014040]" aria-label={STORE_COPY.gallery.previous}><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => railRef.current?.scrollBy({ left: 320, behavior: 'smooth' })} className="rounded-full border bg-white p-2 text-[#014040]" aria-label={STORE_COPY.gallery.next}><ChevronRight className="h-5 w-5" /></button></div>
      </div>
      <div ref={railRef} className="flex snap-x snap-mandatory scroll-smooth gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
        {validImages.map((image, index) => (
          <button key={`${image}-${index}`} type="button" onClick={() => setOpenAt(index)} className="aspect-[4/3] w-[82vw] max-w-sm shrink-0 snap-center overflow-hidden rounded-2xl border border-[#d8e7e4] bg-[#edf5f3] focus:outline-none focus:ring-2 focus:ring-[#014040] sm:w-80" aria-label={STORE_COPY.gallery.openImage(index + 1)}>
            <img src={image} alt={imageAlt(index)} width="640" height="480" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100" onError={() => setFailed((old) => new Set(old).add(image))} />
          </button>
        ))}
      </div>

      <ImageLightbox
        images={validImages}
        openAt={openAt}
        onClose={() => setOpenAt(null)}
        alt={imageAlt}
      />
    </section>
  );
};
