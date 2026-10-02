import test from "node:test";
import assert from "node:assert/strict";
import type { CatalogueItem } from "../shared/types";
import {
  emptyLaptopFilters,
  filterLaptops,
  laptopOptions,
} from "../src/utils/laptopFilters";

const items = [
  ["Dell", "Preorder", "512GB SSD", "16GB", 500000],
  ["HP", "Preorder", "512GB SSD", "8GB", 300000],
  ["Dell", "Available", "1TB SSD", "16GB", 600000],
  ["Lenovo", "Preorder", "1TB SSD", "32GB", undefined],
].map(([brand, availability, storage, ram, pricePesewas], i) => ({
  kind: "laptop",
  itemId: String(i),
  name: `${brand} laptop`,
  pricePesewas,
  laptop: {
    brand,
    availability,
    storage,
    ram,
    model: "Model",
    processor: "Core i5",
  },
})) as CatalogueItem[];

test("laptop facets combine different parameters and allow multiple brands", () => {
  const filters = {
    ...emptyLaptopFilters(),
    selections: { availability: ["Pre-order"], brand: ["Dell", "HP"] },
  };
  assert.equal(filterLaptops(items, filters).length, 2);
  filters.selections.brand = ["Dell"];
  assert.equal(filterLaptops(items, filters).length, 1);
});
test("facet counts respect availability and brand while leaving their own options selectable", () => {
  const filters = {
    ...emptyLaptopFilters(),
    selections: {
      availability: ["Pre-order"],
      brand: ["Dell"],
      storage: ["1TB SSD"],
    },
  };
  assert.deepEqual(
    Object.fromEntries(
      laptopOptions(items, "storage", filters).map((option) => [
        option.value,
        option.count,
      ]),
    ),
    { "512GB SSD": 1, "1TB SSD": 0 },
  );
  assert.equal(filterLaptops(items, filters).length, 0);
  filters.selections.storage = ["512GB SSD"];
  assert.equal(filterLaptops(items, filters).length, 1);
});
test("price range uses catalogue prices in pesewas and excludes quote-only laptops", () => {
  assert.equal(
    filterLaptops(items, { ...emptyLaptopFilters(), from: "3000", to: "5000" })
      .length,
    2,
  );
  assert.equal(
    filterLaptops(items, { ...emptyLaptopFilters(), from: "6000", to: "3000" })
      .length,
    0,
  );
  assert.equal(filterLaptops(items, emptyLaptopFilters()).length, 4);
});
test("search combines words across laptop specs", () => {
  assert.deepEqual(
    filterLaptops(items, {
      ...emptyLaptopFilters(),
      query: "Dell 512GB i5",
    }).map((item) => item.itemId),
    ["0"],
  );
});
