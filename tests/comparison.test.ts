import test from "node:test";
import assert from "node:assert/strict";
import { addComparisonProduct } from "../src/utils/comparison";

test("laptop comparisons accept five distinct products in selection order", () => {
  let ids: string[] = [];
  for (const id of ["a", "b", "c", "d", "e"])
    ids = addComparisonProduct(ids, id);
  assert.deepEqual(ids, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(addComparisonProduct(ids, "f"), ids);
  assert.deepEqual(addComparisonProduct(["a"], "a"), ["a"]);
  assert.deepEqual(
    addComparisonProduct(
      ids.filter((id) => id !== "c"),
      "f",
    ),
    ["a", "b", "d", "e", "f"],
  );
});
