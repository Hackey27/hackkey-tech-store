/** Imported software predates the admin toggle. Use its category as the
 * default instead of silently turning a missing setting into false. */
export function singleLicenceDisclaimerApplies(item: {
  kind?: string;
  categoryId?: string;
  categoryName?: string;
  showSingleLicenceDisclaimer?: boolean;
}): boolean {
  if (item.kind && item.kind !== "product") return false;
  return (
    item.showSingleLicenceDisclaimer ??
    /(data|analysis|visuali[sz]ation|design|engineering)/i.test(
      `${item.categoryId || ""} ${item.categoryName || ""}`,
    )
  );
}
