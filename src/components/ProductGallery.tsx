import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import type { CatalogueItemKind } from '../types';
import { renderableProductImageUrl } from './ProductImage';

interface ProductGalleryProps {
  images: string[];
  productName: string;
  kind: CatalogueItemKind;
  /** Increment to open the lightbox from another control, such as a laptop banner. */
  openRequest?: number;
}

const SWIPE_THRESHOLD = 55;
const SWIPE_DURATION_MS = 280;

function wrappedIndex(index: number, length: number): number {
  return (index + length) % length;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, kind, openRequest = 0 }) => {
  const [active, setActive] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [dragOffset, setDragOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; at: number } | null>(null);
  const dragged = useRef(false);
  const transitionTimer = useRef<number | undefined>(undefined);
  const previousOpenRequest = useRef(openRequest);
  const validImages = images.map(renderableProductImageUrl).filter((value): value is string => Boolean(value)).filter((value) => !failed.has(value));

  useEffect(() => setFailed(new Set()), [images]);

  useEffect(() => {
    if (openRequest !== previousOpenRequest.current && openRequest > 0 && validImages.length) setActive(0);
    previousOpenRequest.current = openRequest;
  }, [openRequest, validImages.length]);

  useEffect(() => {
    if (active == null) return;
    if (!validImages.length) setActive(null);
    else if (active >= validImages.length) setActive(validImages.length - 1);
  }, [active, validImages.length]);

  useEffect(() => {
    if (active == null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [active]);

  const finishTransition = (direction: number) => {
    window.clearTimeout(transitionTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      if (direction) setActive((current) => current == null ? current : wrappedIndex(current + direction, validImages.length));
      setAnimating(false);
      setDragOffset(0);
    }, SWIPE_DURATION_MS);
  };

  const slide = (direction: number) => {
    if (active == null || validImages.length < 2 || animating) return;
    const width = lightboxRef.current?.clientWidth || window.innerWidth;
    setAnimating(true);
    setDragOffset(direction > 0 ? -width : width);
    finishTransition(direction);
  };

  const close = () => {
    window.clearTimeout(transitionTimer.current);
    pointerStart.current = null;
    setAnimating(false);
    setDragOffset(0);
    setActive(null);
  };

  useEffect(() => {
    if (active == null) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') slide(1);
      if (event.key === 'ArrowLeft') slide(-1);
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [active, animating, validImages.length]);

  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  if (!validImages.length) return null;

  const activeIndex = active ?? 0;
  const visibleIndexes = validImages.length === 1
    ? [activeIndex]
    : [wrappedIndex(activeIndex - 1, validImages.length), activeIndex, wrappedIndex(activeIndex + 1, validImages.length)];
  const imageAlt = (index: number) => `${kind === 'product' ? `${productName} installation` : productName} image ${index + 1}`;

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
          <button
            key={`${image}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            className="aspect-[4/3] w-[82vw] max-w-sm shrink-0 snap-center overflow-hidden rounded-2xl border border-[#d8e7e4] bg-[#edf5f3] focus:outline-none focus:ring-2 focus:ring-[#014040] sm:w-80"
            aria-label={STORE_COPY.gallery.openImage(index + 1)}
          >
            <img
              src={image}
              alt={imageAlt(index)}
              width="640"
              height="480"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100"
              onError={() => setFailed((old) => new Set(old).add(image))}
            />
          </button>
        ))}
      </div>

      {active != null && (
        <div
          ref={lightboxRef}
          className="hk-gallery-lightbox fixed inset-0 z-[80] overflow-hidden bg-[#001f1f]/95"
          role="dialog"
          aria-modal="true"
          aria-label={STORE_COPY.gallery.lightboxLabel}
          onClick={(event) => {
            if (event.target === event.currentTarget && !dragged.current) close();
            dragged.current = false;
          }}
          onPointerDown={(event) => {
            if (animating || validImages.length < 2 || event.button !== 0) return;
            pointerStart.current = { x: event.clientX, at: performance.now() };
            dragged.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!pointerStart.current || animating) return;
            const distance = event.clientX - pointerStart.current.x;
            dragged.current = dragged.current || Math.abs(distance) > 6;
            const width = lightboxRef.current?.clientWidth || window.innerWidth;
            setDragOffset(Math.max(-width, Math.min(width, distance)));
          }}
          onPointerUp={(event) => {
            if (!pointerStart.current || animating) return;
            const distance = event.clientX - pointerStart.current.x;
            const elapsed = Math.max(1, performance.now() - pointerStart.current.at);
            pointerStart.current = null;
            const fastSwipe = Math.abs(distance) / elapsed > 0.45 && Math.abs(distance) > 20;
            const direction = Math.abs(distance) >= SWIPE_THRESHOLD || fastSwipe ? (distance < 0 ? 1 : -1) : 0;
            setAnimating(true);
            if (direction) {
              const width = lightboxRef.current?.clientWidth || window.innerWidth;
              setDragOffset(direction > 0 ? -width : width);
            } else setDragOffset(0);
            finishTransition(direction);
          }}
          onPointerCancel={() => {
            pointerStart.current = null;
            setAnimating(true);
            setDragOffset(0);
            finishTransition(0);
          }}
          style={{ touchAction: 'none' }}
        >
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={close} className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.close}>
            <X className="h-5 w-5" />
          </button>
          {validImages.length > 1 && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); slide(-1); }} className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.previous}><ChevronLeft className="h-6 w-6" /></button>}

          <div
            className={`flex h-full w-full ${animating ? 'transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]' : ''}`}
            style={{ transform: validImages.length === 1 ? 'translate3d(0,0,0)' : `translate3d(calc(-100% + ${dragOffset}px),0,0)` }}
          >
            {visibleIndexes.map((index, position) => <div key={`${activeIndex}-${index}-${position}`} className="flex h-full w-full shrink-0 items-center justify-center p-4 sm:p-10"><img src={validImages[index]} alt={imageAlt(index)} width="1400" height="1050" draggable={false} className="max-h-full max-w-full select-none rounded-2xl object-contain shadow-2xl" onClick={(event) => { event.stopPropagation(); if (!dragged.current) close(); dragged.current = false; }} /></div>)}
          </div>

          {validImages.length > 1 && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); slide(1); }} className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.next}><ChevronRight className="h-6 w-6" /></button>}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 text-center text-xs font-bold text-white/80">{active + 1} / {validImages.length}</div>
        </div>
      )}
    </section>
  );
};
