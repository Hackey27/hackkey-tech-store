import { getRmbPricingSettings } from './rmbPricingSettings';
import { priceRmbProduct, publicRmbProduct } from '../shared/rmbPricing';
import { PreorderCatalogueResponse, PreorderProduct } from '../shared/types';
import { catalogueImageUrl } from './catalogue';
import { listPreorderCategories, listPreorderProducts } from './preorderData';

/**
 * The public pre-order catalogue: what a customer is allowed to see.
 *
 * Active products are priced using the current central settings, private
 * source costs are removed, and image paths are converted to public URLs.
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

/** Kept for existing admin save callers. Prices are now calculated on every
 * request from source products and uncached settings across Cloud Run instances. */
export function invalidatePreorderCatalogueCache(): void {}

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

  const [categories, products, settings] = await Promise.all([
    listPreorderCategories(),
    listPreorderProducts(),
    getRmbPricingSettings(),
  ]);

  const response: PreorderCatalogueResponse = {
    categories,
    products: products.map(product => withImageUrls(publicRmbProduct(priceRmbProduct(product, settings).product))),
  };

  return response;
}
