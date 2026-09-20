import React, { useEffect, useMemo, useState } from 'react';
import { CatalogueItem } from '../types';
import { CheckCircle, CreditCard, Info, MessageSquareQuote, ShoppingCart } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { ProductImage, renderableProductImageUrl } from './ProductImage';
import { PromotionCountdown } from './PromotionCountdown';

interface ProductCardProps {
  product: CatalogueItem;
  onSelect: (product: CatalogueItem) => void;
  onBuyNowClick: (product: CatalogueItem) => void;
  onAddToCart?: (product: CatalogueItem) => void;
  onInterestClick?: (product: CatalogueItem) => void;
  showCategoryLabel?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onBuyNowClick,
  onAddToCart,
  onInterestClick,
  showCategoryLabel = true
}) => {
  const versionCount = new Set((product.variants || []).filter((variant) => variant.available).map((variant) => variant.versionOrPlan)).size;
  const hasMultipleVariants = versionCount > 1;
  const latestVariant = product.variants?.find((variant) => variant.latest && variant.available) || product.variants?.find((variant) => variant.available);
  const isTurnitin = product.kind === 'service' && product.itemId.toUpperCase() === 'TURNITIN';
  const [laptopPreviewFailed, setLaptopPreviewFailed] = useState(false);
  const [showLaptopAvailability, setShowLaptopAvailability] = useState(false);
  const [hoverLaptopAvailability, setHoverLaptopAvailability] = useState(false);

  const productName = product.name || STORE_COPY.product.softwareFallback;
  const cardName = product.kind === 'laptop' && product.laptop
    ? [product.laptop.brand, product.laptop.model].filter(Boolean).join(' ') || productName
    : productName;
  const laptopPreviewUrl = useMemo(() => renderableProductImageUrl(
    product.bannerImageUrl || product.mobileBannerImageUrl || product.imageUrl
  ), [product.bannerImageUrl, product.mobileBannerImageUrl, product.imageUrl]);
  const laptopMobilePreviewUrl = useMemo(() => renderableProductImageUrl(
    product.mobileBannerImageUrl || product.bannerImageUrl || product.imageUrl
  ), [product.mobileBannerImageUrl, product.bannerImageUrl, product.imageUrl]);
  useEffect(() => setLaptopPreviewFailed(false), [laptopPreviewUrl]);

  // Format GHS price string: Starts at ₵... or ₵...
  // One resolution for every kind, and one formatter — a card must never build
  // a currency string by hand, which is how pesewas came to render as cedis.
  const { unitPesewas: minPrice } = resolveLinePricePesewas({
    item: product,
    quantity: 1
  });

  const displayPrice =
    minPrice > 0
      ? hasMultipleVariants
        ? STORE_COPY.product.fromPrice(formatPesewas(minPrice))
        : formatPesewas(minPrice)
      : STORE_COPY.product.askForPrice;

  const payable = product.kind === 'product' || product.kind === 'bundle' || (product.kind === 'service' && Boolean(product.options?.length));
  const isPreorder = product.kind === 'laptop' && product.laptop?.availability.toLowerCase().includes('pre');
  const availabilityMessage = isPreorder
    ? 'This laptop will be shipped after purchase and delivered within 2 to 4 weeks after payment. Pay 70% now and the remaining 30% when the laptop arrives.'
    : 'This laptop is available with us and can be delivered as soon as your purchase is made.';
  const laptopAvailabilityVisible = showLaptopAvailability || hoverLaptopAvailability;

  return (
    <article
      id={`product-card-${product.itemId}`}
      role="button" tabIndex={0} onClick={() => onSelect(product)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(product); } }}
      className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#d8e7e4] bg-white text-slate-900 transition-all duration-200 hover:border-[#014040]/70 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#014040]"
    >
      <div className="p-5 sm:p-6">
        {/* Laptops use their product banner as the browsing preview. */}
        {product.kind === 'laptop' ? <div className="relative -mx-5 -mt-5 mb-5 aspect-[4/5] overflow-hidden bg-gradient-to-br from-[#025656] to-[#002929] sm:-mx-6 sm:-mt-6 sm:aspect-[16/9]">
          {laptopPreviewUrl && !laptopPreviewFailed && <picture><source media="(max-width: 639px)" srcSet={laptopMobilePreviewUrl || laptopPreviewUrl} /><img src={laptopPreviewUrl} alt={cardName} width="960" height="540" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" onError={() => setLaptopPreviewFailed(true)} /></picture>}
          {(!laptopPreviewUrl || laptopPreviewFailed) && <div className="flex h-full items-center justify-center px-6 text-center text-2xl font-black text-white">{cardName}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#014040]/95 via-[#014040]/35 to-black/5" aria-hidden="true" />
          {showCategoryLabel && <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-[#014040]/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">{product.categoryName || 'Laptop'}</span>}
          <div
            className="absolute right-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-col items-end"
            onMouseEnter={() => setHoverLaptopAvailability(true)}
            onMouseLeave={() => setHoverLaptopAvailability(false)}
            onFocus={() => setHoverLaptopAvailability(true)}
            onBlur={() => setHoverLaptopAvailability(false)}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => setShowLaptopAvailability((value) => !value)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm ${isPreorder ? 'bg-amber-300 text-amber-950' : 'bg-[#05ef28] text-[#014040]'}`} aria-expanded={laptopAvailabilityVisible} aria-describedby={`laptop-availability-${product.itemId}`}><Info className="h-3 w-3" />{isPreorder ? 'Pre-order' : 'Available'}</button>
            {laptopAvailabilityVisible && <div id={`laptop-availability-${product.itemId}`} role="tooltip" className="mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-[#cbdcd9] bg-white/95 p-3 text-left text-xs font-semibold normal-case leading-5 tracking-normal text-slate-700 shadow-xl backdrop-blur-sm">{availabilityMessage}</div>}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 text-white"><h3 className="text-xl font-black leading-tight sm:text-2xl">{cardName}</h3><p className="mt-1 text-2xl font-black text-[#05ef28]">{displayPrice}</p>{(product.promoLabel || product.promoPercent) && <p className="mt-1 text-[10px] font-black text-[#d9ffe0]">{product.promoLabel || `${product.promoPercent}% off`} · <PromotionCountdown endsAt={product.promoEndsAt} /></p>}</div>
        </div> : product.cardImageUrl ? <div className="relative -mx-5 -mt-5 mb-5 aspect-[3/2] overflow-hidden bg-[#edf5f3] sm:-mx-6 sm:-mt-6"><img src={product.cardImageUrl} alt="" width="900" height="600" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /><div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" /><div className="absolute bottom-3 left-3"><ProductImage name={productName} itemId={product.itemId} imageUrl={product.imageUrl} kind={product.kind} size="sm" /></div>{showCategoryLabel && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase text-[#014040]">{product.categoryName || STORE_COPY.product.softwareFallback}</span>}</div> : <div className="mb-4 flex items-start justify-between gap-3">
          <div className="rounded-2xl transition-transform group-hover:scale-105 motion-reduce:transition-none"><ProductImage name={productName} itemId={product.itemId} imageUrl={product.imageUrl} kind={product.kind} /></div>
          <div className="text-right">{showCategoryLabel && <span className="inline-block rounded-full border border-[#d0e4e0] bg-[#edf5f3] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#014040]">{product.categoryName || STORE_COPY.product.softwareFallback}</span>}{versionCount > 0 && <span className="mt-1 block text-[10px] font-medium text-slate-500">{STORE_COPY.product.versionsAvailable(versionCount)}</span>}</div>
        </div>}
        {/* Product Name */}
        {product.kind !== 'laptop' && <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><h3
          className="text-base sm:text-lg font-bold text-[#014040] tracking-tight group-hover:text-[#025656] transition-colors leading-snug"
        >
          {cardName}
        </h3>{product.kind === 'product' && product.licenceTerm && <span className="text-xs font-medium text-[#025656] sm:text-sm">{product.licenceTerm}</span>}</div>}

        {product.kind === 'laptop' && product.laptop && <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><span><b>CPU</b><br />{product.laptop.processor}</span><span><b>RAM</b><br />{product.laptop.ram}</span><span><b>Storage</b><br />{product.laptop.storage}</span>{(product.laptop.graphicsDetails || (/dedicated/i.test(product.laptop.graphics || '') && !/(?:no dedicated|integrated)/i.test(product.laptop.graphics || ''))) && <span><b>Dedicated graphics</b><br />{product.laptop.graphicsDetails || product.laptop.graphics}</span>}</div>}

        {/* OS Compatibility badges */}
        {product.osList && product.osList.length > 0 && (
          <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 font-medium">{STORE_COPY.product.platform}</span>
            {product.osList.map((os, idx) => (
              <span
                key={idx}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#f1f6f5] text-slate-700 border border-[#dbe8e5]"
              >
                {os}
              </span>
            ))}
          </div>
        )}

        {/* Highlighted recommended version if present */}
        {product.variants && product.variants.some((v) => v.latest) && (
          <div className="mt-3 text-[11px] flex items-center gap-1.5 text-[#014040] font-medium bg-[#f0f8f6] px-2.5 py-1 rounded-lg border border-[#cbe5df]">
            <CheckCircle className="w-3.5 h-3.5 text-[#05ef28] shrink-0" />
            <span>
              {STORE_COPY.product.latest} version:{' '}
              <strong>
                {
                  product.variants.find((v) => v.latest)?.versionOrPlan
                }
              </strong>{' '}
              ({STORE_COPY.product.recommended})
            </span>
          </div>
        )}
      </div>

      {/* Footer: Price in GHS & Primary Action Button */}
      <div className={`px-5 sm:px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 ${product.kind === 'product' ? 'border-[#025656] bg-[#014040]' : 'border-[#e2ecea] bg-[#f8fbfa]'}`}>
        {/* Price in GHS only */}
        {product.kind !== 'laptop' && <div className={product.kind === 'product' ? 'min-w-0' : undefined}>
          <span className={`text-[10px] uppercase tracking-wider font-bold block ${product.kind === 'product' ? 'text-white/70' : 'text-slate-500'}`}>
            {STORE_COPY.product.priceLabel}
          </span>
          <span className={`text-base sm:text-lg font-black ${product.kind === 'product' ? 'text-white' : 'text-[#014040]'}`}>
            {displayPrice}
          </span>
          {product.kind === 'product' && latestVariant && <span className="mt-0.5 block text-[10px] font-bold text-white/80">{hasMultipleVariants ? 'Latest version' : 'Version'} {latestVariant.versionOrPlan}</span>}
          {(product.promoLabel || product.promoPercent) && <span className={`mt-1 block text-[10px] font-black ${product.kind === 'product' ? 'text-[#d9ffe0]' : 'text-[#0d6520]'}`}>{product.promoLabel || `${product.promoPercent}% off`} · <PromotionCountdown endsAt={product.promoEndsAt} /></span>}
        </div>}

        {payable ? <div className={`${product.kind === 'product' ? 'basis-full grid grid-cols-2' : 'ml-auto flex flex-wrap justify-end'} gap-2`}><button id={`product-buy-btn-${product.itemId}`} onClick={(event) => { event.stopPropagation(); onBuyNowClick(product); }} className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-black ${product.kind === 'product' ? 'border border-[#05ef28] bg-[#05ef28] text-[#014040] hover:bg-[#20f43d]' : 'bg-[#05ef28] text-[#014040] hover:bg-[#04d824]'}`}><CreditCard className="h-3.5 w-3.5 shrink-0" />{product.kind === 'product' ? (hasMultipleVariants ? 'Buy latest version' : 'Buy now') : isTurnitin ? 'Check now' : 'Buy now'}</button><button id={`product-cart-btn-${product.itemId}`} onClick={(event) => { event.stopPropagation(); onAddToCart?.(product); }} className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-black ${product.kind === 'product' ? 'border border-white bg-white text-[#014040] hover:bg-[#edf5f3]' : 'bg-[#014040] text-white hover:bg-[#025656]'}`}><ShoppingCart className="h-3.5 w-3.5 shrink-0" />Add to cart</button></div> : <button onClick={(event) => { event.stopPropagation(); if (product.kind === 'laptop' && onInterestClick) onInterestClick(product); else onSelect(product); }} className="ml-auto flex items-center gap-1.5 rounded-xl bg-[#014040] px-4 py-2.5 text-xs font-black text-white"><MessageSquareQuote className="h-3.5 w-3.5" />{product.kind === 'laptop' ? 'I am interested' : 'Get a quote'}</button>}
      </div>
    </article>
  );
};
