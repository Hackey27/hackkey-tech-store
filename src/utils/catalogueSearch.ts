import type { CatalogueItem } from '../types';

function searchableText(item: CatalogueItem): string {
  const laptop = item.laptop;
  return [
    item.name,
    item.description,
    item.categoryId,
    item.categoryName,
    item.kind,
    ...(item.osList || []),
    ...(item.variants || []).flatMap((variant) => [variant.versionOrPlan, variant.os, ...(variant.osList || [])]),
    ...(item.bundleContents || []).flatMap((entry) => [entry.productName, entry.versionOrPlan, entry.altLabel]),
    laptop?.brand,
    laptop?.model,
    laptop?.processor,
    laptop?.ram,
    laptop?.storage,
    laptop?.graphics,
    laptop?.graphicsDetails,
    item.service?.tagline
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchCatalogue(items: CatalogueItem[], query: string): CatalogueItem[] {
  const tokens = query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return items;
  return items.filter((item) => {
    const haystack = searchableText(item);
    return tokens.every((token) => haystack.includes(token));
  });
}
