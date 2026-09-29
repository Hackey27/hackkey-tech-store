import React, { useEffect, useState } from 'react';
import { ChevronRight, PackagePlus, SlidersHorizontal } from 'lucide-react';
import { PreorderProduct } from '../../../shared/types';
import { preorderCardPricing } from '../../../shared/preorderCombinations';
import { formatPesewas } from '../../../shared/money';
import { STORE_COPY } from '../../config/storeCopy';

interface PreorderCardProps {
  product: PreorderProduct;
  onSelect: (product: PreorderProduct) => void;
  /** Only ever called for a product with exactly one combination. */
  onAdd: (product: PreorderProduct) => void;
  comparing: boolean;
  /** False once the comparison is full, so the control can say so rather than
   *  swallowing the tap. */
  canCompare: boolean;
  /** Only true while a comparison is running. Outside one the card carries no
   *  compare control at all, so ordinary browsing is not cluttered by a
   *  feature almost nobody is using at that moment. */
  compareActive: boolean;
  onToggleCompare: (product: PreorderProduct) => void;
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
function pricingAvailable(product: PreorderProduct): boolean {
  return preorderCardPricing(product).length > 0;
}

export const PreorderCard: React.FC<PreorderCardProps> = ({
  product,
  onSelect,
  onAdd,
  comparing,
  canCompare,
  compareActive,
  onToggleCompare,
}) => {
  /* One combination means there is nothing left to choose, so the card can sell
     it outright. Anything with variants has no price until the customer picks,
     so its button opens the product page instead of pretending to add. */
  const directlyAddable = product.combinations.length === 1 && pricingAvailable(product);
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
        {/* Only while a comparison is running, and over the picture rather than
            in the body: the body already carries a name, a description, two
            prices and a button. */}
        {compareActive && <button
          type="button"
          data-testid={`preorder-compare-toggle-${product.productId}`}
          aria-pressed={comparing}
          disabled={!comparing && !canCompare}
          title={!comparing && !canCompare ? STORE_COPY.preorder.compare.full(3) : undefined}
          onClick={(event) => { event.stopPropagation(); onToggleCompare(product); }}
          className={`hk-pressable absolute right-2 top-2 z-10 rounded-lg px-2 py-1 text-[10px] font-black shadow-sm ${
            comparing
              ? 'bg-[#014040] text-white'
              : canCompare
                ? 'bg-white/90 text-[#014040] hover:bg-white'
                : 'cursor-not-allowed bg-white/60 text-slate-400'
          }`}
        >
          {comparing ? STORE_COPY.preorder.compare.added : STORE_COPY.preorder.compare.add}
        </button>}
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
          <button
            type="button"
            data-testid={directlyAddable ? 'preorder-card-add' : 'preorder-card-choose'}
            onClick={(event) => {
              // The whole card navigates, so the button has to keep its click.
              event.stopPropagation();
              if (directlyAddable) onAdd(product);
              else onSelect(product);
            }}
            className={`hk-pressable mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-black sm:text-xs ${
              directlyAddable
                ? 'bg-[#05ef28] text-[#014040] hover:bg-[#04d824]'
                : 'border border-[#014040] text-[#014040] hover:bg-[#edf5f3]'
            }`}
          >
            {directlyAddable ? <PackagePlus className="h-3.5 w-3.5 shrink-0" /> : <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />}
            {directlyAddable ? STORE_COPY.preorder.addToPreorder : STORE_COPY.preorder.chooseOptions}
            {!directlyAddable && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
          </button>
        </div>
      </div>
    </article>
  );
};
