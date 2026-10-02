import React, { useId, useState } from "react";
import { Search, X } from "lucide-react";
import { formatPesewas } from "../../../shared/money";
import { STORE_COPY } from "../../config/storeCopy";
import { PreorderProduct } from "../../../shared/types";
import {
  PreorderSelections,
  readableSelections,
  resolvePreorderSelection,
} from "../../../shared/preorderCombinations";
import { PreorderDeliveryLabel } from "./PreorderDeliveryLabel";
import {
  PreorderSearchResult,
  groupPreorderResults,
  preorderSelectionPricing,
} from "../../utils/preorderSearch";

interface PreorderSearchOverlayProps {
  query: string;
  results: PreorderSearchResult[];
  loading: boolean;
  onClose: () => void;
  onSelect: (result: PreorderSearchResult) => void;
  selectingComparison?: boolean;
  /** Offered where the customer has hit the wall: nothing matched. */
  onRequestProduct: () => void;
}

/** Floating product results with variant choices and prices in each group. */
export function PreorderSearchOverlay({
  query,
  results,
  loading,
  onClose,
  onSelect,
  onRequestProduct,
  selectingComparison = false,
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
            <p
              data-testid="preorder-search-count"
              className="mt-0.5 text-xs text-slate-500"
            >
              {loading
                ? STORE_COPY.preorder.search.searching
                : STORE_COPY.preorder.search.count(groups.length)}
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
            <div
              data-testid="preorder-search-empty"
              className="flex flex-col items-center px-4 py-12 text-center"
            >
              <span className="rounded-2xl bg-[#edf5f3] p-3 text-[#014040]">
                <Search className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-black text-slate-800">
                {STORE_COPY.preorder.search.emptyTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {STORE_COPY.preorder.search.emptyBody}
              </p>
              <button
                type="button"
                data-testid="preorder-request-cta"
                onClick={onRequestProduct}
                className="hk-pressable mt-5 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white hover:bg-[#025656]"
              >
                {STORE_COPY.preorder.search.requestCta}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {!loading &&
              groups.map((group) => (
                <ProductSearchResult
                  key={`${group.product.productId}:${query}`}
                  product={group.product}
                  matches={group.rows}
                  selectingComparison={selectingComparison}
                  onSelect={onSelect}
                />
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** One product, with one horizontal row per variant property. */
function ProductSearchResult({
  product,
  matches,
  selectingComparison,
  onSelect,
}: {
  product: PreorderProduct;
  matches: PreorderSearchResult[];
  selectingComparison: boolean;
  onSelect: (result: PreorderSearchResult) => void;
}) {
  const [selections, setSelections] = useState<PreorderSelections>(() =>
    matches.some((result) => !result.combination)
      ? {}
      : { ...matches[0]?.combination?.selections },
  );
  const resolved = resolvePreorderSelection(product, selections);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const variantsId = useId();
  const pricing = preorderSelectionPricing(product, selections);
  const image = resolved.imagePath;
  const chooseProduct = () =>
    onSelect({
      key: product.productId,
      product,
      combination: resolved.combination || undefined,
      selectionLabel: readableSelections(selections, product.variantAxes),
      pricePesewas: pricing[0]?.pricePesewas ?? null,
      delivery: pricing[0]?.delivery ?? null,
      imageUrl: image || undefined,
    });
  return (
    <article
      data-testid="preorder-search-group"
      className="min-w-0 rounded-2xl border border-[#d8e7e4] bg-white p-3 sm:p-4"
    >
      <button
        type="button"
        data-testid="preorder-search-product"
        onClick={chooseProduct}
        className="flex w-full items-center gap-3 text-left"
      >
        {image ? (
          <img
            src={image}
            alt=""
            className="h-20 w-20 shrink-0 rounded-xl border border-[#e2ecea] object-cover sm:h-24 sm:w-24"
          />
        ) : (
          <span className="h-20 w-20 shrink-0 rounded-xl bg-[#edf5f3] sm:h-24 sm:w-24" />
        )}
        <span className="min-w-0 text-sm font-black text-[#014040] sm:text-base">
          {product.name}
        </span>
      </button>
      <div id={variantsId} hidden={!variantsOpen} className="mt-3 space-y-3">
        {resolved.axes
          .filter((axis) => axis.visible)
          .map((axis) => (
            <fieldset key={axis.name} className="min-w-0">
              <legend className="mb-1 text-xs font-bold text-[#014040]">
                {axis.name}
              </legend>
              <div
                className="flex gap-2 overflow-x-auto pb-2"
                aria-label={`${axis.name} variants`}
                tabIndex={0}
              >
                {axis.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={option.selected}
                    disabled={!option.enabled}
                    onClick={() =>
                      setSelections((current) => {
                        const next = { ...current };
                        if (option.selected) delete next[axis.name];
                        else next[axis.name] = option.value;
                        return next;
                      })
                    }
                    className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40 ${option.selected ? "border-[#014040] bg-[#014040] text-[#05ef28]" : "border-[#b9d0cb] text-[#014040] hover:bg-[#edf5f3]"}`}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
      </div>
      <div
        className="mt-2"
        aria-live="polite"
        data-testid="preorder-search-prices"
      >
        {pricing.length ? (
          <div className="grid max-w-sm grid-cols-2 gap-3">
            {pricing.map((entry) => (
              <div key={entry.delivery} className="flex min-w-0 flex-col gap-1">
                <PreorderDeliveryLabel delivery={entry.delivery} />
                <span className="text-sm font-black text-[#014040]">
                  {entry.uniform
                    ? formatPesewas(entry.pricePesewas)
                    : STORE_COPY.preorder.fromPrice(
                        formatPesewas(entry.pricePesewas),
                      )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-bold text-[#014040]">
            {STORE_COPY.preorder.askForPrice}
          </p>
        )}
        {variantsOpen &&
          resolved.missingAxes.length > 0 &&
          Object.keys(selections).length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Choose {resolved.missingAxes.join(" and ")} to complete your
              selection.
            </p>
          )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={chooseProduct}
          className="rounded-xl bg-[#014040] px-4 py-2 text-xs font-black text-white hover:bg-[#025656]"
        >
          {selectingComparison ? "Compare product" : "View product"}
        </button>
        {product.variantAxes.length > 0 && (
          <button
            type="button"
            aria-expanded={variantsOpen}
            aria-controls={variantsId}
            onClick={() => setVariantsOpen((open) => !open)}
            className="rounded-xl border border-[#014040] px-4 py-2 text-xs font-black text-[#014040] hover:bg-[#edf5f3]"
          >
            {variantsOpen ? "Hide variants" : "View variants"}
          </button>
        )}
      </div>
    </article>
  );
}
