import React, { useMemo, useState } from 'react';
import { PreorderCategory, PreorderProduct } from '../../../shared/types';
import { STORE_COPY } from '../../config/storeCopy';
import { PreorderCard } from './PreorderCard';

interface PreorderListingViewProps {
  categories: PreorderCategory[];
  products: PreorderProduct[];
  onSelectProduct: (product: PreorderProduct) => void;
}

/** Everything, or one category. A child category selects only itself; a parent
 *  selects itself and everything under it, which is what a customer tapping a
 *  heading expects. */
const ALL = '__all__';

export const PreorderListingView: React.FC<PreorderListingViewProps> = ({
  categories,
  products,
  onSelectProduct,
}) => {
  const [selected, setSelected] = useState<string>(ALL);

  const parents = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories]
  );

  /** The children of whichever top-level category is in play — the selected
   *  one, or the parent of the selected child, so the row does not vanish the
   *  moment a subcategory is chosen. */
  const children = useMemo(() => {
    if (selected === ALL) return [];
    const selectedCategory = categories.find((category) => category.categoryId === selected);
    const parentId = selectedCategory?.parentId || selected;
    return categories.filter((category) => category.parentId === parentId);
  }, [categories, selected]);

  const visible = useMemo(() => {
    if (selected === ALL) return products;
    const descendants = new Set([
      selected,
      ...categories
        .filter((category) => category.parentId === selected)
        .map((category) => category.categoryId),
    ]);
    return products.filter(
      (product) =>
        descendants.has(product.categoryId) ||
        (product.subcategoryId ? descendants.has(product.subcategoryId) : false)
    );
  }, [categories, products, selected]);

  const activeParent = useMemo(() => {
    if (selected === ALL) return ALL;
    const selectedCategory = categories.find((category) => category.categoryId === selected);
    return selectedCategory?.parentId || selected;
  }, [categories, selected]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-black tracking-tight text-[#014040] sm:text-4xl">
          {STORE_COPY.preorder.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
          {STORE_COPY.preorder.lead}
        </p>
        {products.length > 0 && (
          <p className="mt-4 text-xs font-bold text-[#025656]">
            {STORE_COPY.preorder.itemCount(products.length)}
          </p>
        )}
      </header>

      {parents.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex flex-wrap gap-2">
            <CategoryChip
              label={STORE_COPY.preorder.allCategories}
              active={selected === ALL}
              onClick={() => setSelected(ALL)}
            />
            {parents.map((category) => (
              <CategoryChip
                key={category.categoryId}
                label={category.name}
                active={activeParent === category.categoryId}
                onClick={() => setSelected(category.categoryId)}
              />
            ))}
          </div>
          {children.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-0.5">
              {children.map((category) => (
                <CategoryChip
                  key={category.categoryId}
                  label={category.name}
                  active={selected === category.categoryId}
                  small
                  onClick={() => setSelected(category.categoryId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {visible.length > 0 ? (
        <div className="mt-7 grid gap-5 sm:gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {visible.map((product) => (
            <PreorderCard key={product.productId} product={product} onSelect={onSelectProduct} />
          ))}
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-[#d8e7e4] bg-white p-12 text-center text-sm text-slate-600">
          {products.length ? STORE_COPY.preorder.emptyCategory : STORE_COPY.preorder.empty}
        </div>
      )}
    </div>
  );
};

const CategoryChip: React.FC<{
  label: string;
  active: boolean;
  small?: boolean;
  onClick: () => void;
}> = ({ label, active, small = false, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`hk-pressable rounded-full border font-bold ${
      small ? 'px-3 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
    } ${
      active
        ? 'border-[#014040] bg-[#014040] text-white'
        : 'border-[#d0e4e0] bg-white text-[#014040] hover:bg-[#edf5f3]'
    }`}
  >
    {label}
  </button>
);
