import { useFilterPopover } from "../../utils/useFilterPopover";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  PreorderCategory,
  PreorderDelivery,
  PreorderProduct,
} from "../../../shared/types";
import { STORE_COPY } from "../../config/storeCopy";
import {
  EMPTY_PREORDER_FILTERS,
  PreorderFilterState,
  filterPreorderProducts,
  toggleCategoryId,
} from "../../utils/preorderFilters";
import { PreorderAdvancedPanel } from "./PreorderAdvancedPanel";
import { StoreDialog } from "../StoreDialog";
import { useBackDismiss } from "../../utils/useBackDismiss";

interface PreorderFilterStripProps {
  categories: PreorderCategory[];
  products: PreorderProduct[];
  filters: PreorderFilterState;
  onChange: (filters: PreorderFilterState) => void;
  resultCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const control =
  "flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-white/30 px-3 text-xs font-bold text-white hover:bg-white/10";
const field =
  "mt-1 w-full rounded-lg border border-[#b9d0cb] bg-white px-2 py-2 text-sm text-[#014040]";

function PriceControls({
  filters,
  onChange,
}: {
  filters: PreorderFilterState;
  onChange: (filters: PreorderFilterState) => void;
}) {
  const set = (patch: Partial<PreorderFilterState>) =>
    onChange({ ...filters, ...patch });
  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold">
        Price shown for
        <select
          className={field}
          value={filters.priceBasis}
          onChange={(event) =>
            set({ priceBasis: event.target.value as PreorderDelivery })
          }
        >
          <option value="express">
            {STORE_COPY.preorder.delivery.express}
          </option>
          <option value="two-months">
            {STORE_COPY.preorder.delivery.twoMonths}
          </option>
        </select>
      </label>
      {(
        [
          ["price-asc", "Low to high"],
          ["price-desc", "High to low"],
          ["default", "Range"],
        ] as const
      ).map(([value, label]) => (
        <label
          key={value}
          className="flex items-center gap-2 text-sm font-bold"
        >
          <input
            type="radio"
            name="preorder-price-sort"
            checked={filters.sort === value}
            onChange={() =>
              set({
                sort: value,
                ...(value === "default" ? {} : { minCedis: "", maxCedis: "" }),
              })
            }
          />
          {label}
        </label>
      ))}
      {filters.sort === "default" && (
        <div className="grid grid-cols-2 gap-2">
          {(["minCedis", "maxCedis"] as const).map((key) => (
            <label key={key} className="text-xs font-bold">
              {key === "minCedis" ? "Minimum" : "Maximum"}
              <input
                type="number"
                min="0"
                className={field}
                value={filters[key]}
                onChange={(event) => set({ [key]: event.target.value })}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export const PreorderFilterStrip: React.FC<PreorderFilterStripProps> = ({
  categories,
  products,
  filters,
  onChange,
  resultCount,
  open,
  onOpenChange,
}) => {
  const [menuName, setMenuName] = useState<
    "price" | "category" | "delivery" | null
  >(null);
  const [draft, setDraft] = useState(filters);
  const { strip, menu, anchorTo, position } = useFilterPopover(!!menuName, menuName === "price", () => setMenuName(null));
  const closeAdvanced = useBackDismiss(open, () => onOpenChange(false));
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setMenuName(null);
    }
  }, [open]);
  const toggle = (name: typeof menuName, button: HTMLButtonElement) => {
    anchorTo(button);
    setMenuName((current) => (current === name ? null : name));
  };
  const deliveryOptions = (
    state: PreorderFilterState,
    update: (filters: PreorderFilterState) => void,
  ) => (
    <div className="space-y-3">
      {(["all", "express", "two-months"] as const).map((value) => (
        <label key={value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="preorder-delivery-filter"
            checked={state.delivery === value}
            onChange={() => update({ ...state, delivery: value })}
          />
          {value === "all"
            ? "All deliveries"
            : value === "express"
              ? STORE_COPY.preorder.delivery.express
              : STORE_COPY.preorder.delivery.twoMonths}
        </label>
      ))}
    </div>
  );
  const count = filterPreorderProducts(products, categories, draft).length;
  return (
    <>
      <div
        ref={strip}
        id="preorder-filters"
        data-testid="preorder-filter-strip"
        className="hk-activation-gradient relative flex items-center gap-2 rounded-xl p-2 text-white"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["price", "Price filter"],
              ["category", "Category"],
              ["delivery", "Delivery time"],
            ] as const
          ).map(([name, label]) => (
            <button
              key={name}
              type="button"
              className={control}
              aria-expanded={menuName === name}
              onClick={(event) => toggle(name, event.currentTarget)}
            >
              {label}
              {name === "category" && filters.categoryIds.length > 0
                ? ` (${filters.categoryIds.length})`
                : ""}
              <ChevronDown className="h-3 w-3" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${control} hidden bg-white/10 md:flex`}
          onClick={() => onOpenChange(true)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Advanced
        </button>
      </div>
      <p
        data-testid="preorder-result-count"
        className="mt-2 text-xs font-bold text-[#014040]"
        aria-live="polite"
      >
        {STORE_COPY.preorder.filters.resultCount(resultCount)}
      </p>
      {menuName &&
        createPortal(
          <div
            ref={menu}
            role="dialog"
            aria-label={`${menuName} filter options`}
            style={position}
            className="fixed z-[60] max-h-[50vh] w-72 overflow-y-auto rounded-xl border border-[#b9d0cb] bg-white p-4 text-[#014040] shadow-xl"
          >
            {menuName === "price" ? (
              <PriceControls filters={filters} onChange={onChange} />
            ) : menuName === "delivery" ? (
              deliveryOptions(filters, onChange)
            ) : (
              <div className="space-y-3">
                {categories.map((category) => (
                  <label
                    key={category.categoryId}
                    className={`flex items-center gap-2 text-sm ${category.parentId ? "pl-4" : "font-bold"}`}
                  >
                    <input
                      type="checkbox"
                      checked={filters.categoryIds.includes(
                        category.categoryId,
                      )}
                      onChange={() =>
                        onChange({
                          ...filters,
                          categoryIds: toggleCategoryId(
                            filters.categoryIds,
                            category.categoryId,
                          ),
                        })
                      }
                    />
                    {category.name}
                  </label>
                ))}
                <button
                  className="text-xs font-bold underline"
                  onClick={() => onChange({ ...filters, categoryIds: [] })}
                >
                  All categories
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
      {open && (
        <StoreDialog title="Advanced pre-order filters" close={closeAdvanced}>
          <div className="grid gap-4 sm:grid-cols-3">
            <section className="rounded-xl border border-[#b9d0cb] bg-white p-4">
              <h3 className="mb-3 font-bold">Price filter</h3>
              <PriceControls filters={draft} onChange={setDraft} />
            </section>
            <section className="rounded-xl border border-[#b9d0cb] bg-white p-4">
              <h3 className="mb-3 font-bold">Delivery time</h3>
              {deliveryOptions(draft, setDraft)}
            </section>
            <p className="text-lg font-black text-[#014040]" aria-live="polite">
              {count} results
            </p>
          </div>
          <PreorderAdvancedPanel
            categories={categories}
            products={products}
            filters={draft}
            onChange={setDraft}
          />
          <div className="sticky bottom-0 mt-6 flex flex-wrap gap-3 border-t border-[#b9d0cb] bg-[#edf5f3] py-4">
            <button
              className="rounded-xl bg-[#014040] px-5 py-3 font-bold text-white"
              onClick={() => {
                onChange(draft);
                closeAdvanced();
              }}
            >
              Show results for selection ({count})
            </button>
            <button
              className="rounded-xl border border-[#b9d0cb] bg-white px-5 py-3 font-bold text-[#014040]"
              onClick={() => setDraft(EMPTY_PREORDER_FILTERS)}
            >
              Reset selection
            </button>
          </div>
        </StoreDialog>
      )}
    </>
  );
};
