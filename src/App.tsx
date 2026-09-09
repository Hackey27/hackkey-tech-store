import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CategoryCard } from './components/CategoryCard';
import { ProductCard } from './components/ProductCard';
import { CatalogResponse, BusinessCategory, Product } from './types';
import { AlertCircle, RefreshCw, Layers, Database, Sparkles, Filter, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalogData = async (cat?: BusinessCategory | 'all', search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (cat && cat !== 'all') {
        params.append('category', cat);
      }
      if (search && search.trim().length > 0) {
        params.append('q', search.trim());
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/catalog${queryString}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: Failed to fetch catalog`);
      }
      const data: CatalogResponse = await res.json();
      setCatalog(data);
    } catch (err: any) {
      console.error('[App] Failed to load catalog:', err);
      setError(err.message || 'Error connecting to catalogue service');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData(selectedCategory, searchQuery);
  }, [selectedCategory, searchQuery]);

  const handleCategorySelect = (catId: BusinessCategory) => {
    if (selectedCategory === catId) {
      setSelectedCategory('all');
    } else {
      setSelectedCategory(catId);
    }
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b1414] text-slate-100 selection:bg-[#05ef28] selection:text-[#014040]">
      {/* Top Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onResetFilters={handleResetFilters}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Phase 1 Migration Notice Banner */}
        <section className="rounded-xl bg-[#014040] border border-[#05ef28]/40 p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#05ef28] animate-pulse" />
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Hack-Key Tech Storefront Migration — Phase 1 Foundation
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-3xl">
                This foundation provides a clean, read-only catalogue architecture with server-side catalog routing and a Google Sheets data-access abstraction. Inventory records are prepared for statistical software (SmartPLS, SPSS, AMOS, NVivo, MAXQDA, Mplus, EViews), research services (Turnitin checks, data analysis, transcription), software bundles, and laptops.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2 bg-black/40 border border-[#05ef28]/40 px-3 py-2 rounded-lg text-xs">
              <Database className="w-4 h-4 text-[#05ef28]" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Data Access Layer:</span>
                <span className="text-[#05ef28] font-semibold">Google Sheets Abstraction</span>
              </div>
            </div>
          </div>
        </section>

        {/* Business Categories Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#05ef28]" />
                Business Product & Service Categories
              </h2>
              <p className="text-xs text-slate-400">
                Select a category to filter the placeholder catalog items
              </p>
            </div>

            {selectedCategory !== 'all' && (
              <button
                id="reset-category-btn"
                onClick={() => setSelectedCategory('all')}
                className="text-xs text-[#05ef28] hover:underline font-bold"
              >
                View All Categories
              </button>
            )}
          </div>

          {/* Category Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {catalog?.categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                isSelected={selectedCategory === cat.id}
                onSelect={handleCategorySelect}
              />
            ))}
          </div>
        </section>

        {/* Catalog Items Header and Active Filters */}
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#014040] pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#05ef28]" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Catalog Items (Read-Only Preview)
              </h3>
              {catalog && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#014040] text-[#05ef28] font-bold">
                  {catalog.totalProducts} {catalog.totalProducts === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Current Filter:</span>
              <span className="px-2 py-1 rounded bg-[#014040] text-white font-medium border border-[#05ef28]/30">
                {selectedCategory === 'all'
                  ? 'All Categories'
                  : catalog?.categories.find(c => c.id === selectedCategory)?.name}
              </span>
              {searchQuery && (
                <span className="px-2 py-1 rounded bg-[#014040] text-[#05ef28] font-medium border border-[#05ef28]/30">
                  Search: &quot;{searchQuery}&quot;
                </span>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 py-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="rounded-xl bg-[#0e1c1c] border border-[#014040] p-5 space-y-4 animate-pulse"
                >
                  <div className="flex justify-between">
                    <div className="h-4 bg-[#014040] rounded w-28" />
                    <div className="h-4 bg-[#014040] rounded w-20" />
                  </div>
                  <div className="h-6 bg-[#014040] rounded w-48" />
                  <div className="h-12 bg-[#014040]/60 rounded w-full" />
                  <div className="space-y-2 pt-2 border-t border-[#014040]/40">
                    <div className="h-3 bg-[#014040] rounded w-3/4" />
                    <div className="h-3 bg-[#014040] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="p-8 rounded-xl bg-rose-950/30 border border-rose-800 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <h4 className="text-base font-bold text-white">Catalogue Service Unavailable</h4>
              <p className="text-xs text-rose-200 max-w-md mx-auto">{error}</p>
              <button
                onClick={() => fetchCatalogData(selectedCategory, searchQuery)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#014040] hover:bg-[#015050] text-[#05ef28] text-xs font-bold border border-[#05ef28]/40 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Fetch
              </button>
            </div>
          )}

          {/* Empty Search Result */}
          {!isLoading && !error && catalog?.products.length === 0 && (
            <div className="py-12 rounded-xl bg-[#0e1c1c] border border-[#014040] text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-500 mx-auto" />
              <h4 className="text-base font-bold text-slate-200">No matching items found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No items match your active search term &quot;{searchQuery}&quot;. Clear the search filter to display available items.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-lg bg-[#014040] text-[#05ef28] text-xs font-bold border border-[#05ef28]/40 hover:bg-[#015050]"
              >
                Reset All Filters
              </button>
            </div>
          )}

          {/* Product Cards Grid */}
          {!isLoading && !error && catalog && catalog.products.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {catalog.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-[#014040] bg-[#071010] py-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#05ef28] text-[#014040] font-black text-xs flex items-center justify-center">
              HK
            </div>
            <span className="font-bold text-white">Hack-Key Tech</span>
            <span className="text-slate-500">•</span>
            <span>Software Fulfilment Platform Migration Foundation</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Phase 1: Read-Only</span>
            <span>•</span>
            <span>Google Sheets Abstraction</span>
            <span>•</span>
            <span className="text-[#05ef28]">Node + React Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
