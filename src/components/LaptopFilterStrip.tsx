import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { CatalogueItem } from "../../shared/types";
import {
  LAPTOP_FACETS,
  LaptopFacet,
  LaptopFilters,
  laptopOptions,
} from "../utils/laptopFilters";

const control =
  "flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-white/30 px-3 text-xs font-bold text-white hover:bg-white/10";

export function LaptopFilterStrip({
  items,
  filters,
  onChange,
  onAdvanced,
  sticky,
}: {
  items: CatalogueItem[];
  filters: LaptopFilters;
  onChange: (filters: LaptopFilters) => void;
  onAdvanced: () => void;
  sticky: boolean;
}) {
  const [open, setOpen] = useState<LaptopFacet | "price" | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const strip = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (menu.current?.contains(event.target as Node)) return;
      if (
        event.type === "pointerdown" &&
        strip.current?.contains(event.target as Node)
      )
        return;
      setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const toggle = (key: LaptopFacet | "price", button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
    });
    setOpen((old) => (old === key ? null : key));
  };
  return (
    <div
      ref={strip}
      data-testid="laptop-filter-strip"
      className={`hk-activation-gradient relative z-40 mt-4 flex items-center gap-2 rounded-xl p-2 text-white ${sticky ? "sticky top-[112px] md:top-[76px]" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          className={control}
          aria-expanded={open === "price"}
          onClick={(event) => toggle("price", event.currentTarget)}
        >
          Price filter
          <ChevronDown className="h-3 w-3" />
        </button>
        {LAPTOP_FACETS.slice(0, 4).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={control}
            aria-expanded={open === key}
            onClick={(event) => toggle(key, event.currentTarget)}
          >
            {label}
            {filters.selections[key]?.length
              ? ` (${filters.selections[key]!.length})`
              : ""}
            <ChevronDown className="h-3 w-3" />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`${control} hidden bg-white/10 md:flex`}
        onClick={() => {
          setOpen(null);
          onAdvanced();
        }}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Advanced
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="fixed z-[60] max-h-[50vh] w-72 overflow-y-auto rounded-xl border border-[#b9d0cb] bg-white p-4 text-[#014040] shadow-xl"
            style={position}
            role="dialog"
            aria-label={
              open === "price"
                ? "Price filter options"
                : `${LAPTOP_FACETS.find(([key]) => key === open)?.[1]} options`
            }
          >
            {open === "price" ? (
              <>
                <div className="space-y-2">
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
                        name="laptop-price-filter"
                        checked={(filters.sort || "default") === value}
                        onChange={() =>
                          onChange({
                            ...filters,
                            sort: value,
                            ...(value === "default"
                              ? {}
                              : { from: "", to: "" }),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {(!filters.sort || filters.sort === "default") && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(["from", "to"] as const).map((key) => (
                      <label key={key} className="text-xs font-bold">
                        {key === "from" ? "Minimum" : "Maximum"}
                        <input
                          type="number"
                          min="0"
                          value={filters[key]}
                          onChange={(event) =>
                            onChange({ ...filters, [key]: event.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-[#b9d0cb] px-2 py-2"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {laptopOptions(items, open, filters).map(({ value, count }) => (
                  <label key={value} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        filters.selections[open]?.includes(value) || false
                      }
                      onChange={() => {
                        const old = filters.selections[open] || [];
                        onChange({
                          ...filters,
                          selections: {
                            ...filters.selections,
                            [open]: old.includes(value)
                              ? old.filter((item) => item !== value)
                              : [...old, value],
                          },
                        });
                      }}
                      className="mt-1 accent-[#014040]"
                    />
                    <span className="flex-1">{value}</span>
                    <span>{count}</span>
                  </label>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
