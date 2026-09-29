import React, { useMemo, useState } from 'react';
import { PreorderCategory, PreorderProduct } from '../../../shared/types';
import { STORE_COPY } from '../../config/storeCopy';
import { PreorderCard } from './PreorderCard';
import { PreorderFilterStrip } from './PreorderFilterStrip';
import {
  EMPTY_PREORDER_FILTERS,
  PreorderFilterState,
  filterPreorderProducts,
} from '../../utils/preorderFilters';

interface PreorderListingViewProps {
  categories: PreorderCategory[];
  products: PreorderProduct[];
  onSelectProduct: (product: PreorderProduct) => void;
  onAddProduct: (product: PreorderProduct) => void;
  comparedIds: string[];
  compareFull: boolean;
  onToggleCompare: (product: PreorderProduct) => void;
  onOpenCompare: () => void;
  onClearCompare: () => void;
  /** The bottom bar's Filters button drives this on phones. */
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
}

export const PreorderListingView: React.FC<PreorderListingViewProps> = ({
  categories,
  products,
  onSelectProduct,
  onAddProduct,
  comparedIds,
  compareFull,
  onToggleCompare,
  onOpenCompare,
  onClearCompare,
  filtersOpen,
  onFiltersOpenChange,
}) => {
  const [filters, setFilters] = useState<PreorderFilterState>(EMPTY_PREORDER_FILTERS);

  const visible = useMemo(
    () => filterPreorderProducts(products, categories, filters),
    [products, categories, filters]
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-black tracking-tight text-[#014040] sm:text-4xl">
          {STORE_COPY.preorder.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          {STORE_COPY.preorder.lead}
        </p>
        {products.length > 0 && (
          <p className="mt-4 text-xs font-bold text-[#025656]">
            {STORE_COPY.preorder.itemCount(products.length)}
          </p>
        )}
      </header>

      {products.length > 0 && (
        <div className="mt-6">
          <PreorderFilterStrip
            categories={categories}
            products={products}
            filters={filters}
            onChange={setFilters}
            resultCount={visible.length}
            open={filtersOpen}
            onOpenChange={onFiltersOpenChange}
          />
        </div>
      )}

      {/* Two across on a phone, four on a laptop. Fixed counts rather than
          auto-fit: auto-fit drops to a single column on a narrow phone, and one
          tall card per screen makes a catalogue feel empty. */}
      {visible.length > 0 ? (
        <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {visible.map((product) => (
            <PreorderCard
              key={product.productId}
              product={product}
              onSelect={onSelectProduct}
              onAdd={onAddProduct}
              comparing={comparedIds.includes(product.productId)}
              canCompare={!compareFull}
              onToggleCompare={onToggleCompare}
            />
          ))}
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-[#d8e7e4] bg-white p-12 text-center text-sm text-slate-600">
          {products.length ? STORE_COPY.preorder.filters.noResults : STORE_COPY.preorder.empty}
        </div>
      )}

      {/* The tray. Two is the fewest that can be compared, so it only offers
          the screen once there is something to put side by side. */}
      {comparedIds.length > 0 && (
        <div
          data-testid="preorder-compare-tray"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d8e7e4] bg-white/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] shadow-[0_-8px_24px_rgba(1,64,64,0.08)] backdrop-blur md:pb-3"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-1">
            <span className="text-xs font-bold text-[#014040]">
              {STORE_COPY.preorder.compare.open(comparedIds.length)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="preorder-compare-clear"
                onClick={onClearCompare}
                className="hk-pressable rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                {STORE_COPY.preorder.compare.clear}
              </button>
              <button
                type="button"
                data-testid="preorder-compare-open"
                disabled={comparedIds.length < 2}
                onClick={onOpenCompare}
                className={`hk-pressable rounded-xl px-4 py-2 text-xs font-black ${
                  comparedIds.length < 2
                    ? 'cursor-not-allowed bg-[#dfe9e7] text-slate-400'
                    : 'bg-[#014040] text-white hover:bg-[#025656]'
                }`}
              >
                {STORE_COPY.preorder.compare.title}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
