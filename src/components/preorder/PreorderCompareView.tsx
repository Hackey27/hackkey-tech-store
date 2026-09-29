import React, { useMemo, useState } from 'react';
import { ArrowLeft, PackagePlus, SlidersHorizontal, X } from 'lucide-react';
import { PreorderProduct } from '../../../shared/types';
import { preorderCardPricing } from '../../../shared/preorderCombinations';
import { formatPesewas } from '../../../shared/money';
import { STORE_COPY } from '../../config/storeCopy';
import { ImageLightbox } from '../ImageLightbox';

interface PreorderCompareViewProps {
  products: PreorderProduct[];
  onRemove: (productId: string) => void;
  onBack: () => void;
  onBrowse: () => void;
  onOpenProduct: (productId: string) => void;
  /** Only ever called for a product with exactly one combination. */
  onAdd: (product: PreorderProduct) => void;
}

/**
 * Comparing pre-order products.
 *
 * DETAILS ARE NOT ALIGNED INTO SHARED ROWS. Laptops have a fixed spec sheet, so
 * a row per attribute works there. These products carry free-form label/value
 * lists written per product, and forcing them into common rows would mean
 * inventing a mapping between "Material" here and "Fabric" there — inventing
 * equivalences the seller never stated. Each column therefore labels its own
 * details, and the reader does the comparing.
 *
 * The galleries sit at the bottom and get the room, because pictures are what
 * this screen is actually for: these are goods being sourced from photographs,
 * and two of them side by side says more than any spec row.
 */
export const PreorderCompareView: React.FC<PreorderCompareViewProps> = ({
  products,
  onRemove,
  onBack,
  onBrowse,
  onOpenProduct,
  onAdd,
}) => {
  const [lightbox, setLightbox] = useState<{ images: string[]; at: number; name: string } | null>(null);

  const columns = useMemo(
    () =>
      products.map((product) => ({
        product,
        pricing: preorderCardPricing(product),
        // Same rule as the listing card: nothing left to choose means it can be
        // bought from here; anything with variants has no price until picked.
        directlyAddable: product.combinations.length === 1 && preorderCardPricing(product).length > 0,
        gallery: [product.previewImagePath, ...product.galleryImagePaths].filter(
          (path): path is string => Boolean(path)
        ),
      })),
    [products]
  );

  if (!products.length) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center">
        <SlidersHorizontal className="h-10 w-10 text-[#025656]" />
        <h1 className="mt-4 text-2xl font-black text-[#014040]">{STORE_COPY.preorder.compare.emptyTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">{STORE_COPY.preorder.compare.emptyBody}</p>
        <button
          type="button"
          onClick={onBrowse}
          className="hk-pressable mt-6 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white"
        >
          {STORE_COPY.preorder.cart.browse}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="hk-pressable mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]"
      >
        <ArrowLeft className="h-4 w-4" />
        {STORE_COPY.preorder.back}
      </button>

      <h1 className="text-2xl font-black tracking-tight text-[#014040] sm:text-3xl">
        {STORE_COPY.preorder.compare.title}
      </h1>
      <p className="mt-2 text-sm text-slate-600">{STORE_COPY.preorder.compare.lead}</p>

      {/* Columns scroll sideways on a phone rather than shrinking to slivers. */}
      <div className="mt-6 overflow-x-auto pb-3">
        <div
          data-testid="preorder-compare-grid"
          className="grid min-w-[640px] gap-4 sm:min-w-0"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map(({ product, pricing, directlyAddable, gallery }) => (
            <section
              key={product.productId}
              data-testid="preorder-compare-column"
              data-product={product.productId}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#d8e7e4] bg-white"
            >
              {/* Name, and the control that swaps this column out. */}
              <header className="flex items-start justify-between gap-2 border-b border-[#e2ecea] p-3">
                <h2 className="min-w-0 text-sm font-black leading-snug text-[#014040]">{product.name}</h2>
                <button
                  type="button"
                  data-testid={`preorder-compare-remove-${product.productId}`}
                  aria-label={STORE_COPY.preorder.compare.remove(product.name)}
                  onClick={() => onRemove(product.productId)}
                  className="hk-pressable shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Both prices. */}
              <div className="space-y-0.5 border-b border-[#edf4f3] p-3">
                {pricing.length ? (
                  pricing.map((entry) => (
                    <div key={entry.delivery} className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {entry.delivery === 'express'
                          ? STORE_COPY.preorder.delivery.express
                          : STORE_COPY.preorder.delivery.twoMonths}
                      </span>
                      <span className="text-sm font-black text-[#014040]">
                        {entry.uniform
                          ? formatPesewas(entry.pricePesewas)
                          : STORE_COPY.preorder.fromPrice(formatPesewas(entry.pricePesewas))}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs font-black text-[#025656]">{STORE_COPY.preorder.askForPrice}</span>
                )}
              </div>

              {/* Then the way to buy it. */}
              <div className="border-b border-[#edf4f3] p-3">
                <button
                  type="button"
                  data-testid={directlyAddable ? 'preorder-compare-add' : 'preorder-compare-choose'}
                  onClick={() => (directlyAddable ? onAdd(product) : onOpenProduct(product.productId))}
                  className={`hk-pressable flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-black sm:text-xs ${
                    directlyAddable
                      ? 'bg-[#05ef28] text-[#014040] hover:bg-[#04d824]'
                      : 'border border-[#014040] text-[#014040] hover:bg-[#edf5f3]'
                  }`}
                >
                  {directlyAddable ? <PackagePlus className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
                  {directlyAddable ? STORE_COPY.preorder.addToPreorder : STORE_COPY.preorder.chooseOptions}
                </button>
              </div>

              {/* Then this product's own details, under its own labels. */}
              <div className="border-b border-[#edf4f3] p-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {STORE_COPY.preorder.details}
                </h3>
                {product.details.length ? (
                  <dl className="mt-2 space-y-1.5">
                    {product.details.map((detail) => (
                      <div key={detail.label}>
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {detail.label}
                        </dt>
                        <dd className="text-xs text-slate-700">{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">{STORE_COPY.preorder.compare.noDetails}</p>
                )}
              </div>

              {/* And the gallery last, with the room it deserves. */}
              <div className="mt-auto p-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {STORE_COPY.preorder.compare.gallery}
                </h3>
                {gallery.length ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {gallery.slice(0, 6).map((path, index) => (
                      <button
                        key={path}
                        type="button"
                        data-testid="preorder-compare-image"
                        onClick={() => setLightbox({ images: gallery, at: index, name: product.name })}
                        className="hk-pressable aspect-square cursor-zoom-in overflow-hidden rounded-xl border border-[#d8e7e4] bg-[#edf5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#014040]"
                      >
                        <img src={path} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">{STORE_COPY.preorder.compare.noGallery}</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* The same viewer the rest of the section uses. */}
      <ImageLightbox
        images={lightbox?.images || []}
        openAt={lightbox ? lightbox.at : null}
        onClose={() => setLightbox(null)}
        alt={(index) => `${lightbox?.name || ''} image ${index + 1}`}
      />
    </div>
  );
};
