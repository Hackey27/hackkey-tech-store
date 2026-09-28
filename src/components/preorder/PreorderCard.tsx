import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PreorderProduct } from '../../../shared/types';
import { preorderCardPricing } from '../../../shared/preorderCombinations';
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
 * Both delivery speeds are priced here, because they are the choice the
 * customer is really making and a card showing one of them invites them onto a
 * product page to find the other. `preorderCardPricing` also says whether a
 * price is the whole story: when every combination charges the same, the card
 * states it outright, and only hedges with "from" when the variants actually
 * differ. The card never computes a price itself — a second pricing rule here
 * would be the one that disagrees with the product page, and that is the one
 * the customer quotes back at you.
 */
export const PreorderCard: React.FC<PreorderCardProps> = ({ product, onSelect }) => {
  const pricing = preorderCardPricing(product);
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = product.previewImagePath || product.galleryImagePaths?.[0];

  useEffect(() => setImageFailed(false), [imageUrl]);

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

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="text-sm font-bold leading-snug tracking-tight text-[#014040] sm:text-base lg:text-lg">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600 sm:text-xs sm:leading-5">
            {product.description}
          </p>
        )}

        <div className="mt-auto pt-3">
          {pricing.length ? (
            <div data-testid="preorder-card-price" className="space-y-0.5">
              {pricing.map((entry) => (
                <div
                  key={entry.delivery}
                  data-testid={`preorder-card-price-${entry.delivery}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-2"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:text-[10px]">
                    {entry.delivery === 'express'
                      ? STORE_COPY.preorder.delivery.express
                      : STORE_COPY.preorder.delivery.twoMonths}
                  </span>
                  <span className="text-xs font-black text-[#014040] sm:text-sm lg:text-base">
                    {entry.uniform
                      ? formatPesewas(entry.pricePesewas)
                      : STORE_COPY.preorder.fromPrice(formatPesewas(entry.pricePesewas))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            // A product with no priced combination is still browsable: the
            // seller may be taking enquiries on it. It never renders a zero.
            <span className="block text-xs font-black text-[#025656]">
              {STORE_COPY.preorder.askForPrice}
            </span>
          )}
          <ChevronRight
            aria-hidden="true"
            className="mt-2 h-4 w-4 text-[#014040]/40 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </div>
      </div>
    </article>
  );
};
