import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PreorderProduct } from '../../../shared/types';
import { previewPricePesewas } from '../../../shared/preorderCombinations';
import { formatPesewas } from '../../../shared/money';
import { STORE_COPY } from '../../config/storeCopy';

interface PreorderCardProps {
  product: PreorderProduct;
  onSelect: (product: PreorderProduct) => void;
}

/**
 * One product on the pre-order listing.
 *
 * NO GRADIENT OVER THE IMAGE. The software and laptop cards wash their picture
 * down into a dark scrim because they print the name and price on top of it.
 * Here the text sits below the image, so a scrim would only dim a photograph
 * of the thing the customer is trying to look at. This is the whole reason the
 * card is its own component rather than a variant of ProductCard.
 *
 * The price comes from `previewPricePesewas`, which picks the cheapest
 * combination and prefers Express when both delivery speeds are offered. The
 * card never computes a price itself: it would be a second pricing rule, and
 * the one that disagrees with the product page is the one the customer quotes
 * back at you.
 */
export const PreorderCard: React.FC<PreorderCardProps> = ({ product, onSelect }) => {
  const preview = previewPricePesewas(product);
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = product.previewImagePath || product.galleryImagePaths?.[0];

  useEffect(() => setImageFailed(false), [imageUrl]);

  const deliveryLabel = preview?.delivery === 'two-months'
    ? STORE_COPY.preorder.delivery.twoMonths
    : STORE_COPY.preorder.delivery.express;

  return (
    <article
      id={`preorder-card-${product.productId}`}
      data-testid="preorder-card"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(product)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(product);
      }}
      className="hk-pressable group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-[#d8e7e4] bg-white text-left text-slate-900 hover:border-[#014040]/70 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#014040]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#edf5f3]">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-lg font-black text-[#014040]/40">
            {product.name}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-base font-bold leading-snug tracking-tight text-[#014040] sm:text-lg">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-600">{product.description}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="min-w-0">
            {preview ? (
              <>
                <span
                  data-testid="preorder-card-price"
                  className="block text-base font-black text-[#014040] sm:text-lg"
                >
                  {STORE_COPY.preorder.fromPrice(formatPesewas(preview.pricePesewas))}
                </span>
                <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {deliveryLabel}
                </span>
              </>
            ) : (
              // A product with no priced combination is still browsable: the
              // seller may be taking enquiries on it. It never renders a zero.
              <span className="block text-sm font-black text-[#025656]">
                {STORE_COPY.preorder.askForPrice}
              </span>
            )}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-[#014040]/40 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </div>
      </div>
    </article>
  );
};
