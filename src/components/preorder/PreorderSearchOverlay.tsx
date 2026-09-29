import React from 'react';
import { Search, X } from 'lucide-react';
import { formatPesewas } from '../../../shared/money';
import { STORE_COPY } from '../../config/storeCopy';
import {
  PreorderSearchResult,
  groupPreorderResults,
} from '../../utils/preorderSearch';

interface PreorderSearchOverlayProps {
  query: string;
  results: PreorderSearchResult[];
  loading: boolean;
  onClose: () => void;
  onSelect: (result: PreorderSearchResult) => void;
}

/**
 * Search results for the pre-order section.
 *
 * Deliberately the same overlay the software tab uses — same position, same
 * backdrop, same dismissal, same empty state — because it answers the same
 * gesture in the same header. What differs is what a row can be.
 *
 * Rows are grouped under their product. A query naming no variant matches the
 * product and all of its combinations, which is a dozen rows leading to one
 * page; grouped, that reads as one product with its variants listed, which is
 * what it actually is.
 */
export function PreorderSearchOverlay({
  query,
  results,
  loading,
  onClose,
  onSelect,
}: PreorderSearchOverlayProps) {
  if (!query.trim()) return null;
  const groups = groupPreorderResults(results);

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[116px] z-50 bg-[#002b2b]/35 px-3 py-4 backdrop-blur-md sm:top-[68px] sm:px-6"
      onClick={onClose}
    >
      <section
        data-testid="preorder-search-overlay"
        className="hk-search-results mx-auto max-h-[calc(100vh-9rem)] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={STORE_COPY.preorder.search.ariaLabel(query)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#d8e7e4] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#014040]">
              {STORE_COPY.preorder.search.heading(query)}
            </p>
            <p data-testid="preorder-search-count" className="mt-0.5 text-xs text-slate-500">
              {loading
                ? STORE_COPY.preorder.search.searching
                : STORE_COPY.preorder.search.count(results.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#014040] hover:bg-[#edf5f3]"
            aria-label={STORE_COPY.preorder.search.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-3 sm:p-4">
          {!loading && results.length === 0 && (
            <div data-testid="preorder-search-empty" className="flex flex-col items-center px-4 py-12 text-center">
              <span className="rounded-2xl bg-[#edf5f3] p-3 text-[#014040]">
                <Search className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-black text-slate-800">{STORE_COPY.preorder.search.emptyTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{STORE_COPY.preorder.search.emptyBody}</p>
            </div>
          )}

          <div className="space-y-3">
            {!loading && groups.map((group) => (
              <div
                key={group.product.productId}
                data-testid="preorder-search-group"
                className="overflow-hidden rounded-2xl border border-[#d8e7e4]"
              >
                {group.rows.map((result) => (
                  <button
                    key={result.key}
                    type="button"
                    data-testid={result.combination ? 'preorder-search-combination' : 'preorder-search-product'}
                    data-key={result.key}
                    onClick={() => onSelect(result)}
                    className="flex w-full min-w-0 items-center gap-3 border-b border-[#edf4f3] bg-white p-3 text-left last:border-b-0 hover:bg-[#f6fbfa]"
                  >
                    {result.imageUrl ? (
                      <img
                        src={result.imageUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl border border-[#e2ecea] object-cover"
                      />
                    ) : (
                      <span className="h-14 w-14 shrink-0 rounded-xl bg-[#edf5f3]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-[#014040]">
                        {result.product.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-[#025656]">
                        {result.selectionLabel || STORE_COPY.preorder.search.wholeProduct}
                      </span>
                      <span className="mt-1 block text-sm font-black text-[#025656]">
                        {result.pricePesewas === null
                          ? STORE_COPY.preorder.askForPrice
                          : `${formatPesewas(result.pricePesewas)}${
                              result.delivery === 'two-months'
                                ? ` · ${STORE_COPY.preorder.delivery.twoMonths}`
                                : ''
                            }`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
