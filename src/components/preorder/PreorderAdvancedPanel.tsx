import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PreorderCategory, PreorderProduct } from '../../../shared/types';
import { STORE_COPY } from '../../config/storeCopy';
import {
  PreorderFilterState,
  derivePreorderAxisFacets,
  toggleAxisValue,
  toggleCategoryId,
} from '../../utils/preorderFilters';

interface PreorderAdvancedPanelProps {
  categories: PreorderCategory[];
  products: PreorderProduct[];
  filters: PreorderFilterState;
  onChange: (filters: PreorderFilterState) => void;
}

/**
 * The Advanced panel: the category tree, and the axes those categories share.
 *
 * Ticking a heading is understood as ticking everything filed beneath it, so a
 * parent's children are shown ticked and their own boxes stop mattering while
 * the parent is on. Doing it the other way — requiring every child to be
 * ticked individually — makes selecting a whole department a chore in exactly
 * the case it is most wanted.
 *
 * The axis facets below are not configured anywhere; they are read off the
 * products currently in scope. See `derivePreorderAxisFacets` for the two
 * rules that make them behave.
 */
export const PreorderAdvancedPanel: React.FC<PreorderAdvancedPanelProps> = ({
  categories,
  products,
  filters,
  onChange,
}) => {
  const parents = categories.filter((category) => !category.parentId);
  const childrenOf = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const facets = useMemo(
    () => derivePreorderAxisFacets(products, categories, filters),
    [products, categories, filters]
  );

  const ticked = (categoryId: string, parentId?: string) =>
    filters.categoryIds.includes(categoryId) ||
    (parentId ? filters.categoryIds.includes(parentId) : false);

  return (
    <div data-testid="preorder-advanced-panel" className="mt-3 rounded-2xl bg-black/15 p-3">
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-white/70">
            {STORE_COPY.preorder.filters.categoryTree}
          </h3>
          <ul className="space-y-1">
            {parents.map((parent) => {
              const children = childrenOf(parent.categoryId);
              const open = expanded[parent.categoryId];
              const parentTicked = filters.categoryIds.includes(parent.categoryId);
              return (
                <li key={parent.categoryId}>
                  <div className="flex items-center gap-1">
                    {children.length > 0 ? (
                      <button
                        type="button"
                        aria-label={open ? STORE_COPY.preorder.filters.collapse : STORE_COPY.preorder.filters.expand}
                        aria-expanded={Boolean(open)}
                        onClick={() =>
                          setExpanded((current) => ({ ...current, [parent.categoryId]: !current[parent.categoryId] }))
                        }
                        className="hk-pressable rounded p-0.5 text-white/70 hover:text-white"
                      >
                        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    ) : (
                      <span className="w-[18px]" aria-hidden="true" />
                    )}
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        data-testid={`preorder-cat-${parent.categoryId}`}
                        checked={parentTicked}
                        onChange={() => onChange({ ...filters, categoryIds: toggleCategoryId(filters.categoryIds, parent.categoryId) })}
                      />
                      {parent.name}
                    </label>
                  </div>

                  {open && children.length > 0 && (
                    <ul className="ml-5 mt-1 space-y-1 border-l border-white/20 pl-3">
                      {children.map((child) => (
                        <li key={child.categoryId}>
                          <label
                            className={`flex items-center gap-2 text-xs ${
                              parentTicked ? 'cursor-default text-white/55' : 'cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              data-testid={`preorder-cat-${child.categoryId}`}
                              checked={ticked(child.categoryId, parent.categoryId)}
                              // While the parent is on it already covers this
                              // child, so the box shows the truth but does
                              // nothing rather than appearing to unpick it.
                              disabled={parentTicked}
                              onChange={() => onChange({ ...filters, categoryIds: toggleCategoryId(filters.categoryIds, child.categoryId) })}
                            />
                            {child.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-white/70">
            {STORE_COPY.preorder.filters.attributes}
          </h3>
          {facets.length === 0 ? (
            <p data-testid="preorder-no-facets" className="text-[11px] leading-4 text-white/60">
              {STORE_COPY.preorder.filters.noAttributes}
            </p>
          ) : (
            <div className="space-y-3">
              {facets.map((facet) => (
                <div key={facet.name} data-testid={`preorder-facet-${facet.name}`}>
                  <p className="text-[11px] font-black">{facet.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {facet.options.map((option) => (
                      <label
                        key={option.value}
                        data-testid={`preorder-facet-${facet.name}-${option.value}`}
                        data-count={option.count}
                        className={`flex cursor-pointer items-center gap-1.5 text-xs ${
                          option.count === 0 ? 'text-white/40' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={option.selected}
                          onChange={() =>
                            onChange({ ...filters, axisValues: toggleAxisValue(filters.axisValues, facet.name, option.value) })
                          }
                        />
                        {option.value}
                        <span className="text-[10px] font-bold text-white/60">({option.count})</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
