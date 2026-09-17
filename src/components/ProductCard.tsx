import React, { useEffect, useMemo, useState } from 'react';
import { CatalogueItem } from '../types';
import { CheckCircle, CreditCard, MessageSquareQuote, ShoppingCart } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { ProductImage, renderableProductImageUrl } from './ProductImage';

interface ProductCardProps {
  product: CatalogueItem;
  onSelect: (product: CatalogueItem) => void;
  onBuyNowClick: (product: CatalogueItem) => void;
  onAddToCart?: (product: CatalogueItem) => void;
  showCategoryLabel?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onBuyNowClick,
  onAddToCart,
  showCategoryLabel = true
}) => {
  const hasMultipleVariants = product.variants && product.variants.length > 1;
  const [laptopPreviewFailed, setLaptopPreviewFailed] = useState(false);

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

  // Format GHS price string: From ₵... or ₵...
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

  return (
    <article
      id={`product-card-${product.itemId}`}
      role="button" tabIndex={0} onClick={() => onSelect(product)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(product); } }}
      className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#d8e7e4] bg-white text-slate-900 transition-all duration-200 hover:border-[#014040]/70 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#014040]"
    >
      <div className="p-5 sm:p-6">
        {/* Laptops use their product banner as the browsing preview. */}
        {product.kind === 'laptop' ? <div className="relative -mx-5 -mt-5 mb-5 aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#025656] to-[#002929] sm:-mx-6 sm:-mt-6">
          {laptopPreviewUrl && !laptopPreviewFailed && <picture><source media="(max-width: 639px)" srcSet={laptopMobilePreviewUrl || laptopPreviewUrl} /><img src={laptopPreviewUrl} alt={cardName} width="960" height="540" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" onError={() => setLaptopPreviewFailed(true)} /></picture>}
          {(!laptopPreviewUrl || laptopPreviewFailed) && <div className="flex h-full items-center justify-center px-6 text-center text-2xl font-black text-white">{cardName}</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden="true" />
          {showCategoryLabel && <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-[#014040]/85 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">{product.categoryName || 'Laptop'}</span>}
        </div> : <div className="mb-4 flex items-start justify-between gap-3">
          <div className="rounded-2xl transition-transform group-hover:scale-105 motion-reduce:transition-none"><ProductImage name={productName} itemId={product.itemId} imageUrl={product.imageUrl} kind={product.kind} /></div>
          <div className="text-right">{showCategoryLabel && <span className="inline-block rounded-full border border-[#d0e4e0] bg-[#edf5f3] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#014040]">{product.categoryName || STORE_COPY.product.softwareFallback}</span>}{hasMultipleVariants && <span className="mt-1 block text-[10px] font-medium text-slate-500">{STORE_COPY.product.versionsAvailable(product.variants?.length || 0)}</span>}</div>
        </div>}

        {/* Product Name */}
        <h3
          className="text-base sm:text-lg font-bold text-[#014040] tracking-tight group-hover:text-[#025656] transition-colors leading-snug"
        >
          {cardName}
        </h3>

        {product.kind === 'laptop' && product.laptop && <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><span><b>CPU</b><br />{product.laptop.processor}</span><span><b>RAM</b><br />{product.laptop.ram}</span><span><b>Storage</b><br />{product.laptop.storage}</span>{(product.laptop.graphicsDetails || product.laptop.graphics?.toLowerCase().includes('dedicated')) && <span><b>Dedicated graphics</b><br />{product.laptop.graphicsDetails || product.laptop.graphics}</span>}</div>}

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
              {STORE_COPY.product.latest}:{' '}
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
      <div className="px-5 sm:px-6 py-4 bg-[#f8fbfa] border-t border-[#e2ecea] flex items-center justify-between gap-3">
        {/* Price in GHS only */}
        <div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">
            {STORE_COPY.product.priceLabel}
          </span>
          <span className="text-base sm:text-lg font-black text-[#014040]">
            {displayPrice}
          </span>
        </div>

        {payable ? <div className="flex gap-2"><button id={`product-buy-btn-${product.itemId}`} onClick={(event) => { event.stopPropagation(); onBuyNowClick(product); }} className="flex items-center gap-1.5 rounded-xl bg-[#05ef28] px-3 py-2.5 text-xs font-black text-[#014040] hover:bg-[#04d824]"><CreditCard className="h-3.5 w-3.5" />Buy now</button><button id={`product-cart-btn-${product.itemId}`} onClick={(event) => { event.stopPropagation(); onAddToCart?.(product); }} className="flex items-center gap-1.5 rounded-xl bg-[#014040] px-3 py-2.5 text-xs font-black text-white hover:bg-[#025656]"><ShoppingCart className="h-3.5 w-3.5" />Add</button></div> : <button onClick={(event) => { event.stopPropagation(); onSelect(product); }} className="flex items-center gap-1.5 rounded-xl bg-[#014040] px-4 py-2.5 text-xs font-black text-white"><MessageSquareQuote className="h-3.5 w-3.5" />{product.kind === 'laptop' ? 'I am interested' : 'Get a quote'}</button>}
      </div>
    </article>
  );
};
