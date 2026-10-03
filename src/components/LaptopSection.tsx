import { laptopItemUrl, resolveLaptopListing } from '../../shared/laptopVariants';
import { laptopTwoInOneStatus } from '../../shared/laptopTouchSpecs';
import { LaptopDeliveryPrices } from "./LaptopDeliveryPrices";
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CatalogueItem, Category } from "../../shared/types";
import { formatPesewas } from "../../shared/money";
import { STORE_COPY } from "../config/storeCopy";
import {
  emptyLaptopFilters,
  filterLaptops,
  LAPTOP_FACETS,
  LaptopFacet,
  LaptopFilters,
  laptopOptions,
  sortLaptops,
} from "../utils/laptopFilters";
import { StoreDialog as Dialog } from "./StoreDialog";
import { LaptopFilterStrip } from "./LaptopFilterStrip";
import { ProductCard } from "./ProductCard";
import { ProductDetailView } from "./ProductDetailView";
import { ImageLightbox } from "./ImageLightbox";
import { renderableProductImageUrl } from "./ProductImage";
import { QuoteRequestForm } from "./QuoteRequestForm";
import { useBackDismiss } from "../utils/useBackDismiss";
import { SearchResultsOverlay } from "./SearchResultsOverlay";
import { addComparisonProduct, MAX_COMPARISON_PRODUCTS } from "../utils/comparison";

const button =
  "rounded-xl border border-[#b9d0cb] bg-white px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]";
const input =
  "w-full rounded-lg border border-[#b9d0cb] bg-white px-3 py-2 text-sm text-[#014040]";
const specs = [
  ["brand", "Brand"],
  ["model", "Model"],
  ["processor", "Processor"],
  ["ram", "RAM"],
  ["storage", "Storage"],
  ["screen", "Screen size"],
  ["touchscreen", "Touchscreen"],
  ["twoInOne", "2-in-1"],
  ["graphics", "Graphics"],
  ["graphicsDetails", "Graphics details"],
  ["operatingSystem", "Operating system"],
  ["colour", "Colour"],
  ["ports", "Ports"],
  ["freebies", "Freebies included"],
  ["availability", "Availability"],
] as const;

export function LaptopSection({
  items,
  category,
  productId,
  variantRowId,
  onAddToCart,
  onOpen,
  onBack,
  searchQuery,
  onSearchClose,
  advancedOpen,
  onAdvancedOpenChange,
}: {
  items: CatalogueItem[];
  category?: Category;
  productId?: string;
  variantRowId?: string | null;
  onAddToCart?: (item: CatalogueItem) => void;
  onOpen: (item: CatalogueItem) => void;
  onBack: () => void;
  searchQuery: string;
  onSearchClose: () => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
}) {
  const [filters, setFilters] = useState<LaptopFilters>(emptyLaptopFilters);
  const [draft, setDraft] = useState<LaptopFilters>(emptyLaptopFilters);
  const advanced = advancedOpen;
  const setAdvanced = onAdvancedOpenChange;
  const [selected, setSelected] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [gallery, setGallery] = useState<CatalogueItem | null>(null);
  const [interest, setInterest] = useState<CatalogueItem | null>(null);
  const [pastHeader, setPastHeader] = useState(false);
  const header = useRef<HTMLElement>(null);
  const closeAdvanced = useBackDismiss(advanced, () => setAdvanced(false));
  const closeInterest = useBackDismiss(!!interest, () => setInterest(null));
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) =>
        setPastHeader(
          !entry.isIntersecting && entry.boundingClientRect.bottom < 120,
        ),
      { rootMargin: "-120px 0px 0px 0px" },
    );
    if (header.current) observer.observe(header.current);
    return () => observer.disconnect();
  }, [productId, selected.length, picking]);
  const activeFilters = { ...filters, query: searchQuery };
  const results = sortLaptops(filterLaptops(items, activeFilters), filters.sort);
  useEffect(() => { if (advanced) setDraft({ ...filters, query: searchQuery }); }, [advanced]);
  const chosen = selected
    .map((id) => items.find((item) => item.itemId === id))
    .filter((item): item is CatalogueItem => !!item);
  const toggle = (
    state: LaptopFilters,
    key: LaptopFacet,
    value: string,
  ): LaptopFilters => {
    const old = state.selections[key] || [];
    return {
      ...state,
      selections: {
        ...state.selections,
        [key]: old.includes(value)
          ? old.filter((v) => v !== value)
          : [...old, value],
      },
    };
  };
  const facet = (
    key: LaptopFacet,
    label: string,
    state: LaptopFilters,
    change: (state: LaptopFilters) => void,
  ) => (
    <fieldset
      key={key}
      className="min-w-0 rounded-xl border border-[#b9d0cb] bg-white p-3 text-[#014040]"
    >
      <legend className="px-1 text-xs font-black">{label}</legend>
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {laptopOptions(items, key, state).map(({ value, count }) => (
          <label key={value} className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={state.selections[key]?.includes(value) || false}
              onChange={() => change(toggle(state, key, value))}
              className="mt-0.5 accent-[#014040]"
            />
            <span className="flex-1">{value}</span>
            <span
              aria-label={`${count} matching laptops`}
              className="font-bold"
            >
              {count}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  const prices = (
    state: LaptopFilters,
    change: (state: LaptopFilters) => void,
  ) => (
    <fieldset className="col-span-2 min-w-0 xl:col-span-1">
      <legend className="mb-1 text-xs font-bold">Price range (₵)</legend>
      <div className="flex gap-2">
        {(["from", "to"] as const).map((key) => (
          <label key={key} className="min-w-0 flex-1 text-xs">
            {key === "from" ? "Minimum" : "Maximum"}
            <input
              className={input}
              type="number"
              min="0"
              value={state[key]}
              onChange={(e) => change({ ...state, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
  const start = (item: CatalogueItem) => {
    setSelected([item.itemId]);
    setPicking(true);
    window.scrollTo({ top: 0 });
  };
  const remove = (id: string) => {
    const remaining = selected.filter((value) => value !== id);
    setSelected(remaining);
    if (remaining.length < 2) setPicking(remaining.length > 0);
  };
  const pick = (item: CatalogueItem) => {
    setSelected((old) =>
      addComparisonProduct(old, item.itemId),
    );
    setPicking(false);
    window.scrollTo({ top: 0 });
  };
  const [localRow, setLocalRow] = useState<string | null | undefined>(variantRowId);
  useEffect(() => setLocalRow(variantRowId), [productId, variantRowId]);
  const product = resolveLaptopListing(items, productId, localRow);
  const changeVariant = (rowId: string) => {
    const next = resolveLaptopListing(items, productId, rowId);
    if (!next) return;
    window.history.replaceState(window.history.state, '', laptopItemUrl(next));
    setLocalRow(rowId);
  };
  const comparison = (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-[#b9d0cb] bg-white" tabIndex={0} aria-label="Comparison laptops">
      <table
        className="w-full table-fixed border-collapse text-xs sm:text-sm"
        style={{
          minWidth:
            chosen.length > 2 ? `${chosen.length * 280 + 110}px` : undefined,
        }}
      >
        <thead>
          <tr>
            {chosen.length > 2 && (
              <th className="w-28 p-2 text-left">Specifications</th>
            )}
            {chosen.map((item) => (
              <th
                key={item.itemId}
                className="relative border-l border-[#b9d0cb] p-2 pt-11 align-top"
              >
                <button
                  className="absolute right-2 top-2 rounded-lg border p-1"
                  aria-label={`Remove ${item.name} from comparison`}
                  onClick={() => remove(item.itemId)}
                >
                  <X className="h-4 w-4" />
                </button>
                {renderableProductImageUrl(
                  item.bannerImageUrl || item.imageUrl,
                ) && (
                  <img
                    src={renderableProductImageUrl(
                      item.bannerImageUrl || item.imageUrl,
                    )}
                    alt={item.name}
                    className="mb-2 aspect-video w-full rounded-lg object-cover"
                  />
                )}
                <span className="block break-words font-black">
                  {item.name}
                </span>
                <span className="block font-normal">{item.laptop?.model}</span>
                <span data-testid="laptop-comparison-price" className="mt-2 block break-words text-base font-black text-[#014040] sm:text-lg">
                  {item.pricePesewas !== undefined && item.pricePesewas > 0
                    ? formatPesewas(item.pricePesewas)
                    : STORE_COPY.product.askForPrice}
                </span>
                <LaptopDeliveryPrices item={item} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {specs.filter(([key]) => key !== "twoInOne" || chosen.some(item => item.laptop && laptopTwoInOneStatus(item.laptop))).map(([key, label]) => (
            <tr key={key} className="border-t border-[#b9d0cb]">
              {chosen.length > 2 && (
                <th className="p-3 text-left font-bold">{label}</th>
              )}
              {chosen.map((item, index) => (
                <td
                  key={item.itemId}
                  className="border-l border-[#b9d0cb] p-2 align-top"
                >
                  {chosen.length === 2 ? (
                    <div
                      className={`flex gap-2 ${index === 0 ? "" : "flex-row-reverse"}`}
                    >
                      {(key !== 'twoInOne' || (item.laptop && laptopTwoInOneStatus(item.laptop))) && <span className="w-2/5 break-words text-[10px] font-bold text-slate-500 sm:text-xs">
                        {label}
                      </span>}
                      <span
                        className={`flex-1 break-words ${index === 0 ? "text-right" : "text-left"}`}
                      >
                        {(key === "twoInOne" ? item.laptop && laptopTwoInOneStatus(item.laptop) : item.laptop?.[key]) || "—"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center">
                      {chosen.length === 1 && (
                        <span className="mr-2 font-bold">{label}</span>
                      )}
                      {(key === "twoInOne" ? item.laptop && laptopTwoInOneStatus(item.laptop) : item.laptop?.[key]) || "—"}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-[#b9d0cb]">
            {chosen.length > 2 && <td />}
            {chosen.map((item) => (
              <td key={item.itemId} className="border-l border-[#b9d0cb] p-2">
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    className={button}
                    disabled={!item.screenshots?.length}
                    onClick={() => setGallery(item)}
                  >
                    See pictures
                  </button>
                  <button className={button} onClick={() => setInterest(item)}>
                    I am interested
                  </button>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
  const catalogue = (
    <div className="min-w-0">
      <header
        ref={header}
        className="hk-category-title hk-activation-gradient relative rounded-3xl p-6 text-white sm:p-9"
      >
        <span className="hk-category-pattern-fade" aria-hidden="true"><span className="hk-category-solid-pattern" /></span>
        <h1 className="relative text-2xl font-black sm:text-4xl">
          {category?.name || "Laptops on sale"}
        </h1>
        <p className="relative mt-3">
          {category?.tagline || "Find a laptop that fits your needs."}
        </p>
        <p className="relative mt-3 text-sm">{items.length} laptops</p>
      </header>
      <LaptopFilterStrip items={items} filters={activeFilters} onChange={setFilters} sticky={pastHeader} onAdvanced={() => setAdvanced(true)} />
      <p className="mt-3 text-xs font-bold text-[#014040]" aria-live="polite">{results.length} results</p>
      {picking && (
        <p className="mt-4 font-bold text-[#014040]">
          Choose a laptop to compare
          {chosen.length ? " with your selection" : ""}.
        </p>
      )}
      <div className="mt-6 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        {results
          .filter((item) => !picking || !selected.includes(item.itemId))
          .map((item) => (
            <ProductCard
              key={item.itemId}
              product={item}
              onSelect={picking ? pick : onOpen}
              onBuyNowClick={() => setInterest(item)}
              onInterestClick={() => setInterest(item)}
              onCompare={picking ? pick : start}
              showCategoryLabel={false}
            />
          ))}
      </div>
      {results.length === 0 && (
        <p className="py-12 text-center text-slate-600">
          No laptops match your selection.{" "}
          <button
            className={button}
            onClick={() => setFilters(emptyLaptopFilters())}
          >
            Reset selection
          </button>
        </p>
      )}
    </div>
  );
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {product ? (
        <>
          <button
            className={button}
            onClick={() => {
              onBack();
              start(product);
            }}
          >
            Compare laptop
          </button>
          <ProductDetailView product={product} onClose={onBack} onLaptopVariantChange={changeVariant} onAddToCart={onAddToCart} />
        </>
      ) : (
        <>
          {chosen.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-3">
              <h2 className="mr-auto text-xl font-black text-[#014040]">
                Scroll left and right to see comparison products
              </h2>
              <button
                className={`${button} disabled:cursor-not-allowed disabled:opacity-50`}
                disabled={selected.length >= MAX_COMPARISON_PRODUCTS}
                title={selected.length >= MAX_COMPARISON_PRODUCTS ? "Compare up to 5 laptops. Remove one to choose another." : undefined}
                onClick={() => {
                  setPicking(true);
                  window.scrollTo({ top: 0 });
                }}
              >
                Add laptop
              </button>
              <button
                className={button}
                onClick={() => {
                  setSelected([]);
                  setPicking(false);
                }}
              >
                End comparison
              </button>
            </div>
          )}
          {chosen.length ? (
            picking ? (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div className="hidden lg:sticky lg:top-24 lg:block">
                  {comparison}
                </div>
                {catalogue}
              </div>
            ) : (
              comparison
            )
          ) : (
            catalogue
          )}
        </>
      )}
      <SearchResultsOverlay
        query={searchQuery}
        items={results.filter((item) => !picking || !selected.includes(item.itemId))}
        loading={false}
        onClose={onSearchClose}
        onSelect={(item) => { onSearchClose(); (picking ? pick : onOpen)(item); }}
      />
      {advanced && (
        <Dialog title="Advanced laptop filters" close={closeAdvanced}>
          <div className="mb-5 flex flex-wrap items-end gap-4">
            {prices(draft, setDraft)}
            <p className="text-lg font-black text-[#014040]" aria-live="polite">
              {filterLaptops(items, draft).length} results
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LAPTOP_FACETS.map(([key, label]) =>
              facet(key, label, draft, setDraft),
            )}
          </div>
          <div className="sticky bottom-0 mt-6 flex flex-wrap gap-3 border-t border-[#b9d0cb] bg-[#edf5f3] py-4">
            <button
              className="rounded-xl bg-[#014040] px-5 py-3 font-bold text-white"
              onClick={() => {
                setFilters(draft);
                closeAdvanced();
              }}
            >
              Show results for selection ({filterLaptops(items, draft).length})
            </button>
            <button
              className={button}
              onClick={() => setDraft({ ...emptyLaptopFilters(), query: searchQuery })}
            >
              Reset selection
            </button>
          </div>
        </Dialog>
      )}
      {interest && (
        <Dialog title={interest.name} close={closeInterest}>
          <div className="mx-auto max-w-lg rounded-2xl bg-white p-6">
            <QuoteRequestForm key={interest.itemId} item={interest} />
          </div>
        </Dialog>
      )}
      <ImageLightbox
        images={(gallery?.screenshots || [])
          .map(renderableProductImageUrl)
          .filter((url): url is string => !!url)}
        openAt={gallery ? 0 : null}
        onClose={() => setGallery(null)}
        alt={(index) => `${gallery?.name} picture ${index + 1}`}
      />
    </div>
  );
}
