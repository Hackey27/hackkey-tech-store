import { laptopTwoInOneStatus } from '../../shared/laptopTouchSpecs';
import type { CatalogueItem, Laptop } from "../../shared/types";

export const LAPTOP_FACETS = [
  ["brand", "Brand"],
  ["availability", "Availability"],
  ["storage", "Storage size"],
  ["ram", "RAM size"],
  ["touchscreen", "Touchscreen"],
  ["twoInOne", "2-in-1"],
  ["processor", "Processor"],
  ["screen", "Screen size"],
  ["graphics", "Graphics"],
  ["graphicsDetails", "Graphics details"],
  ["operatingSystem", "Operating system"],
  ["colour", "Colour"],
  ["ports", "Ports"],
  ["freebies", "Freebies included"],
] as const;
export type LaptopFacet = (typeof LAPTOP_FACETS)[number][0];
export interface LaptopFilters {
  from: string;
  to: string;
  query: string;
  sort?: 'default' | 'price-asc' | 'price-desc';
  selections: Partial<Record<LaptopFacet, string[]>>;
}
export const emptyLaptopFilters = (): LaptopFilters => ({
  from: "",
  to: "",
  query: "",
  sort: 'default',
  selections: {},
});
export function laptopValue(laptop: Laptop, facet: LaptopFacet): string {
  if (facet === "twoInOne") return laptopTwoInOneStatus(laptop) || "";
  if (facet === "availability")
    return /pre/i.test(laptop.availability) ? "Pre-order" : "Available";
  return (laptop[facet] || "").trim();
}
/** OR within a facet, AND between facets. Counts omit their own facet so
 * additional options remain selectable while respecting every other choice. */
export function filterLaptops(
  items: CatalogueItem[],
  filters: LaptopFilters,
  omit?: LaptopFacet,
): CatalogueItem[] {
  return items.filter((item) => {
    if (!item.laptop || item.kind !== "laptop") return false;
    const price = item.pricePesewas;
    const hasFrom =
      filters.from.trim() !== "" && Number.isFinite(Number(filters.from));
    const hasTo =
      filters.to.trim() !== "" && Number.isFinite(Number(filters.to));
    if ((hasFrom || hasTo) && price === undefined) return false;
    if (hasFrom && price! < Number(filters.from) * 100) return false;
    if (hasTo && price! > Number(filters.to) * 100) return false;
    const words = filters.query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const text = [
      item.name,
      ...LAPTOP_FACETS.map(([key]) => laptopValue(item.laptop!, key)),
      item.laptop.model,
    ]
      .join(" ")
      .toLowerCase();
    if (!words.every((word) => text.includes(word))) return false;
    return LAPTOP_FACETS.every(
      ([key]) =>
        key === omit ||
        !filters.selections[key]?.length ||
        filters.selections[key]!.includes(laptopValue(item.laptop!, key)),
    );
  });
}
export function laptopOptions(
  items: CatalogueItem[],
  facet: LaptopFacet,
  filters: LaptopFilters,
) {
  const values =
    facet === "availability"
      ? ["Available", "Pre-order"]
      : [
          ...new Set(
            items
              .filter((item) => item.laptop)
              .map((item) => laptopValue(item.laptop!, facet))
              .filter(Boolean),
          ),
        ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const eligible = filterLaptops(items, filters, facet);
  return values.map((value) => ({
    value,
    count: eligible.filter((item) => laptopValue(item.laptop!, facet) === value)
      .length,
  }));
}

/** Unpriced laptops stay last in either direction. */
export function sortLaptops(items: CatalogueItem[], sort: LaptopFilters['sort']): CatalogueItem[] {
  if (!sort || sort === 'default') return items;
  return [...items].sort((a, b) => {
    if (a.pricePesewas === undefined) return b.pricePesewas === undefined ? 0 : 1;
    if (b.pricePesewas === undefined) return -1;
    return (a.pricePesewas - b.pricePesewas) * (sort === 'price-asc' ? 1 : -1);
  });
}
