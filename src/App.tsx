import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { CategoryCard } from './components/CategoryCard';
import { ProductCard } from './components/ProductCard';
import { BottomNav } from './components/BottomNav';
import { FindOrderView } from './components/FindOrderView';
import { HelpHubView } from './components/HelpHubView';
import { RequestView } from './components/RequestView';
import { ProductDetailView } from './components/ProductDetailView';
import { CartView, CartItem } from './components/CartView';
import { BrandLogo } from './components/BrandLogo';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { STORE_COPY } from './config/storeCopy';
import { CatalogResponse, CatalogueItem, Variant } from './types';
import {
  AlertCircle,
  RefreshCw,
  Layers,
  ChevronRight,
  Sparkles,
  Search,
  MessageSquare,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation tab: 'home' | 'find-order' | 'help' | 'request' | 'cart'
  const [activeTab, setActiveTab] = useState<'home' | 'find-order' | 'help' | 'request' | 'cart'>('home');

  // CatalogueItem detail modal state
  const [activeDetailProduct, setActiveDetailProduct] = useState<CatalogueItem | null>(null);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // "Featured software" filter toggle:
  // Requirement: "Show a small number of products only" and "Include a View all software control"
  const [showAllSoftware, setShowAllSoftware] = useState(false);

  // Fetch catalog from Phase 1 backend endpoint /api/catalog
  const fetchCatalogData = async (cat?: string | 'all', search?: string) => {
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

  // Category click handler
  const handleCategorySelect = (catId: string) => {
    if (selectedCategory === catId) {
      setSelectedCategory('all');
    } else {
      setSelectedCategory(catId);
      setShowAllSoftware(true); // Automatically show products when filtering
    }
  };

  // Add to cart handler
  const handleAddToCart = (product: CatalogueItem, variant?: Variant, selectedOs?: string) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.product.itemId === product.itemId && item.variant?.variantId === variant?.variantId && item.selectedOs === selectedOs
      );
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          id: `${product.itemId}-${variant?.variantId || 'default'}-${selectedOs || 'std'}`,
          product,
          variant,
          selectedOs,
          quantity: 1,
        }
      ];
    });
  };

  const handleBuyNowDirect = (product: CatalogueItem) => {
    // For single-variant products, add to cart and open cart or show detail
    handleAddToCart(product, product.variants?.[0], product.osList?.[0]);
    setActiveTab('cart');
  };

  // Featured software filtering logic
  const allProducts = catalog?.products || [];
  const isFiltering = selectedCategory !== 'all' || searchQuery.trim().length > 0;
  
  // If not filtering and not viewing all, show a curated small number of featured products (e.g. 3)
  const displayedProducts = isFiltering || showAllSoftware
    ? allProducts
    : allProducts.slice(0, 3);

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#f7faf9] text-slate-900 selection:bg-[#05ef28] selection:text-[#014040]">
      {/* Clean Storefront Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) {
            setActiveTab('home');
            setShowAllSoftware(true);
          }
        }}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        cartCount={totalCartCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-12">
        {/* Tab 1: Storefront Home */}
        {activeTab === 'home' && (
          <div>
            {/* Hero Section */}
            <Hero
              onBrowseClick={() => {
                const el = document.getElementById('browse-categories');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              onFindOrderClick={() => setActiveTab('find-order')}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
              {/* Browse by Category Section */}
              <section id="browse-categories" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#d8e7e4] pb-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-[#014040] tracking-tight">
                      Browse by Category
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium">
                      Select a department to view available software, services, or hardware
                    </p>
                  </div>

                  {selectedCategory !== 'all' && (
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="text-xs font-bold text-[#014040] hover:underline cursor-pointer"
                    >
                      Clear Category Filter
                    </button>
                  )}
                </div>

                {/* Compact Rounded Category Cards (1-col mobile, 2-col tablet, 4-col desktop) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {catalog?.categories.map((cat) => (
                    <CategoryCard
                      key={cat.categoryId}
                      category={cat}
                      isSelected={selectedCategory === cat.categoryId}
                      onSelect={handleCategorySelect}
                    />
                  ))}
                </div>
              </section>

              {/* Featured Software & Products Section */}
              <section id="featured-products" className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#d8e7e4] pb-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-[#014040] tracking-tight">
                      {selectedCategory !== 'all'
                        ? catalog?.categories.find((c) => c.categoryId === selectedCategory)?.name || 'Products'
                        : searchQuery
                        ? `Search Results for "${searchQuery}"`
                        : STORE_COPY.catalog.featuredSoftware}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium">
                      {isFiltering
                        ? `Showing ${allProducts.length} items for your current selection`
                        : 'Curated selection of research software and services'}
                    </p>
                  </div>

                  {/* View all software control */}
                  {!isFiltering && allProducts.length > 3 && (
                    <button
                      id="view-all-software-btn"
                      onClick={() => setShowAllSoftware(!showAllSoftware)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-[#edf5f3] border border-[#cbdcd9] text-xs font-bold text-[#014040] shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>{showAllSoftware ? 'Show featured only' : 'View all software'}</span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAllSoftware ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                </div>

                {/* Loading Skeleton */}
                {isLoading && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="rounded-2xl bg-white border border-[#d8e7e4] p-6 space-y-4 animate-pulse"
                      >
                        <div className="flex justify-between">
                          <div className="w-14 h-14 bg-slate-200 rounded-2xl" />
                          <div className="w-24 h-5 bg-slate-200 rounded-full" />
                        </div>
                        <div className="h-6 bg-slate-200 rounded w-3/4" />
                        <div className="h-10 bg-slate-100 rounded w-full" />
                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                          <div className="h-5 bg-slate-200 rounded w-20" />
                          <div className="h-9 bg-slate-300 rounded-xl w-28" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error State */}
                {!isLoading && error && (
                  <div className="p-8 rounded-2xl bg-white border border-rose-200 text-center space-y-3 shadow-xs">
                    <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                    <h3 className="text-base font-bold text-slate-800">Unable to load catalogue items</h3>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
                    <button
                      onClick={() => fetchCatalogData(selectedCategory, searchQuery)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#014040] text-white text-xs font-bold hover:bg-[#025656] transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Loading</span>
                    </button>
                  </div>
                )}

                {/* Empty State */}
                {!isLoading && !error && displayedProducts.length === 0 && (
                  <div className="py-16 rounded-2xl bg-white border border-[#d8e7e4] text-center space-y-3 shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-[#edf5f3] text-[#014040] flex items-center justify-center mx-auto">
                      <Search className="w-6 h-6 text-[#014040]" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">No items match your search</h3>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto">
                      We couldn't find products matching &quot;{searchQuery}&quot;. You can request any unlisted software or laptop directly.
                    </p>
                    <div className="flex justify-center gap-3 pt-2">
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('all');
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                      >
                        Clear Filters
                      </button>
                      <button
                        onClick={() => setActiveTab('request')}
                        className="px-4 py-2 rounded-xl bg-[#014040] text-white text-xs font-bold hover:bg-[#025656] cursor-pointer"
                      >
                        Request Item
                      </button>
                    </div>
                  </div>
                )}

                {/* Product Cards Grid */}
                {!isLoading && !error && displayedProducts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {displayedProducts.map((product) => (
                      <ProductCard
                        key={product.itemId}
                        product={product}
                        onSelect={(prod) => setActiveDetailProduct(prod)}
                        onBuyNowClick={handleBuyNowDirect}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Assistance / Support Callout */}
              <section className="rounded-2xl bg-gradient-to-r from-[#014040] to-[#025656] text-white p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1.5 text-center md:text-left">
                    <span className="text-xs font-bold text-[#05ef28] uppercase tracking-wider">
                      Need Technical Advice?
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                      Speak with our research software specialists
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-200 max-w-xl">
                      We assist with software compatibility, machine code identification, and remote installation setup across Windows and macOS.
                    </p>
                  </div>

                  <a
                    href="https://wa.me/233542638979"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm shadow-md transition-all flex items-center gap-2 shrink-0"
                  >
                    <MessageSquare className="w-4 h-4 fill-current" />
                    <span>Chat on WhatsApp</span>
                  </a>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Tab 2: Find my order */}
        {activeTab === 'find-order' && <FindOrderView />}

        {/* Tab 3: Help support hub */}
        {activeTab === 'help' && <HelpHubView />}

        {/* Tab 4: Request software or laptop */}
        {activeTab === 'request' && <RequestView />}

        {/* Tab 5: Cart */}
        {activeTab === 'cart' && (
          <CartView
            items={cartItems}
            onRemoveItem={(id) => setCartItems(cartItems.filter((item) => item.id !== id))}
            onClearCart={() => setCartItems([])}
            onContinueShopping={() => setActiveTab('home')}
            onNavigateToFindOrder={() => setActiveTab('find-order')}
          />
        )}
      </main>

      {/* Product detail Modal */}
      {activeDetailProduct && (
        <ProductDetailView
          product={activeDetailProduct}
          onClose={() => setActiveDetailProduct(null)}
          onAddToCart={(product, variant, os) => {
            handleAddToCart(product, variant, os);
          }}
        />
      )}

      {/* Persistent WhatsApp shortcut (lower-left) */}
      <FloatingWhatsApp />

      {/* Mobile Fixed Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Clean Storefront Footer */}
      <footer className="border-t border-[#d8e7e4] bg-white py-8 text-xs text-slate-600 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-6 border-b border-[#edf4f3]">
            {/* Brand */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BrandLogo variant="full" />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {STORE_COPY.brand.tagline}
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                Quick Navigation
              </span>
              <ul className="space-y-1">
                <li>
                  <button onClick={() => setActiveTab('home')} className="hover:text-[#014040] cursor-pointer">
                    {STORE_COPY.navigation.home}
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('find-order')} className="hover:text-[#014040] cursor-pointer">
                    {STORE_COPY.navigation.findOrder}
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('help')} className="hover:text-[#014040] cursor-pointer">
                    {STORE_COPY.navigation.help}
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab('request')} className="hover:text-[#014040] cursor-pointer">
                    {STORE_COPY.requestPage.pageTitle}
                  </button>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                Support & Inquiries
              </span>
              <ul className="space-y-1">
                <li>WhatsApp: {STORE_COPY.brand.phone}</li>
                <li>Phone: {STORE_COPY.brand.phone}</li>
                <li>Email: {STORE_COPY.brand.email}</li>
              </ul>
            </div>

            {/* Payment & Security */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                Order Security
              </span>
              <p className="text-xs text-slate-500">
                Processed via secure Paystack channels. Mobile Money & Card support.
              </p>
              <div className="text-[11px] text-slate-500 font-medium">
                Accra & Kumasi, Ghana
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-400 text-[11px]">
            <span>© {new Date().getFullYear()} {STORE_COPY.brand.name}. All rights reserved.</span>
            <span>{STORE_COPY.brand.tagline}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
