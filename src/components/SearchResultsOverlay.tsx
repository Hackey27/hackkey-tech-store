import React from 'react';
import { Search, X } from 'lucide-react';
import type { CatalogueItem } from '../types';
import { ProductImage, renderableProductImageUrl } from './ProductImage';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';

interface SearchResultsOverlayProps {
  query: string;
  items: CatalogueItem[];
  loading: boolean;
  onClose: () => void;
  onSelect: (item: CatalogueItem) => void;
}

export function SearchResultsOverlay({ query, items, loading, onClose, onSelect }: SearchResultsOverlayProps) {
  if (!query.trim()) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[116px] z-50 bg-[#002b2b]/35 px-3 py-4 backdrop-blur-md sm:top-[68px] sm:px-6" onClick={onClose}>
      <section className="hk-search-results mx-auto max-h-[calc(100vh-9rem)] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl" role="dialog" aria-modal="true" aria-label={`Search results for ${query}`} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-[#d8e7e4] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#014040]">Results for “{query}”</p>
            <p className="mt-0.5 text-xs text-slate-500">{loading ? 'Searching the store…' : `${items.length} matching ${items.length === 1 ? 'item' : 'items'}`}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#014040] hover:bg-[#edf5f3]" aria-label="Close search results"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-3 sm:p-4">
          {!loading && items.length === 0 && <div className="flex flex-col items-center px-4 py-12 text-center"><span className="rounded-2xl bg-[#edf5f3] p-3 text-[#014040]"><Search className="h-6 w-6" /></span><h2 className="mt-4 font-black text-slate-800">No matching products or services</h2><p className="mt-1 text-sm text-slate-500">Try a product name, software version, service, bundle, or laptop model.</p></div>}
          <div className="grid gap-2 sm:grid-cols-2">
            {!loading && items.map((item) => {
              const price = resolveLinePricePesewas({ item, quantity: 1 }).unitPesewas;
              const laptopBanner = item.kind === 'laptop' ? renderableProductImageUrl(item.bannerImageUrl || item.mobileBannerImageUrl || item.imageUrl) : undefined;
              const laptopMobileBanner = item.kind === 'laptop' ? renderableProductImageUrl(item.mobileBannerImageUrl || item.bannerImageUrl || item.imageUrl) : undefined;
              return <button key={`${item.kind}:${item.itemId}`} type="button" onClick={() => onSelect(item)} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#d8e7e4] bg-white p-3 text-left transition hover:border-[#014040] hover:bg-[#f6fbfa]">
                {laptopBanner ? <span className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#edf5f3]"><picture><source media="(max-width: 639px)" srcSet={laptopMobileBanner || laptopBanner} /><img src={laptopBanner} alt="" className="h-full w-full object-cover" /></picture></span> : <ProductImage name={item.name} itemId={item.itemId} imageUrl={item.imageUrl} kind={item.kind} size="md" />}
                <span className="min-w-0 flex-1"><span className="font-heading block truncate text-sm font-black text-[#014040]">{item.name}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.categoryName || item.kind}</span><span className="mt-1 block text-sm font-black text-[#025656]">{price > 0 ? formatPesewas(price) : 'Ask for price'}</span></span>
              </button>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
