import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { PreorderCategory, PreorderDelivery } from '../../../shared/types';
import { STORE_COPY } from '../../config/storeCopy';
import {
  EMPTY_PREORDER_FILTERS,
  PreorderFilterState,
  isPreorderFilterActive,
} from '../../utils/preorderFilters';

interface PreorderFilterStripProps {
  categories: PreorderCategory[];
  filters: PreorderFilterState;
  onChange: (filters: PreorderFilterState) => void;
  resultCount: number;
  /** Phones collapse the strip behind the bottom bar's Filters button. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const selectClass =
  'w-full rounded-xl border border-white/25 bg-white/95 px-3 py-2 text-xs font-bold text-[#014040] outline-none focus:border-[#05ef28] focus:ring-2 focus:ring-[#05ef28]/30';
const fieldLabel = 'block text-[10px] font-black uppercase tracking-wider text-white/70';

/**
 * The listing page's filter strip.
 *
 * On the category bar's gradient, because it is the same kind of thing: a band
 * across the top of a listing that says what the listing is showing.
 *
 * Price is deliberately two controls and not one. A sort and a range are
 * different questions, but both have to say WHICH price they mean — a product
 * can be 120 Express and 85 Two months, and a "cheapest first" list that
 * silently picked one of those would reorder itself for no visible reason when
 * the customer changed delivery.
 */
export const PreorderFilterStrip: React.FC<PreorderFilterStripProps> = ({
  categories,
  filters,
  onChange,
  resultCount,
  open,
  onOpenChange,
}) => {
  const parents = categories.filter((category) => !category.parentId);
  const children = categories.filter(
    (category) => filters.categoryId && category.parentId === filters.categoryId
  );
  const active = isPreorderFilterActive(filters);
  const set = (patch: Partial<PreorderFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div
      id="preorder-filters"
      data-testid="preorder-filter-strip"
      data-open={open ? 'true' : 'false'}
      className={`hk-activation-gradient relative overflow-hidden rounded-3xl p-4 text-white shadow-sm sm:p-5 ${
        open ? '' : 'hidden md:block'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#05ef28]" />
          <h2 className="text-sm font-black">{STORE_COPY.preorder.filters.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span data-testid="preorder-result-count" className="text-[11px] font-bold text-[#d9ffe0]">
            {STORE_COPY.preorder.filters.resultCount(resultCount)}
          </span>
          {active && (
            <button
              type="button"
              data-testid="preorder-filters-clear"
              onClick={() => onChange(EMPTY_PREORDER_FILTERS)}
              className="hk-pressable rounded-lg border border-white/30 px-2.5 py-1 text-[11px] font-bold hover:bg-white/10"
            >
              {STORE_COPY.preorder.filters.clear}
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={STORE_COPY.preorder.filters.close}
            className="hk-pressable rounded-lg border border-white/30 p-1.5 md:hidden"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Category, revealing its children once one is chosen. */}
        <label className="space-y-1">
          <span className={fieldLabel}>{STORE_COPY.preorder.filters.category}</span>
          <select
            data-testid="preorder-filter-category"
            className={selectClass}
            value={filters.categoryId}
            onChange={(event) => set({ categoryId: event.target.value, subcategoryId: '' })}
          >
            <option value="">{STORE_COPY.preorder.allCategories}</option>
            {parents.map((category) => (
              <option key={category.categoryId} value={category.categoryId}>{category.name}</option>
            ))}
          </select>
        </label>

        {children.length > 0 ? (
          <label className="space-y-1">
            <span className={fieldLabel}>{STORE_COPY.preorder.filters.subcategory}</span>
            <select
              data-testid="preorder-filter-subcategory"
              className={selectClass}
              value={filters.subcategoryId}
              onChange={(event) => set({ subcategoryId: event.target.value })}
            >
              <option value="">{STORE_COPY.preorder.filters.allOf}</option>
              {children.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>{category.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="hidden sm:block" aria-hidden="true" />
        )}

        {/* Delivery. */}
        <label className="space-y-1">
          <span className={fieldLabel}>{STORE_COPY.preorder.delivery.label}</span>
          <select
            data-testid="preorder-filter-delivery"
            className={selectClass}
            value={filters.delivery}
            onChange={(event) => set({ delivery: event.target.value as PreorderDelivery | 'all' })}
          >
            <option value="all">{STORE_COPY.preorder.filters.allDeliveries}</option>
            <option value="express">{STORE_COPY.preorder.delivery.express}</option>
            <option value="two-months">{STORE_COPY.preorder.delivery.twoMonths}</option>
          </select>
        </label>

        {/* Sort, and which price it reads. */}
        <label className="space-y-1">
          <span className={fieldLabel}>{STORE_COPY.preorder.filters.sort}</span>
          <select
            data-testid="preorder-filter-sort"
            className={selectClass}
            value={filters.sort}
            onChange={(event) => set({ sort: event.target.value as PreorderFilterState['sort'] })}
          >
            <option value="default">{STORE_COPY.preorder.filters.sortDefault}</option>
            <option value="price-asc">{STORE_COPY.preorder.filters.sortAsc}</option>
            <option value="price-desc">{STORE_COPY.preorder.filters.sortDesc}</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className={fieldLabel}>{STORE_COPY.preorder.filters.priceBasis}</span>
          <select
            data-testid="preorder-filter-basis"
            className={selectClass}
            value={filters.priceBasis}
            onChange={(event) => set({ priceBasis: event.target.value as PreorderDelivery })}
          >
            <option value="express">{STORE_COPY.preorder.delivery.express}</option>
            <option value="two-months">{STORE_COPY.preorder.delivery.twoMonths}</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className={fieldLabel}>{STORE_COPY.preorder.filters.minPrice}</span>
          <input
            data-testid="preorder-filter-min"
            className={selectClass}
            inputMode="decimal"
            placeholder="0"
            value={filters.minCedis}
            onChange={(event) => set({ minCedis: event.target.value })}
          />
        </label>

        <label className="space-y-1">
          <span className={fieldLabel}>{STORE_COPY.preorder.filters.maxPrice}</span>
          <input
            data-testid="preorder-filter-max"
            className={selectClass}
            inputMode="decimal"
            placeholder={STORE_COPY.preorder.filters.noMax}
            value={filters.maxCedis}
            onChange={(event) => set({ maxCedis: event.target.value })}
          />
        </label>

        <p className="self-end text-[11px] leading-4 text-white/70">
          {STORE_COPY.preorder.filters.priceNote}
        </p>
      </div>
    </div>
  );
};
