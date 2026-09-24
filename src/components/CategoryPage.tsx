import React from 'react';
import { ArrowLeft, PackageOpen } from 'lucide-react';
import { CatalogueItem, Category } from '../types';
import { STORE_COPY } from '../config/storeCopy';
import { ProductCard } from './ProductCard';
import { CustomBundleRequest } from './CustomBundleRequest';

interface CategoryPageProps {
  category?: Category;
  items: CatalogueItem[];
  onBack: () => void;
  onSelectProduct: (product: CatalogueItem) => void;
  onBuyNow: (product: CatalogueItem) => void;
  onAddToCart: (product: CatalogueItem) => void;
  onInterestClick?: (product: CatalogueItem) => void;
  softwareItems?: CatalogueItem[];
}

export const CategoryPage: React.FC<CategoryPageProps> = ({
  category,
  items,
  onBack,
  onSelectProduct,
  onBuyNow,
  onAddToCart,
  onInterestClick,
  softwareItems = []
}) => {
  if (!category) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <PackageOpen className="h-12 w-12 text-[#025656]" />
        <h1 className="mt-4 text-2xl font-black text-[#014040]">{STORE_COPY.catalog.categoryNotFoundTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">{STORE_COPY.catalog.categoryNotFoundDescription}</p>
        <button type="button" onClick={onBack} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white hover:bg-[#025656]">
          <ArrowLeft className="h-4 w-4" />{STORE_COPY.catalog.backToBrowse}
        </button>
      </div>
    );
  }

  const kinds = new Set(items.map((item) => item.kind));
  const countLabel = (() => {
    if (kinds.size === 1 && kinds.has('laptop')) {
      const available = items.filter((item) => !item.laptop?.availability.toLowerCase().includes('pre')).length;
      const preorder = items.length - available;
      return `${available} available${preorder ? ` · ${preorder} on pre-order` : ''}`;
    }
    const noun = kinds.size === 1 && kinds.has('service') ? 'service' : kinds.size === 1 && kinds.has('bundle') ? 'bundle' : kinds.size === 1 && kinds.has('product') ? 'software' : 'product';
    return `${items.length} ${noun}${noun === 'software' || items.length === 1 ? '' : 's'} available`;
  })();
  const showCustomBundle = kinds.has('bundle') || category.categoryId.toLowerCase().includes('bundle');

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]">
        <ArrowLeft className="h-4 w-4" />{STORE_COPY.catalog.backToBrowse}
      </button>
      <header className="hk-category-title hk-activation-gradient rounded-3xl p-6 text-white shadow-sm sm:p-9">
        <span className="hk-category-pattern-fade" aria-hidden="true"><span className="hk-category-solid-pattern" /></span>
        <h1 className="relative z-10 max-w-4xl text-2xl font-black tracking-tight sm:text-4xl">{category.name}</h1>
        {category.tagline && <p className="relative z-10 mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">{category.tagline}</p>}
        <p className="relative z-10 mt-4 text-xs font-bold text-[#d9ffe0]">{countLabel}</p>
      </header>

      {items.length > 0 ? (
        <div className="mt-7 grid gap-5 sm:gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          {items.map((item) => (
            <ProductCard key={item.itemId} product={item} showCategoryLabel={false} onSelect={onSelectProduct} onBuyNowClick={onBuyNow} onAddToCart={onAddToCart} onInterestClick={onInterestClick} />
          ))}
          {showCustomBundle && <CustomBundleRequest software={softwareItems} />}
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-[#d8e7e4] bg-white p-12 text-center text-sm text-slate-600">
          {STORE_COPY.catalog.emptyCategoryResults}
        </div>
      )}
    </div>
  );
};
