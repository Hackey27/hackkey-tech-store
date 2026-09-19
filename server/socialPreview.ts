import type { CatalogueItem } from '../src/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(value: string, baseUrl: string): string {
  const fallback = `${baseUrl.replace(/\/+$/, '')}/landing-workspace.webp`;
  try {
    const url = new URL(value, `${baseUrl.replace(/\/+$/, '')}/`);
    if (url.hostname === 'photos.app.goo.gl' || (url.hostname === 'photos.google.com' && url.pathname.startsWith('/share'))) return fallback;
    if (url.hostname === 'drive.google.com') {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
      const id = fileMatch?.[1] || url.searchParams.get('id');
      if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

function previewDescription(item: CatalogueItem): string {
  const description = (item.description || `View ${item.name} on Hack-Key Tech Store.`)
    .replace(/\s+/g, ' ')
    .trim();
  return description.length > 200 ? `${description.slice(0, 197).trimEnd()}…` : description;
}

/** Inject crawler-readable metadata into the SPA shell for one shared item. */
export function renderProductSocialPreview(
  template: string,
  item: CatalogueItem,
  baseUrl: string,
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const productUrl = `${cleanBase}/product/${encodeURIComponent(item.itemId)}`;
  const image = absoluteUrl(
    item.bannerImageUrl
      || item.mobileBannerImageUrl
      || item.cardImageUrl
      || item.imageUrl
      || '/landing-workspace.webp',
    cleanBase,
  );
  const title = `${item.name} | Hack-Key Tech Store`;
  const description = previewDescription(item);
  const itemType = item.kind === 'service' ? 'service' : item.kind === 'laptop' ? 'laptop' : item.kind;

  const updated = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);

  const socialTags = `
    <link rel="canonical" href="${escapeHtml(productUrl)}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Hack-Key Tech Store" />
    <meta property="og:url" content="${escapeHtml(productUrl)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:alt" content="${escapeHtml(`${item.name} ${itemType} banner`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />`;

  return updated.replace('</head>', `${socialTags}\n  </head>`);
}
