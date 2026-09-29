import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { PreorderCatalogueResponse, PreorderProduct } from '../../../shared/types';
import { STORE_COPY } from '../../config/storeCopy';
import { PreorderCartAddition } from '../../utils/usePreorderCart';
import { buildSingleCombinationAddition } from '../../utils/preorderAdd';
import { PreorderListingView } from './PreorderListingView';
import { PreorderProductView } from './PreorderProductView';
import { PreorderComparePicker } from './PreorderComparePicker';
import { PreorderCompareView } from './PreorderCompareView';

interface PreorderSectionProps {
  /** Present when the path is /preorder/{productId}. */
  productId?: string;
  onOpenProduct: (productId: string) => void;
  onBack: () => void;
  onAdd: (addition: PreorderCartAddition) => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  /** From ?combination= on the current URL. */
  combinationId?: string;
  /** Lets the section hand its catalogue up for searching. */
  onProductsLoaded?: (products: PreorderProduct[]) => void;
  /** 'compare' renders the picker or the comparison instead of the listing. */
  mode: 'browse' | 'compare';
  compare: {
    productIds: string[];
    active: boolean;
    picking: boolean;
    full: boolean;
    pick: (productId: string) => void;
    remove: (productId: string) => void;
    addAnother: () => void;
    clear: () => void;
    start: (productId: string) => void;
  };
  onAddProductToCart: (product: PreorderProduct) => void;
}

/**
 * The pre-order section: its own catalogue, fetched separately.
 *
 * It is NOT merged into `/api/catalog`. That response is the software
 * storefront's, it is cached and searched as one unit, and a pre-order product
 * has a different shape entirely — axes and combinations rather than variants.
 * Folding it in would mean every software page load pays for pre-order data it
 * never renders, and the catalogue's own filters would have to learn about a
 * shape they cannot price.
 */
export const PreorderSection: React.FC<PreorderSectionProps> = ({
  productId,
  onOpenProduct,
  onBack,
  onAdd,
  filtersOpen,
  onFiltersOpenChange,
  combinationId,
  onProductsLoaded,
  mode,
  compare,
  onAddProductToCart,
}) => {
  const [catalogue, setCatalogue] = useState<PreorderCatalogueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/preorder/catalogue');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const loaded = (await response.json()) as PreorderCatalogueResponse;
      setCatalogue(loaded);
      onProductsLoaded?.(loaded.products);
    } catch (err) {
      console.error('[preorder] failed to load the catalogue:', err);
      setError(STORE_COPY.preorder.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm font-bold text-[#014040]">
        {STORE_COPY.preorder.loading}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
        <p className="mt-3 text-sm text-slate-700">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="hk-pressable mt-4 rounded-xl bg-[#014040] px-4 py-2 text-xs font-bold text-white"
        >
          {STORE_COPY.preorder.retry}
        </button>
      </div>
    );
  }

  const products = catalogue?.products || [];

  const addSingleCombination = (product: PreorderProduct) => {
    const addition = buildSingleCombinationAddition(product);
    if (addition) onAdd(addition);
  };

  if (productId) {
    const product = products.find((candidate) => candidate.productId === productId);
    if (!product) {
      return (
        <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center">
          <AlertCircle className="h-12 w-12 text-[#025656]" />
          <h1 className="mt-4 text-2xl font-black text-[#014040]">
            {STORE_COPY.preorder.notFoundTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {STORE_COPY.preorder.notFoundDescription}
          </p>
          <button
            type="button"
            onClick={onBack}
            className="hk-pressable mt-6 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {STORE_COPY.preorder.back}
          </button>
        </div>
      );
    }
    return (
      <PreorderProductView
        product={product}
        onBack={onBack}
        onAdd={onAdd}
        initialCombinationId={combinationId}
        onCompare={(chosenProduct) => compare.start(chosenProduct.productId)}
        comparing={compare.productIds.includes(product.productId)}
        canCompare={!compare.full}
      />
    );
  }

  const chosen = compare.productIds
    .map((id) => products.find((product) => product.productId === id))
    .filter((product): product is PreorderProduct => Boolean(product));

  /* The real listing, used both for browsing and as the comparison's picker.
     During a session its cards carry a compare control, and choosing one takes
     the product rather than opening its page. */
  const listing = (
    <PreorderListingView
      categories={catalogue?.categories || []}
      products={products}
      onSelectProduct={(product) =>
        compare.picking ? compare.pick(product.productId) : onOpenProduct(product.productId)
      }
      onAddProduct={addSingleCombination}
      comparedIds={compare.productIds}
      compareFull={compare.full}
      compareActive={compare.active}
      onToggleCompare={(product) => compare.pick(product.productId)}
      filtersOpen={filtersOpen}
      onFiltersOpenChange={onFiltersOpenChange}
    />
  );

  if (mode === 'compare') {
    // Fewer than two is not a comparison, so the picker stays up.
    if (compare.picking || chosen.length < 2) {
      return (
        <PreorderComparePicker
          chosen={chosen}
          onRemove={compare.remove}
          onCancel={compare.clear}
          listing={listing}
        />
      );
    }
    return (
      <PreorderCompareView
        products={chosen}
        onRemove={compare.remove}
        onBack={onBack}
        onBrowse={compare.clear}
        onOpenProduct={onOpenProduct}
        onAdd={onAddProductToCart}
        onAddAnother={compare.addAnother}
        canAddAnother={!compare.full}
      />
    );
  }

  return listing;
};
