import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { CategoryCard } from './components/CategoryCard';
import { CategoryPage } from './components/CategoryPage';
import { ProductCard } from './components/ProductCard';
import { BottomNav } from './components/BottomNav';
import { FindOrderView } from './components/FindOrderView';
import { HelpHubView } from './components/HelpHubView';
import { RequestView } from './components/RequestView';
import { ProductDetailView } from './components/ProductDetailView';
import { CartView, CartItem } from './components/CartView';
import { DirectCheckoutModal } from './components/DirectCheckoutModal';
import { BrandLogo } from './components/BrandLogo';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { PaymentReturnView } from './components/PaymentReturnView';
import { AnnouncementModal, shouldShowAnnouncement } from './components/AnnouncementModal';
import { STORE_COPY } from './config/storeCopy';
import { CatalogResponse, CatalogueItem, ServiceOption, Variant } from './types';
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Layers,
  ChevronRight,
  Sparkles,
  Search,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { WhatsAppIcon } from './components/WhatsAppIcon';
import { PromotionCountdown } from './components/PromotionCountdown';

type StoreRoute =
  | { view: 'home' }
  | { view: 'category'; categoryId: string }
  | { view: 'product'; itemId: string }
  | { view: 'payment-return' };

function currentRoute(): StoreRoute {
  const path = window.location.pathname;
  if (path === '/payment/return') return { view: 'payment-return' };
  const category = path.match(/^\/category\/([^/]+)\/?$/);
  if (category) return { view: 'category', categoryId: decodeURIComponent(category[1]) };
  const product = path.match(/^\/product\/([^/]+)\/?$/);
  if (product) return { view: 'product', itemId: decodeURIComponent(product[1]) };
  return { view: 'home' };
}

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [route, setRoute] = useState<StoreRoute>(() => currentRoute());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation tab: 'home' | 'find-order' | 'help' | 'request' | 'cart'
  const [activeTab, setActiveTab] = useState<'home' | 'find-order' | 'help' | 'request' | 'cart'>('home');

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null);

  // "Featured software" filter toggle:
  // Requirement: "Show a small number of products only" and "Include a View all software control"
  const [showAllSoftware, setShowAllSoftware] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [nextSteps, setNextSteps] = useState<{ phone: string; orderId: string } | null>(null);

  // Fetch catalog from Phase 1 backend endpoint /api/catalog
  const fetchCatalogData = async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
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
      if (data.announcement && shouldShowAnnouncement(data.announcement)) {
        setAnnouncementOpen(true);
      }
    } catch (err: any) {
      console.error('[App] Failed to load catalog:', err);
      setError(err.message || 'Error connecting to catalogue service');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    window.history.replaceState({ ...(window.history.state || {}), hkScrollY: window.scrollY }, '');
    const onPopState = (event: PopStateEvent) => {
      setRoute(currentRoute());
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        window.scrollTo({ top: Number(event.state?.hkScrollY || 0) });
      }));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.replaceState({ ...(window.history.state || {}), hkScrollY: window.scrollY }, '');
    window.history.pushState({ hkPushed: true, hkScrollY: 0 }, '', path);
    setRoute(currentRoute());
    window.scrollTo({ top: 0 });
  };

  const navigateBack = (fallback: string) => {
    if (window.history.state?.hkPushed) window.history.back();
    else navigate(fallback);
  };

  // Category click handler
  const handleCategorySelect = (catId: string) => {
    setSearchQuery('');
    navigate(`/category/${encodeURIComponent(catId)}`);
  };

  // Add to cart handler. A service line carries its chosen option and the
  // quantity the customer picked; software lines behave exactly as before.
  const handleAddToCart = (
    product: CatalogueItem,
    variant?: Variant,
    selectedOs?: string,
    serviceOption?: ServiceOption,
    quantity?: number,
    bundleSelections?: Record<string, string>
  ) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) =>
          item.product.itemId === product.itemId &&
          item.variant?.variantId === variant?.variantId &&
          item.selectedOs === selectedOs &&
          item.serviceOption?.optionId === serviceOption?.optionId &&
          JSON.stringify(item.bundleSelections || {}) === JSON.stringify(bundleSelections || {})
      );
      if (existingIdx > -1) {
        const updated = [...prev];
        // The service panel sets an explicit quantity; software adds one unit.
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: serviceOption
            ? quantity ?? updated[existingIdx].quantity
            : updated[existingIdx].quantity + 1
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: `${product.itemId}-${serviceOption?.optionId || variant?.variantId || 'default'}-${selectedOs || 'std'}`,
          product,
          variant,
          selectedOs,
          quantity: quantity ?? 1,
          serviceOption,
          bundleSelections,
        }
      ];
    });
  };

  const defaultSelection = (product: CatalogueItem): Omit<CartItem, 'id' | 'product'> => {
    const variant = product.variants?.find((candidate) => candidate.latest && candidate.available) || product.variants?.find((candidate) => candidate.available);
    const bundleSelections: Record<string, string> = {};
    product.bundleContents?.forEach((entry) => { if (entry.altGroup && !bundleSelections[entry.altGroup]) bundleSelections[entry.altGroup] = entry.variantId; });
    return { variant, selectedOs: variant?.osList?.[0] || variant?.os, quantity: 1, serviceOption: product.options?.[0], bundleSelections };
  };

  const handleCardAdd = (product: CatalogueItem) => {
    const choice = defaultSelection(product);
    handleAddToCart(product, choice.variant, choice.selectedOs, choice.serviceOption, choice.quantity, choice.bundleSelections);
  };

  const handleBuyNow = (product: CatalogueItem, variant?: Variant, selectedOs?: string, serviceOption?: ServiceOption, quantity = 1, bundleSelections?: Record<string, string>) => {
    const fallback = defaultSelection(product);
    setBuyNowItem({
      id: `buy-${product.itemId}`,
      product,
      variant: variant || fallback.variant,
      selectedOs: selectedOs || fallback.selectedOs,
      serviceOption: serviceOption || fallback.serviceOption,
      quantity,
      bundleSelections: bundleSelections || fallback.bundleSelections
    });
  };

  const openProduct = (product: CatalogueItem) => navigate(`/product/${encodeURIComponent(product.itemId)}`);

  // Featured software filtering logic
  const allProducts = catalog?.products || [];
  const softwareProducts = allProducts.filter((item) => item.kind === 'product');
  const isFiltering = searchQuery.trim().length > 0;
  
  // If not filtering and not viewing all, show a curated small number of featured products (e.g. 3)
  const featuredSoftware = softwareProducts
    .filter((item) => item.featuredOrder != null)
    .sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999));
  const displayedProducts = isFiltering
    ? allProducts
    : showAllSoftware
      ? softwareProducts
      : (featuredSoftware.length ? featuredSoftware : softwareProducts).slice(0, 3);

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const landingActive = route.view === 'home' && activeTab === 'home';
  const landingRegionRef = useRef<HTMLDivElement>(null);
  const [landingPassed, setLandingPassed] = useState(false);

  useEffect(() => {
    if (!landingActive || !landingRegionRef.current) {
      setLandingPassed(false);
      return;
    }

    let debounceTimer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      const passed = !entry.isIntersecting && entry.boundingClientRect.bottom <= 72;
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => setLandingPassed(passed), 80);
    }, { threshold: 0, rootMargin: '-68px 0px 0px 0px' });

    observer.observe(landingRegionRef.current);
    return () => {
      window.clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [landingActive]);

  // Paystack returns the customer to /payment/return. The SPA serves every
  // path, so that route is handled here rather than by a router.
  if (route.view === 'payment-return') {
    return (
      <div className="min-h-screen bg-[#f7faf9] text-slate-900">
        <PaymentReturnView
          onDone={(order) => {
            window.history.replaceState({}, '', '/');
            setRoute({ view: 'home' });
            if (order) {
              setNextSteps({ phone: order.phone, orderId: order.orderId });
              setActiveTab('find-order');
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f7faf9] text-slate-900 selection:bg-[#05ef28] selection:text-[#014040]">
      {/* Clean Storefront Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) {
            if (route.view !== 'home') navigate('/');
            setActiveTab('home');
            setShowAllSoftware(true);
          }
        }}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (route.view !== 'home') navigate('/');
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        cartCount={totalCartCount}
        cartItems={cartItems}
        isLandingTransparent={landingActive && !landingPassed}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-12">
        {route.view === 'category' && (
          isLoading ? (
            <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm font-bold text-[#014040]">{STORE_COPY.catalog.loading}</div>
          ) : error ? (
            <div className="mx-auto max-w-xl px-4 py-16 text-center"><AlertCircle className="mx-auto h-10 w-10 text-rose-500" /><p className="mt-3 text-sm text-slate-700">{error}</p><button className="mt-4 rounded-xl bg-[#014040] px-4 py-2 text-xs font-bold text-white" onClick={() => fetchCatalogData()}>{STORE_COPY.catalog.retry}</button></div>
          ) : (
            <CategoryPage
              category={catalog?.categories.find((category) => category.categoryId === route.categoryId)}
              items={(catalog?.products || []).filter((item) => item.categoryId === route.categoryId)}
              onBack={() => navigateBack('/')}
              onSelectProduct={openProduct}
              onBuyNow={handleBuyNow}
              onAddToCart={handleCardAdd}
            />
          )
        )}

        {route.view === 'product' && (
          isLoading ? (
            <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm font-bold text-[#014040]">{STORE_COPY.catalog.loading}</div>
          ) : catalog?.products.find((item) => item.itemId === route.itemId) ? (
            <ProductDetailView
              product={catalog.products.find((item) => item.itemId === route.itemId)!}
              onClose={() => navigateBack(`/category/${encodeURIComponent(catalog.products.find((item) => item.itemId === route.itemId)!.categoryId)}`)}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
            />
          ) : (
            <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center"><AlertCircle className="h-12 w-12 text-[#025656]" /><h1 className="mt-4 text-2xl font-black text-[#014040]">{STORE_COPY.catalog.productNotFoundTitle}</h1><p className="mt-2 text-sm text-slate-600">{STORE_COPY.catalog.productNotFoundDescription}</p><button type="button" onClick={() => navigate('/')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white"><ArrowLeft className="h-4 w-4" />{STORE_COPY.catalog.backToBrowse}</button></div>
          )
        )}

        {/* Tab 1: Storefront Home */}
        {route.view === 'home' && activeTab === 'home' && (
          <div>
            {/* Hero Section */}
            <div ref={landingRegionRef}>
              <Hero
                desktopImageUrl={catalog?.landing?.desktopImageUrl}
                mobileImageUrl={catalog?.landing?.mobileImageUrl}
                onBrowseClick={() => {
                  const el = document.getElementById('browse-categories');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                onFindOrderClick={() => setActiveTab('find-order')}
              />
            </div>

            {catalog?.activePromotion && <div className="bg-[#014040] px-4 py-3 text-center text-sm font-black text-white"><span className="text-[#05ef28]">{catalog.activePromotion.label}</span><span className="mx-2 text-white/50">•</span><span>{catalog.activePromotion.percent}% off</span><span className="mx-2 text-white/50">•</span><PromotionCountdown endsAt={catalog.activePromotion.endsAt} className="text-[#d9ffe0]" /></div>}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
              {/* Browse by Category Section */}
              <section id="browse-categories" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#d8e7e4] pb-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-[#014040] tracking-tight">
                      Browse by Category
                    </h2>
                  </div>

                </div>

                {/* Compact Rounded Category Cards (1-col mobile, 2-col tablet, 4-col desktop) */}
                <div className="grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                  {catalog?.categories.map((cat) => (
                    <CategoryCard
                      key={cat.categoryId}
                      category={cat}
                      isSelected={false}
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
                      {searchQuery
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
                  {!isFiltering && softwareProducts.length > 3 && (
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
                      onClick={() => fetchCatalogData(searchQuery)}
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
                  <div className="grid gap-5 sm:gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
                    {displayedProducts.map((product) => (
                      <ProductCard
                        key={product.itemId}
                        product={product}
                        onSelect={openProduct}
                        onBuyNowClick={handleBuyNow}
                        onAddToCart={handleCardAdd}
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
                    href={STORE_COPY.brand.whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={STORE_COPY.brand.whatsAppAccessibleLabel}
                    className="px-6 py-3 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm shadow-md transition-all flex items-center gap-2 shrink-0"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    <span>{STORE_COPY.brand.whatsAppCta}</span>
                  </a>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Tab 2: Find my order */}
        {route.view === 'home' && activeTab === 'find-order' && <FindOrderView catalogItems={catalog?.products || []} initialPhone={nextSteps?.phone} focusOrderId={nextSteps?.orderId} />}

        {/* Tab 3: Help support hub */}
        {route.view === 'home' && activeTab === 'help' && <HelpHubView />}

        {/* Tab 4: Request software or laptop */}
        {route.view === 'home' && activeTab === 'request' && <RequestView />}

        {/* Tab 5: Cart */}
        {route.view === 'home' && activeTab === 'cart' && (
          <CartView
            items={cartItems}
            onRemoveItem={(id) => setCartItems(cartItems.filter((item) => item.id !== id))}
            onClearCart={() => setCartItems([])}
            onContinueShopping={() => setActiveTab('home')}
            onNavigateToFindOrder={() => setActiveTab('find-order')}
          />
        )}
      </main>

      {/* Persistent WhatsApp shortcut */}
      <FloatingWhatsApp />

      {announcementOpen && catalog?.announcement && (
        <AnnouncementModal announcement={catalog.announcement} onClose={() => setAnnouncementOpen(false)} />
      )}

      {buyNowItem && <DirectCheckoutModal item={buyNowItem} onClose={() => setBuyNowItem(null)} />}

      {/* Mobile Fixed Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (route.view !== 'home') navigate('/');
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
