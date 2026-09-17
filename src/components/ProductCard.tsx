import React from 'react';
import { CatalogueItem } from '../types';
import { Laptop, CheckCircle, ChevronRight, Sparkles } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';

interface ProductCardProps {
  product: CatalogueItem;
  onSelect: (product: CatalogueItem) => void;
  onBuyNowClick: (product: CatalogueItem) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onBuyNowClick
}) => {
  const hasMultipleVariants = product.variants && product.variants.length > 1;

  const productName = product.name || 'Software';

  // Format GHS price string: From ₵... or ₵...
  const firstVariant = product.variants?.[0];
  // One resolution for every kind, and one formatter — a card must never build
  // a currency string by hand, which is how pesewas came to render as cedis.
  const { unitPesewas: minPrice } = resolveLinePricePesewas({
    item: product,
    variant: firstVariant,
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

  // Fallback initial/icon for logo image area
  const getProductInitial = (name: string) => {
    const parts = (name || '').trim().split(' ');
    if (parts.length > 1 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name || 'HK').slice(0, 2).toUpperCase();
  };

  return (
    <div
      id={`product-card-${product.itemId}`}
      className="group flex flex-col justify-between rounded-2xl bg-white border border-[#d8e7e4] hover:border-[#014040]/70 hover:shadow-md transition-all duration-200 overflow-hidden text-slate-900"
    >
      <div className="p-5 sm:p-6">
        {/* Top bar: CatalogueItem Image/Logo Area + Category Label */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            onClick={() => onSelect(product)}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#edf5f3] to-[#d8e9e6] border border-[#c6deda] flex items-center justify-center font-black text-lg text-[#014040] shadow-2xs group-hover:scale-105 transition-transform cursor-pointer"
          >
            {product.categoryId === 'laptops' ? (
              <Laptop className="w-7 h-7 text-[#014040]" />
            ) : product.categoryId === 'research-services' ? (
              <Sparkles className="w-7 h-7 text-[#014040]" />
            ) : (
              <span>{getProductInitial(productName)}</span>
            )}
          </div>

          <div className="text-right">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#edf5f3] text-[#014040] border border-[#d0e4e0]">
              {product.categoryName || 'Software'}
            </span>
            {hasMultipleVariants && (
              <span className="block text-[10px] text-slate-500 mt-1 font-medium">
                {product.variants?.length} editions available
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

        {/* Short Description */}
        <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
          {product.description}
        </p>

        {/* OS Compatibility badges */}
        {product.osList && product.osList.length > 0 && (
          <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 font-medium">Platform:</span>
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
            Price (GHS)
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
