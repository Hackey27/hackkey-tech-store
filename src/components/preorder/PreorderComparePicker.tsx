import React from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { PreorderProduct } from '../../../shared/types';
import { preorderCardPricing } from '../../../shared/preorderCombinations';
import { formatPesewas } from '../../../shared/money';
import { STORE_COPY } from '../../config/storeCopy';

interface PreorderComparePickerProps {
  /** Already chosen, in pick order. The first is the one pinned leftmost. */
  chosen: PreorderProduct[];
  onRemove: (productId: string) => void;
  onCancel: () => void;
  /** The real listing page, passed in rather than reimplemented. */
  listing: React.ReactNode;
}

/**
 * Choosing the next product to compare.
 *
 * THE PICKER IS THE LISTING PAGE. Finding the second product is the same
 * problem as finding the first — the same filters, the same search, the same
 * Advanced tree — so it is the real component passed in here, not a stripped
 * down list that would quietly lack whichever control the customer needed.
 *
 * The chosen products stay pinned to the left and the picker occupies the
 * space to their right, which is the direction the laptops brief uses too.
 *
 * On a phone there is no room for both, so the pinned column is hidden while
 * picking and comes back once the next product is chosen. Showing a sliver of
 * each would make both unusable rather than one temporarily absent.
 */
export const PreorderComparePicker: React.FC<PreorderComparePickerProps> = ({
  chosen,
  onRemove,
  onCancel,
  listing,
}) => (
  <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="hk-pressable inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]"
      >
        <ArrowLeft className="h-4 w-4" />
        {STORE_COPY.preorder.compare.cancel}
      </button>
      <p data-testid="preorder-picker-prompt" className="text-sm font-bold text-[#025656]">
        {STORE_COPY.preorder.compare.pickPrompt(chosen.length)}
      </p>
    </div>

    <div className="mt-4 gap-5 md:flex md:items-start">
      {/* Pinned, and out of the way on a phone. */}
      <aside
        data-testid="preorder-picker-pinned"
        className="hidden w-56 shrink-0 space-y-3 md:block lg:w-64"
      >
        {chosen.map((product) => {
          const pricing = preorderCardPricing(product);
          return (
            <div
              key={product.productId}
              data-testid="preorder-picker-pinned-card"
              data-product={product.productId}
              className="overflow-hidden rounded-2xl border-2 border-[#014040] bg-white"
            >
              <div className="relative aspect-[4/3] bg-[#edf5f3]">
                {product.previewImagePath && (
                  <img src={product.previewImagePath} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  aria-label={STORE_COPY.preorder.compare.remove(product.name)}
                  onClick={() => onRemove(product.productId)}
                  className="hk-pressable absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-slate-600 hover:text-rose-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs font-black leading-snug text-[#014040]">{product.name}</p>
                {pricing[0] && (
                  <p className="mt-1 text-[11px] font-bold text-[#025656]">
                    {pricing[0].uniform
                      ? formatPesewas(pricing[0].pricePesewas)
                      : STORE_COPY.preorder.fromPrice(formatPesewas(pricing[0].pricePesewas))}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <p className="px-1 text-[11px] leading-4 text-slate-500">
          {STORE_COPY.preorder.compare.pinnedNote}
        </p>
      </aside>

      {/* The listing, entire. */}
      <div data-testid="preorder-picker-listing" className="min-w-0 flex-1">
        {listing}
      </div>
    </div>
  </div>
);
