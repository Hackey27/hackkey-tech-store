import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
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

interface ViewportTransform {
  zoom: number;
  x: number;
  y: number;
}

const SWIPE_THRESHOLD = 55;
const SWIPE_DURATION_MS = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function wrappedIndex(index: number, length: number): number {
  return (index + length) % length;
}

function pointerDistance(points: Array<{ x: number; y: number }>): number {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ images, productName, kind, openRequest = 0 }) => {
  const [active, setActive] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [dragOffset, setDragOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [viewportTransform, setViewportTransform] = useState<ViewportTransform>({ zoom: 1, x: 0, y: 0 });
  const railRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; at: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const transitionTimer = useRef<number | undefined>(undefined);
  const wheelEndTimer = useRef<number | undefined>(undefined);
  const gestureEndTimer = useRef<number | undefined>(undefined);
  const animationFrame = useRef<number | undefined>(undefined);
  const dragOffsetRef = useRef(0);
  const animatingRef = useRef(false);
  const transformRef = useRef<ViewportTransform>({ zoom: 1, x: 0, y: 0 });
  const pendingTransform = useRef<ViewportTransform>({ zoom: 1, x: 0, y: 0 });
  const previousOpenRequest = useRef(openRequest);
  const validImages = images.map(renderableProductImageUrl).filter((value): value is string => Boolean(value)).filter((value) => !failed.has(value));

  const renderDragOffset = (value: number) => {
    dragOffsetRef.current = value;
    if (animationFrame.current != null) return;
    animationFrame.current = window.requestAnimationFrame(() => {
      setDragOffset(dragOffsetRef.current);
      setViewportTransform({ ...pendingTransform.current });
      animationFrame.current = undefined;
    });
  };

  const renderTransform = (next: ViewportTransform) => {
    transformRef.current = next;
    pendingTransform.current = next;
    renderDragOffset(dragOffsetRef.current);
  };

  const boundedPan = (x: number, y: number, zoom = transformRef.current.zoom) => {
    const width = lightboxRef.current?.clientWidth || window.innerWidth;
    const height = lightboxRef.current?.clientHeight || window.innerHeight;
    const maxX = Math.max(0, width * (zoom - 1) / 2);
    const maxY = Math.max(0, height * (zoom - 1) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const applyZoom = (value: number) => {
    const zoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    const pan = zoom === MIN_ZOOM ? { x: 0, y: 0 } : boundedPan(transformRef.current.x, transformRef.current.y, zoom);
    renderTransform({ zoom, ...pan });
  };

  const resetViewport = () => {
    const reset = { zoom: 1, x: 0, y: 0 };
    transformRef.current = reset;
    pendingTransform.current = reset;
    setViewportTransform(reset);
  };

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
    resetViewport();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [active]);

  const finishTransition = (direction: number) => {
    window.clearTimeout(transitionTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      if (direction) setActive((current) => current == null ? current : wrappedIndex(current + direction, validImages.length));
      animatingRef.current = false;
      dragOffsetRef.current = 0;
      setAnimating(false);
      setDragOffset(0);
    }, SWIPE_DURATION_MS);
  };

  const slide = (direction: number) => {
    if (active == null || validImages.length < 2 || animatingRef.current) return;
    const width = lightboxRef.current?.clientWidth || window.innerWidth;
    animatingRef.current = true;
    setAnimating(true);
    renderDragOffset(direction > 0 ? -width : width);
    finishTransition(direction);
  };

  const settleSwipe = () => {
    if (animatingRef.current) return;
    const distance = dragOffsetRef.current;
    const direction = Math.abs(distance) >= SWIPE_THRESHOLD ? (distance < 0 ? 1 : -1) : 0;
    animatingRef.current = true;
    setAnimating(true);
    if (direction) {
      const width = lightboxRef.current?.clientWidth || window.innerWidth;
      renderDragOffset(direction > 0 ? -width : width);
    } else renderDragOffset(0);
    finishTransition(direction);
  };

  const close = () => {
    window.clearTimeout(transitionTimer.current);
    window.clearTimeout(wheelEndTimer.current);
    window.clearTimeout(gestureEndTimer.current);
    pointerStart.current = null;
    panStart.current = null;
    pinchStart.current = null;
    pointers.current.clear();
    animatingRef.current = false;
    dragOffsetRef.current = 0;
    setAnimating(false);
    setGestureActive(false);
    setDragOffset(0);
    resetViewport();
    setActive(null);
  };

  useEffect(() => {
    if (active == null) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight' && transformRef.current.zoom === MIN_ZOOM) slide(1);
      if (event.key === 'ArrowLeft' && transformRef.current.zoom === MIN_ZOOM) slide(-1);
      if (event.key === '+' || event.key === '=') applyZoom(transformRef.current.zoom + 0.25);
      if (event.key === '-') applyZoom(transformRef.current.zoom - 0.25);
      if (event.key === '0') resetViewport();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [active, validImages.length]);

  useEffect(() => {
    if (active == null || !lightboxRef.current) return;
    const element = lightboxRef.current;
    const endGestureSoon = () => {
      window.clearTimeout(gestureEndTimer.current);
      gestureEndTimer.current = window.setTimeout(() => setGestureActive(false), 100);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        setGestureActive(true);
        applyZoom(transformRef.current.zoom * Math.exp(-event.deltaY * 0.012));
        endGestureSoon();
        return;
      }

      if (transformRef.current.zoom > MIN_ZOOM) {
        event.preventDefault();
        setGestureActive(true);
        const pan = boundedPan(transformRef.current.x - event.deltaX, transformRef.current.y - event.deltaY);
        renderTransform({ ...transformRef.current, ...pan });
        endGestureSoon();
        return;
      }

      if (validImages.length < 2 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 0.7 || animatingRef.current) return;
      event.preventDefault();
      dragged.current = true;
      setGestureActive(true);
      const width = lightboxRef.current?.clientWidth || window.innerWidth;
      renderDragOffset(clamp(dragOffsetRef.current - event.deltaX, -width, width));
      window.clearTimeout(wheelEndTimer.current);
      wheelEndTimer.current = window.setTimeout(() => { settleSwipe(); endGestureSoon(); }, 90);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [active, validImages.length]);

  useEffect(() => () => {
    window.clearTimeout(transitionTimer.current);
    window.clearTimeout(wheelEndTimer.current);
    window.clearTimeout(gestureEndTimer.current);
    if (animationFrame.current != null) window.cancelAnimationFrame(animationFrame.current);
  }, []);

  if (!validImages.length) return null;

  const activeIndex = active ?? 0;
  const visibleIndexes = validImages.length === 1
    ? [activeIndex]
    : [wrappedIndex(activeIndex - 1, validImages.length), activeIndex, wrappedIndex(activeIndex + 1, validImages.length)];
  const currentPosition = validImages.length === 1 ? 0 : 1;
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
          <button key={`${image}-${index}`} type="button" onClick={() => setActive(index)} className="aspect-[4/3] w-[82vw] max-w-sm shrink-0 snap-center overflow-hidden rounded-2xl border border-[#d8e7e4] bg-[#edf5f3] focus:outline-none focus:ring-2 focus:ring-[#014040] sm:w-80" aria-label={STORE_COPY.gallery.openImage(index + 1)}>
            <img src={image} alt={imageAlt(index)} width="640" height="480" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100" onError={() => setFailed((old) => new Set(old).add(image))} />
          </button>
        ))}
      </div>

      {active != null && (
        <div
          ref={lightboxRef}
          className="hk-gallery-lightbox fixed inset-0 z-[80] overflow-hidden overscroll-none bg-[#001f1f]/95"
          role="dialog"
          aria-modal="true"
          aria-label={STORE_COPY.gallery.lightboxLabel}
          onClick={(event) => {
            if (event.target === event.currentTarget && !dragged.current) close();
            dragged.current = false;
          }}
          onPointerDown={(event) => {
            if (animatingRef.current || event.button !== 0) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            event.currentTarget.setPointerCapture(event.pointerId);
            dragged.current = false;
            setGestureActive(true);
            if (pointers.current.size >= 2) {
              const points = [...pointers.current.values()].slice(0, 2);
              pinchStart.current = { distance: pointerDistance(points), zoom: transformRef.current.zoom };
              pointerStart.current = null;
              panStart.current = null;
              dragged.current = true;
            } else if (transformRef.current.zoom > MIN_ZOOM) {
              panStart.current = { x: event.clientX, y: event.clientY, panX: transformRef.current.x, panY: transformRef.current.y };
            } else if (validImages.length > 1) pointerStart.current = { x: event.clientX, at: performance.now() };
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId) || animatingRef.current) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.current.size >= 2 && pinchStart.current) {
              const points = [...pointers.current.values()].slice(0, 2);
              const distance = pointerDistance(points);
              dragged.current = true;
              applyZoom(pinchStart.current.zoom * distance / Math.max(1, pinchStart.current.distance));
              return;
            }
            if (transformRef.current.zoom > MIN_ZOOM && panStart.current) {
              const pan = boundedPan(panStart.current.panX + event.clientX - panStart.current.x, panStart.current.panY + event.clientY - panStart.current.y);
              dragged.current = true;
              renderTransform({ ...transformRef.current, ...pan });
              return;
            }
            if (!pointerStart.current) return;
            const distance = event.clientX - pointerStart.current.x;
            dragged.current = dragged.current || Math.abs(distance) > 6;
            const width = lightboxRef.current?.clientWidth || window.innerWidth;
            renderDragOffset(clamp(distance, -width, width));
          }}
          onPointerUp={(event) => {
            const wasPinching = pinchStart.current != null;
            pointers.current.delete(event.pointerId);
            if (wasPinching) {
              if (pointers.current.size < 2) pinchStart.current = null;
              pointerStart.current = null;
              panStart.current = null;
              window.clearTimeout(gestureEndTimer.current);
              gestureEndTimer.current = window.setTimeout(() => setGestureActive(false), 80);
              return;
            }
            if (transformRef.current.zoom > MIN_ZOOM) {
              panStart.current = null;
              window.clearTimeout(gestureEndTimer.current);
              gestureEndTimer.current = window.setTimeout(() => setGestureActive(false), 80);
              return;
            }
            if (!pointerStart.current) { setGestureActive(false); return; }
            const distance = event.clientX - pointerStart.current.x;
            const elapsed = Math.max(1, performance.now() - pointerStart.current.at);
            pointerStart.current = null;
            const fastSwipe = Math.abs(distance) / elapsed > 0.45 && Math.abs(distance) > 20;
            const direction = Math.abs(distance) >= SWIPE_THRESHOLD || fastSwipe ? (distance < 0 ? 1 : -1) : 0;
            animatingRef.current = true;
            setAnimating(true);
            if (direction) {
              const width = lightboxRef.current?.clientWidth || window.innerWidth;
              renderDragOffset(direction > 0 ? -width : width);
            } else renderDragOffset(0);
            finishTransition(direction);
            setGestureActive(false);
          }}
          onPointerCancel={(event) => {
            pointers.current.delete(event.pointerId);
            pointerStart.current = null;
            panStart.current = null;
            pinchStart.current = null;
            if (transformRef.current.zoom === MIN_ZOOM) settleSwipe();
            setGestureActive(false);
          }}
          style={{ touchAction: 'none' }}
        >
          <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/35 p-1 text-white backdrop-blur-md" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" disabled={viewportTransform.zoom <= MIN_ZOOM} onClick={() => applyZoom(viewportTransform.zoom - 0.25)} className="rounded-full p-2 hover:bg-white/15 disabled:opacity-35" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
            <span className="min-w-12 text-center text-[11px] font-black">{Math.round(viewportTransform.zoom * 100)}%</span>
            <button type="button" disabled={viewportTransform.zoom >= MAX_ZOOM} onClick={() => applyZoom(viewportTransform.zoom + 0.25)} className="rounded-full p-2 hover:bg-white/15 disabled:opacity-35" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
            {viewportTransform.zoom > MIN_ZOOM && <button type="button" onClick={resetViewport} className="rounded-full p-2 hover:bg-white/15" aria-label="Reset zoom"><RotateCcw className="h-4 w-4" /></button>}
          </div>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={close} className="absolute right-4 top-4 z-30 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.close}><X className="h-5 w-5" /></button>
          {validImages.length > 1 && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); slide(-1); }} className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.previous}><ChevronLeft className="h-6 w-6" /></button>}

          <div className={`flex h-full w-full will-change-transform ${animating ? 'transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]' : ''}`} style={{ transform: validImages.length === 1 ? 'translate3d(0,0,0)' : `translate3d(calc(-100% + ${dragOffset}px),0,0)` }}>
            {visibleIndexes.map((index, position) => {
              const current = position === currentPosition;
              return <div key={`${activeIndex}-${index}-${position}`} className="flex h-full w-full shrink-0 items-center justify-center overflow-hidden p-4 sm:p-10"><img src={validImages[index]} alt={imageAlt(index)} width="1400" height="1050" draggable={false} className={`max-h-full max-w-full select-none rounded-2xl object-contain shadow-2xl will-change-transform ${current && !gestureActive ? 'transition-transform duration-200 ease-out' : ''}`} style={current ? { transform: `translate3d(${viewportTransform.x}px, ${viewportTransform.y}px, 0) scale(${viewportTransform.zoom})`, transformOrigin: 'center center' } : undefined} onClick={(event) => { event.stopPropagation(); if (!dragged.current) close(); dragged.current = false; }} /></div>;
            })}
          </div>

          {validImages.length > 1 && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); slide(1); }} className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label={STORE_COPY.gallery.next}><ChevronRight className="h-6 w-6" /></button>}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 text-center text-xs font-bold text-white/80">{active + 1} / {validImages.length}</div>
        </div>
      )}
    </section>
  );
};
