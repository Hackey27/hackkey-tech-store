import React from 'react';
import { CatalogueItem } from '../types';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: CatalogueItem;
  onSelect: (product: CatalogueItem) => void;
  onBuyNowClick: (product: CatalogueItem) => void;
  showCategoryLabel?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onBuyNowClick,
  showCategoryLabel = true
}) => {
  const hasMultipleVariants = product.variants && product.variants.length > 1;

  const productName = product.name || STORE_COPY.product.softwareFallback;

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

  // Primary action button label (Buy now vs View options)
  const actionLabel = hasMultipleVariants ? STORE_COPY.product.viewOptions : STORE_COPY.product.buyNow;

  return (
    <div
      id={`product-card-${product.itemId}`}
      className="group flex flex-col justify-between rounded-2xl bg-white border border-[#d8e7e4] hover:border-[#014040]/70 hover:shadow-md transition-all duration-200 overflow-hidden text-slate-900"
    >
      <div className="p-5 sm:p-6">
        {/* Top bar: real catalogue image + optional category context. */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={() => onSelect(product)}
            className="rounded-2xl group-hover:scale-105 transition-transform motion-reduce:transition-none"
            aria-label={productName}
          >
            <ProductImage name={productName} itemId={product.itemId} imageUrl={product.imageUrl} kind={product.kind} />
          </button>

          <div className="text-right">
            {showCategoryLabel && (
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#edf5f3] text-[#014040] border border-[#d0e4e0]">
                {product.categoryName || STORE_COPY.product.softwareFallback}
              </span>
            )}
            {hasMultipleVariants && (
              <span className="block text-[10px] text-slate-500 mt-1 font-medium">
                {STORE_COPY.product.versionsAvailable(product.variants?.length || 0)}
              </span>
            )}
          </div>
        </div>

        {/* Product Name */}
        <h3
          onClick={() => onSelect(product)}
          className="text-base sm:text-lg font-bold text-[#014040] tracking-tight hover:text-[#025656] cursor-pointer transition-colors leading-snug"
        >
          {productName}
        </h3>

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

        {/* Primary Action Button */}
        <button
          id={`product-action-btn-${product.itemId}`}
          onClick={() => {
            if (hasMultipleVariants) {
              onSelect(product);
            } else {
              onBuyNowClick(product);
            }
          }}
          className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#05ef28] hover:bg-[#04d824] active:scale-98 text-[#014040] font-black text-xs sm:text-sm shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <span>{actionLabel}</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
        </button>
      </div>
    </div>
  );
};
