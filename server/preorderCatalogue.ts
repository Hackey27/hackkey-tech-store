import { PreorderCatalogueResponse, PreorderProduct } from '../shared/types';
import { catalogueImageUrl } from './catalogue';
import { listPreorderCategories, listPreorderProducts } from './preorderData';

/**
 * The public pre-order catalogue: what a customer is allowed to see.
 *
 * Two things happen here and nowhere else.
 *
 * INACTIVE PRODUCTS NEVER LEAVE THE SERVER. listPreorderProducts already
 * filters them, and this is the only route that reads it for a customer, so
 * an unpublished product cannot arrive in the browser and be un-hidden by
 * reading the network tab.
 *
 * IMAGE PATHS BECOME URLS. The stored documents hold bucket paths, which a
 * browser cannot load; every path is rewritten into the same signed-free
 * application URL the software catalogue uses. The field names are left alone
 * so that `resolvePreorderSelection` consumes the browser's copy and the
 * server's copy without knowing which it has — the price the customer sees and
 * the price the server later recomputes come from one function, which is the
 * whole reason that resolver lives in shared/.
 */

/** Same 60 seconds as the software catalogue, for the same reason: this
 *  changes rarely and every page load reads it. */
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  response: PreorderCatalogueResponse;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

/** Exposed so the admin portal's save can force a re-read. */
export function invalidatePreorderCatalogueCache(): void {
  cache = null;
}

/** Rewrites every image path on a product into something a browser can load. */
function withImageUrls(product: PreorderProduct): PreorderProduct {
  return {
    ...product,
    previewImagePath: catalogueImageUrl(product.previewImagePath),
    galleryImagePaths: (product.galleryImagePaths || [])
      .map((path) => catalogueImageUrl(path))
      .filter((url): url is string => Boolean(url)),
    // An assignment whose image has gone missing is dropped rather than kept
    // with an unloadable path: the resolver would then "win" it over the
    // preview image and the customer would get a broken frame instead of the
    // product's own picture.
    imageAssignments: (product.imageAssignments || [])
      .map((assignment) => ({
        ...assignment,
        imagePath: catalogueImageUrl(assignment.imagePath),
      }))
      .filter((assignment): assignment is typeof assignment & { imagePath: string } =>
        Boolean(assignment.imagePath)
      ),
  };
}

export async function getPreorderCatalogue(): Promise<PreorderCatalogueResponse> {
  if (cache && cache.expiresAt > Date.now()) return cache.response;

  const [categories, products] = await Promise.all([
    listPreorderCategories(),
    listPreorderProducts(),
  ]);

  const response: PreorderCatalogueResponse = {
    categories,
    products: products.map(withImageUrls),
  };

  cache = { response, expiresAt: Date.now() + CACHE_TTL_MS };
  return response;
}
