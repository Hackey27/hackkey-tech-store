import test from "node:test";
import assert from "node:assert/strict";
import { singleLicenceDisclaimerApplies } from "../shared/licenceDisclaimer";

test("legacy software gets the licence notice without an admin flag", () => {
  for (const categoryId of ["DATA", "DESIGN", "ENGINEERING", "visualisation"]) {
    assert.equal(
      singleLicenceDisclaimerApplies({ kind: "product", categoryId }),
      true,
    );
  }
  assert.equal(
    singleLicenceDisclaimerApplies({
      kind: "product",
      categoryId: "custom",
      categoryName: "Data Analysis Software",
    }),
    true,
  );
});
test("an explicit admin setting remains authoritative", () => {
  assert.equal(
    singleLicenceDisclaimerApplies({
      kind: "product",
      categoryId: "DATA",
      showSingleLicenceDisclaimer: false,
    }),
    false,
  );
  assert.equal(
    singleLicenceDisclaimerApplies({
      kind: "product",
      categoryId: "OTHER",
      showSingleLicenceDisclaimer: true,
    }),
    true,
  );
});
test("services and laptops do not acquire software licence restrictions", () => {
  assert.equal(
    singleLicenceDisclaimerApplies({ kind: "service", categoryId: "DATA" }),
    false,
  );
  assert.equal(
    singleLicenceDisclaimerApplies({
      kind: "laptop",
      showSingleLicenceDisclaimer: true,
    }),
    false,
  );
});
