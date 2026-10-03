import { refreshLaptopCart } from './utils/laptopCart';
import { laptopItemUrl } from '../shared/laptopVariants';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { CategoryCard } from './components/CategoryCard';
import { LaptopSection } from './components/LaptopSection';
import { CategoryPage } from './components/CategoryPage';
import { ProductCard } from './components/ProductCard';
import { CurvedNav, PREORDER_NAV_ITEMS, LAPTOP_NAV_ITEMS, HACKS_NAV_ITEMS } from './components/CurvedNav';
import { useScrollReveal } from './utils/useScrollReveal';
import { FindOrderView } from './components/FindOrderView';
import { HelpHubView } from './components/HelpHubView';
import { RequestView } from './components/RequestView';
import { ProductDetailView } from './components/ProductDetailView';
import { CartView, CartItem } from './components/CartView';
import { CheckoutModal } from './components/CheckoutModal';
import { BrandLogo } from './components/BrandLogo';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { PaymentReturnView } from './components/PaymentReturnView';
import { AnnouncementModal, shouldShowAnnouncement } from './components/AnnouncementModal';
import { STORE_COPY } from './config/storeCopy';
import { CatalogResponse, CatalogueItem, PublicPaymentOptions, ServiceOption, Variant } from '../shared/types';
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Layers,
  ChevronRight,
  Search,
  PackageCheck
} from 'lucide-react';
import { PromotionCountdown } from './components/PromotionCountdown';
import { SearchResultsOverlay } from './components/SearchResultsOverlay';
import { searchCatalogue } from './utils/catalogueSearch';
import { fulfilmentTimeState } from './utils/fulfilmentTime';
import { cartDeliveryNotice } from './utils/cartDeliveryNotice';
import { DeliveryWindowGate } from './components/DeliveryWindowGate';
import { CardSoftwareChoice, CardChoiceRequest, availableCardChoices } from './components/CardSoftwareChoice';
import { SectionNav } from './components/SectionNav';
import { HacksSection } from './components/HacksSection';
import { SectionPlaceholder } from './components/SectionPlaceholder';
import { SECTION_TABS, SectionId, sectionForPath } from './config/sections';
import { useSectionShell } from './utils/useSectionShell';
import { PreorderSection } from './components/preorder/PreorderSection';
import { PreorderCheckoutView } from './components/preorder/PreorderCheckoutView';
import { PreorderSearchOverlay } from './components/preorder/PreorderSearchOverlay';
import { PreorderRequestView } from './components/preorder/PreorderRequestView';
import { preorderResultHref, searchPreorder } from './utils/preorderSearch';
import type { PreorderProduct } from '../shared/types';
import { usePreorderCart } from './utils/usePreorderCart';
import { usePreorderCompare } from './utils/usePreorderCompare';
import { buildSingleCombinationAddition } from './utils/preorderAdd';
import { PreorderCompareView } from './components/preorder/PreorderCompareView';

type StoreRoute =
  | { view: 'home' }
  | { view: 'category'; categoryId: string }
  | { view: 'product'; itemId: string }
  | { view: 'order-access'; orderId: string }
  | { view: 'payment-return' }
  /** The pre-order section. `productId` present means one product's page. */
  | { view: 'preorder'; productId?: string }
  | { view: 'preorder-checkout' }
  | { view: 'preorder-request' }
  | { view: 'preorder-compare' }
  | { view: 'laptop-request' }
  | { view: 'section-help'; section: 'laptops' | 'preorder' }
  /** A section with a tab but no content yet. Software and Services is never one. */
  | { view: 'section'; section: Exclude<SectionId, 'software'> };

function currentRoute(): StoreRoute {
  const path = window.location.pathname;
  const sectionHelp = path.match(/^\/(laptops|preorder)\/help\/?$/);
  if (sectionHelp) return { view: 'section-help', section: sectionHelp[1] as 'laptops' | 'preorder' };
  if (path === '/payment/return') return { view: 'payment-return' };
  if (/^\/laptops\/request\/?$/.test(path)) return { view: 'laptop-request' };
  const section = sectionForPath(path);
  if (section.id === 'preorder') {
    if (/^\/preorder\/checkout\/?$/.test(path)) return { view: 'preorder-checkout' };
    if (/^\/preorder\/request\/?$/.test(path)) return { view: 'preorder-request' };
    if (/^\/preorder\/compare\/?$/.test(path)) return { view: 'preorder-compare' };
    const preorderProduct = path.match(/^\/preorder\/([^/]+)\/?$/);
    return { view: 'preorder', productId: preorderProduct ? decodeURIComponent(preorderProduct[1]) : undefined };
  }
  if (section.id !== 'software') return { view: 'section', section: section.id };
  const category = path.match(/^\/category\/([^/]+)\/?$/);
  if (category) return { view: 'category', categoryId: decodeURIComponent(category[1]) };
  const product = path.match(/^\/product\/([^/]+)\/?$/);
  if (product) return { view: 'product', itemId: decodeURIComponent(product[1]) };
  const orderAccess = path.match(/^\/order\/([^/]+)\/?$/);
  if (orderAccess) return { view: 'order-access', orderId: decodeURIComponent(orderAccess[1]) };
  return { view: 'home' };
}

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PublicPaymentOptions | null>(null);
  const [route, setRoute] = useState<StoreRoute>(() => currentRoute());
  /* The whole pre-order section, checkout included: it drives the nav's cart
     slot, its own bottom bar, and the panel that gets out of its way. */
  const inPreorder =
    route.view === 'preorder' ||
    route.view === 'preorder-checkout' ||
    route.view === 'preorder-request' ||
    route.view === 'preorder-compare' || (route.view === 'section-help' && route.section === 'preorder');
  const inLaptops = route.view === 'laptop-request' || ((route.view === 'section' || route.view === 'section-help') && route.section === 'laptops');
  const viewingLaptop = route.view === 'product' && Boolean(catalog?.products.some(item => item.itemId === route.itemId && item.kind === 'laptop'));
  const inHacks = route.view === 'section' && route.section === 'hacks';
  const [hackBrowseRevision, setHackBrowseRevision] = useState(0);
  const hackNavTab = window.location.pathname === '/hacks/categories' ? 'categories' : window.location.pathname === '/hacks/issue' ? 'request' : 'home';
  const productDetailOpen = (route.view === 'preorder' && !!route.productId) ||
    (route.view === 'section' && route.section === 'laptops' && !!window.location.pathname.split('/')[2]);
  const [laptopAdvancedOpen, setLaptopAdvancedOpen] = useState(false);
  const [laptopBrowseRevision, setLaptopBrowseRevision] = useState(0);
  const shell = useSectionShell();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation tab: 'home' | 'find-order' | 'help' | 'request' | 'cart'
  const [activeTab, setActiveTab] = useState<'home' | 'find-order' | 'help' | 'request' | 'cart'>('home');

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  // The pre-order basket. A separate hook holding separate lines: a customer
  // can be buying a licence and pre-ordering a laptop at the same time, and
  // neither basket may empty or price the other.
  const preorderCart = usePreorderCart();
  const preorderCompare = usePreorderCompare();
  const pickingPreorder = route.view === 'preorder-compare' && (preorderCompare.picking || preorderCompare.productIds.length < 2);
  /* Starting or reopening a comparison is a navigation as well as a state
     change, so the two are kept together rather than left to each caller. */
  const compareSession = {
    ...preorderCompare,
    start: (productId: string) => { preorderCompare.start(productId); navigate('/preorder/compare'); },
    pick: (productId: string) => { preorderCompare.pick(productId); if (window.location.pathname !== '/preorder/compare') navigate('/preorder/compare'); },
    addAnother: () => { preorderCompare.addAnother(); navigate('/preorder/compare'); },
    clear: () => { preorderCompare.clear(); navigate('/preorder'); },
  };
  /* The bottom bar and listing share the advanced filter's open state. */
  const [preorderFiltersOpen, setPreorderFiltersOpen] = useState(false);
  /* Live server-priced products also feed header search and basket refreshes. */
  const [preorderProducts, setPreorderProducts] = useState<PreorderProduct[]>([]);
  /* The words that found nothing, carried into the request form. Retyping what
     you just typed is the quickest way to lose someone at this point. */
  const [requestedProductName, setRequestedProductName] = useState('');
  const preorderPriceRequest = useRef(0);
  const refreshPreorderPrices = async () => {
    const request = ++preorderPriceRequest.current;
    const response = await fetch('/api/preorder/catalogue', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not refresh preorder prices. Please try again.');
    const loaded = await response.json();
    if (request !== preorderPriceRequest.current) return;
    setPreorderProducts(loaded.products);
    preorderCart.reprice(loaded.products);
  };
  useEffect(() => {
    if (!inPreorder && !preorderCart.lines.length) return;
    let active = true;
    const refresh = () => { if (active) void refreshPreorderPrices().catch(() => undefined); };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [inPreorder, preorderCart.lines.length]);
  useEffect(() => {
    if (!inLaptops && !viewingLaptop && !cartItems.some(line => line.product.laptopVariant)) return;
    const refresh = async () => { try { const response = await fetch('/api/catalog', { cache: 'no-store' }); if (response.ok) setCatalog(await response.json()); } catch {} };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [inLaptops, viewingLaptop, cartItems.some(line => line.product.laptopVariant)]);
  useEffect(() => { if (catalog) setCartItems(lines => refreshLaptopCart(lines, catalog.products)); }, [catalog]);
  const preorderResults = useMemo(
    () => (inPreorder ? searchPreorder(preorderProducts, searchQuery) : []),
    [inPreorder, preorderProducts, searchQuery]
  );
  const [cardChoice, setCardChoice] = useState<CardChoiceRequest | null>(null);
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null);
  // A snapshot, not a live reference: submitting empties the cart, and the
  // modal must keep rendering the MoMo details and cart reference afterwards.
  const [cartCheckoutItems, setCartCheckoutItems] = useState<CartItem[] | null>(null);
  // Fades content blocks in as they come into view, once each.
  useScrollReveal();
  const [pendingBuyNowItem, setPendingBuyNowItem] = useState<CartItem | null>(null);

  // "Featured software" filter toggle:
  // Requirement: "Show a small number of products only" and "Include a View all software control"
  const [showAllSoftware, setShowAllSoftware] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const announcementHandledRef = useRef(false);
  const [nextSteps, setNextSteps] = useState<{ phone: string; orderId: string } | null>(null);
  const [requestLaunchMode, setRequestLaunchMode] = useState<'software' | 'laptop' | null>(null);

  /* The section panel's opening display floats over the top-left of the page,
     which on the pre-order listing is exactly where the filter strip's first
     controls sit. Arriving in the section closes it, so the strip is never
     half-covered on the first look. Keyed on entering the section, so a panel
     the reader opens by hand afterwards stays open. */
  useEffect(() => {
    if (inPreorder || inLaptops || inHacks) shell.close();
    if (inHacks) setCartOpen(false);
    // `shell.close` is stable and the route object is rebuilt on every
    // navigation, so this keys on the section rather than the object.
  }, [inPreorder, inLaptops, inHacks]);

  // Fetch catalog from Phase 1 backend endpoint /api/catalog
  const fetchCatalogData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/catalog');
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: Failed to fetch catalog`);
      }
      const data: CatalogResponse = await res.json();
      setCatalog(data);
      setPaymentOptions(data.paymentOptions);
      if (data.announcement && !announcementHandledRef.current && shouldShowAnnouncement(data.announcement)) {
        announcementHandledRef.current = true;
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
    void fetchCatalogData();
  }, []);

  useEffect(() => {
    const refresh = async () => {
      try {
        const response = await fetch('/api/payment-options');
        if (response.ok) setPaymentOptions(await response.json());
      } catch { /* checkout re-checks the mode server-side */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

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
    const laptopCategory = catalog?.products.some(item => item.kind === 'laptop' && item.categoryId === catId);
    navigate(laptopCategory ? '/laptops' : `/category/${encodeURIComponent(catId)}`);
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
          item.product.laptopDelivery === product.laptopDelivery &&
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
          id: `${product.itemId}-${serviceOption?.optionId || variant?.variantId || 'default'}-${selectedOs || 'std'}${product.laptopDelivery ? `-${product.laptopDelivery}` : ''}`,
          product,
          variant,
          selectedOs,
          quantity: quantity ?? 1,
          serviceOption,
          bundleSelections,
        }
      ];
    });
    setCartOpen(true);
  };

  const defaultSelection = (product: CatalogueItem): Omit<CartItem, 'id' | 'product'> => {
    const variant = product.variants?.find((candidate) => candidate.latest && candidate.available) || product.variants?.find((candidate) => candidate.available);
    const bundleSelections: Record<string, string> = {};
    product.bundleContents?.forEach((entry) => { if (entry.altGroup && !bundleSelections[entry.altGroup]) bundleSelections[entry.altGroup] = entry.variantId; });
    return { variant, selectedOs: variant?.osList?.[0] || variant?.os, quantity: 1, serviceOption: product.options?.[0], bundleSelections };
  };

  const handleCardAdd = (product: CatalogueItem) => {
    const choices = product.kind === 'product' ? availableCardChoices(product, 'add') : [];
    const choicesByOs = choices.reduce((count, variant) => count + (variant.osList?.length || 1), 0);
    if (choicesByOs > 1) {
      setCardChoice({ product, mode: 'add' });
      return;
    }
    const choice = defaultSelection(product);
    handleAddToCart(product, choice.variant, choice.selectedOs, choice.serviceOption, choice.quantity, choice.bundleSelections);
  };

  const handleCardBuy = (product: CatalogueItem) => {
    if (product.kind === 'product') {
      const choices = availableCardChoices(product, 'buy-latest');
      const systems = new Set(choices.flatMap((variant) => variant.osList?.length ? variant.osList : [variant.os || 'Windows']));
      if (systems.size > 1) { setCardChoice({ product, mode: 'buy-latest' }); return; }
    }
    handleBuyNow(product);
  };

  const handleBuyNow = (product: CatalogueItem, variant?: Variant, selectedOs?: string, serviceOption?: ServiceOption, quantity = 1, bundleSelections?: Record<string, string>) => {
    const fallback = defaultSelection(product);
    const item: CartItem = {
      id: `buy-${product.itemId}`,
      product,
      variant: variant || fallback.variant,
      selectedOs: selectedOs || fallback.selectedOs,
      serviceOption: serviceOption || fallback.serviceOption,
      quantity,
      bundleSelections: bundleSelections || fallback.bundleSelections
    };
    if (cartDeliveryNotice(item).enabled && !fulfilmentTimeState(new Date()).insideWindow) {
      setPendingBuyNowItem(item);
      return;
    }
    setBuyNowItem(item);
  };

  const openProduct = (product: CatalogueItem) => navigate(product.kind === 'laptop' ? laptopItemUrl(product) : `/product/${encodeURIComponent(product.itemId)}`);

  // Featured software filtering logic
  const allProducts = catalog?.products || [];
  const searchResults = useMemo(() => searchCatalogue(allProducts, searchQuery), [allProducts, searchQuery]);
  const softwareProducts = allProducts.filter((item) => item.kind === 'product');
  const isFiltering = searchQuery.trim().length > 0;
  
  // If not filtering and not viewing all, show a curated small number of featured products (e.g. 3)
  const featuredSoftware = softwareProducts
    .filter((item) => item.featuredOrder != null)
    .sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999));
  const displayedProducts = isFiltering
    ? searchResults
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

  const activeSection: SectionId =
    inPreorder
      ? 'preorder'
      : inLaptops ? 'laptops' : route.view === 'section'
        ? route.section
        : 'software';

  return (
    <div className="min-h-screen flex flex-col bg-[#f7faf9] text-slate-900 selection:bg-[#05ef28] selection:text-[#014040]">
      <SectionNav
        activeSection={activeSection}
        onSelectSection={(section) => {
          const tab = SECTION_TABS.find((candidate) => candidate.id === section);
          if (!tab) return;
          setSearchQuery('');
          if (tab.id === 'laptops') setLaptopBrowseRevision(revision => revision + 1);
          navigate(tab.path);
          if (tab.id === 'software') setActiveTab('home');
          // Picking a tab is the end of the panel's job. Leaving it open over
          // the section it just opened means the reader has to dismiss it
          // before they can look at what they asked for.
          shell.close();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        shell={shell}
      />

      {/* Clean Storefront Header */}
      <Header
        onToggleSections={shell.toggle}
        sectionsExpanded={shell.expanded}
        searchQuery={searchQuery}
        showFindOrder={!inLaptops && !inPreorder && !inHacks}
        navItems={inHacks ? HACKS_NAV_ITEMS : undefined}
        hideCart={inHacks}
        searchPlaceholder={inHacks ? "Search tips or steps" : inLaptops ? "Find laptop" : inPreorder ? "Search preorder products" : undefined}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (inHacks && q.trim() && window.location.pathname !== '/hacks') navigate('/hacks');
          if (inLaptops && q.trim() && window.location.pathname !== '/laptops') navigate('/laptops');
          if (route.view === 'section-help' && inPreorder && q.trim()) navigate('/preorder');
          // In the pre-order section the same box searches pre-orders, so it
          // must not bounce the customer back to the software storefront.
          if (q.trim() && !inPreorder && !inLaptops && !inHacks) {
            if (route.view !== 'home') navigate('/');
            setActiveTab('home');
            setShowAllSoftware(true);
          }
        }}
        activeTab={inHacks ? hackNavTab : inLaptops || inPreorder ? (route.view === 'section-help' ? 'help' : route.view === 'laptop-request' || route.view === 'preorder-request' ? 'request' : 'home') : route.view === 'order-access' ? 'find-order' : activeTab}
        onSelectTab={(tab) => {
          if (inHacks) {
            setSearchQuery('');
            if (tab === 'home') setHackBrowseRevision(revision => revision + 1);
            navigate(tab === 'categories' ? '/hacks/categories' : tab === 'request' ? '/hacks/issue' : '/hacks');
            return;
          }

          if ((inLaptops || inPreorder) && tab === 'help') { setSearchQuery(''); navigate(inLaptops ? '/laptops/help' : '/preorder/help'); return; }
          if (inLaptops && (tab === 'home' || tab === 'request')) { if (tab === 'home') setLaptopBrowseRevision(revision => revision + 1); setSearchQuery(''); navigate(tab === 'home' ? '/laptops' : '/laptops/request'); return; }
          if (inPreorder && (tab === 'home' || tab === 'request')) { setSearchQuery(''); if (tab === 'home') preorderCompare.clear(); else setRequestedProductName(''); navigate(tab === 'home' ? '/preorder' : '/preorder/request'); return; }
          if (tab === 'cart') { setCartOpen(true); return; }
          if (route.view !== 'home') navigate('/');
          if (tab === 'request') setRequestLaunchMode(null);
          if (tab !== 'filters' && tab !== 'categories') setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        cartCount={totalCartCount}
        cartItems={cartItems}
        onRemoveCartItem={(id) => setCartItems((current) => current.filter((item) => item.id !== id))}
        cartOpen={cartOpen}
        onCartOpenChange={setCartOpen}
        onCheckout={() => setCartCheckoutItems(cartItems)}
        isLandingTransparent={landingActive && !landingPassed}
        preorderCart={inPreorder ? {
          lines: preorderCart.lines,
          count: preorderCart.count,
          totalPesewas: preorderCart.totalPesewas,
          open: preorderCart.open,
          onOpenChange: preorderCart.setOpen,
          onRemoveLine: preorderCart.remove,
          onSetQuantity: preorderCart.setQuantity,
          onSetDelivery: preorderCart.setDelivery,
          onSubmitDetails: () => { preorderCart.setOpen(false); navigate('/preorder/checkout'); },
          onBrowse: () => { preorderCart.setOpen(false); navigate('/preorder'); },
        } : undefined}
      />

      {inPreorder ? (
        <PreorderSearchOverlay
          query={searchQuery}
          results={preorderResults.filter(result => !pickingPreorder || !preorderCompare.has(result.product.productId))}
          selectingComparison={pickingPreorder}
          loading={false}
          onClose={() => setSearchQuery('')}
          onSelect={(result) => {
            setSearchQuery('');
            if (pickingPreorder) compareSession.pick(result.product.productId);
            else navigate(preorderResultHref(result));
          }}
          onRequestProduct={() => {
            setRequestedProductName(searchQuery.trim());
            setSearchQuery('');
            navigate('/preorder/request');
          }}
        />
      ) : !inLaptops && !inHacks ? (
      <SearchResultsOverlay
        query={searchQuery}
        items={searchResults}
        loading={isLoading}
        onClose={() => setSearchQuery('')}
        onSelect={(item) => { setSearchQuery(''); openProduct(item); }}
      />
      ) : null}

      {/* Main Content Area */}
      {/* The panel overlays this rather than displacing it. Nothing on the page
          moves when it opens, closes or scrubs. */}
      <main className={`flex-1 ${productDetailOpen ? 'pb-6' : 'pb-20'} md:pb-12`}>
        {route.view === 'section-help' && <HelpHubView />}
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
              onBuyNow={handleCardBuy}
              onAddToCart={handleCardAdd}
              onInterestClick={(item) => navigate(`/product/${encodeURIComponent(item.itemId)}?interest=1`)}
              softwareItems={(catalog?.products || []).filter((item) => item.kind === 'product')}
            />
          )
        )}

        {route.view === 'product' && (
          isLoading ? (
            <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm font-bold text-[#014040]">{STORE_COPY.catalog.loading}</div>
          ) : catalog?.products.find((item) => item.itemId === route.itemId) ? (
            <ProductDetailView
              product={catalog.products.find((item) => item.itemId === route.itemId)!}
              initialInterestForm={new URLSearchParams(window.location.search).get('interest') === '1'}
              onClose={() => navigateBack(`/category/${encodeURIComponent(catalog.products.find((item) => item.itemId === route.itemId)!.categoryId)}`)}
              onAddToCart={handleAddToCart}
              onBuyNow={handleBuyNow}
            />
          ) : (
            <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center"><AlertCircle className="h-12 w-12 text-[#025656]" /><h1 className="mt-4 text-2xl font-black text-[#014040]">{STORE_COPY.catalog.productNotFoundTitle}</h1><p className="mt-2 text-sm text-slate-600">{STORE_COPY.catalog.productNotFoundDescription}</p><button type="button" onClick={() => navigate('/')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white"><ArrowLeft className="h-4 w-4" />{STORE_COPY.catalog.backToBrowse}</button></div>
          )
        )}

        {route.view === 'order-access' && <FindOrderView catalogItems={catalog?.products || []} paymentOptions={paymentOptions || undefined} sharedOrderId={route.orderId} sharedAccessToken={new URLSearchParams(window.location.search).get('access') || ''} />}

        {(route.view === 'preorder' || route.view === 'preorder-compare') && (
          <PreorderSection
            mode={route.view === 'preorder-compare' ? 'compare' : 'browse'}
            compare={compareSession}
            onAddProductToCart={(product) => {
              const addition = buildSingleCombinationAddition(product);
              if (addition) preorderCart.add(addition);
            }}
            productId={route.view === 'preorder' ? route.productId : undefined}
            onOpenProduct={(productId) => navigate(`/preorder/${encodeURIComponent(productId)}`)}
            onBack={() => navigateBack('/preorder')}
            onAdd={preorderCart.add}
            filtersOpen={preorderFiltersOpen}
            onFiltersOpenChange={setPreorderFiltersOpen}
            combinationId={new URLSearchParams(window.location.search).get('combination') || undefined}
            onProductsLoaded={setPreorderProducts}
            liveProducts={preorderProducts}
          />
        )}

        {route.view === 'preorder-request' && (
          <PreorderRequestView
            initialProductName={requestedProductName}
            onBack={() => navigateBack('/preorder')}
            onBrowse={() => navigate('/preorder')}
          />
        )}

        {route.view === 'preorder-checkout' && (
          <PreorderCheckoutView
            lines={preorderCart.lines}
            onPricesChanged={refreshPreorderPrices}
            onBack={() => navigateBack('/preorder')}
            onSubmitted={preorderCart.clear}
            onBrowse={() => navigate('/preorder')}
          />
        )}

        {route.view === 'section' && route.section === 'laptops' && (
          isLoading ? <p className="py-16 text-center">Loading laptops…</p> : error ? <div className="py-16 text-center"><p>{error}</p><button onClick={() => fetchCatalogData()}>Retry</button></div> : <LaptopSection
            key={laptopBrowseRevision}
            items={(catalog?.products || []).filter(item => item.kind === 'laptop')}
            category={catalog?.categories.find(category => (catalog.products || []).some(item => item.kind === 'laptop' && item.categoryId === category.categoryId))}
            productId={window.location.pathname.split('/')[2] ? decodeURIComponent(window.location.pathname.split('/')[2]) : undefined}
            variantRowId={new URLSearchParams(window.location.search).get('variant')} onAddToCart={handleAddToCart}
            onOpen={openProduct} onBack={() => navigateBack('/laptops')} onBrowse={() => navigate('/laptops')}
            searchQuery={searchQuery} advancedOpen={laptopAdvancedOpen} onAdvancedOpenChange={setLaptopAdvancedOpen}
            onSearchClose={() => setSearchQuery('')}
          />
        )}

        {route.view === 'laptop-request' && <RequestView initialMode="laptop" onDismiss={() => navigate('/laptops')} />}

        {inHacks && (
          <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
            <HacksSection query={searchQuery} path={window.location.pathname} navigate={navigate} browseRevision={hackBrowseRevision} />
          </div>
        )}

        {route.view === 'section' && route.section !== 'laptops' && route.section !== 'hacks' && (
          <SectionPlaceholder
            tab={SECTION_TABS.find((tab) => tab.id === route.section)!}
            onBack={() => navigateBack('/')}
          />
        )}

        {/* Tab 1: Storefront Home */}
        {route.view === 'home' && activeTab === 'home' && (
          <div>
            {/* Hero Section */}
            <div ref={landingRegionRef}>
              <Hero
                desktopImageUrl={catalog?.landing?.desktopImageUrl}
                mobileImageUrl={catalog?.landing?.mobileImageUrl}
                paymentMode={paymentOptions?.mode}
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
                  {catalog?.categories.filter(cat => !/laptop/i.test(`${cat.categoryId} ${cat.name}`) && !(catalog.products || []).some(item => item.kind === 'laptop' && item.categoryId === cat.categoryId)).map((cat) => (
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
                      onClick={() => fetchCatalogData()}
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
                        onBuyNowClick={handleCardBuy}
                        onAddToCart={handleCardAdd}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Direct request menus */}
              <section className="grid gap-4 sm:grid-cols-2">
                <button type="button" onClick={() => { setRequestLaunchMode('software'); setActiveTab('request'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-4 rounded-2xl bg-[#014040] p-6 text-left text-white shadow-sm transition hover:bg-[#025656]"><span className="rounded-2xl bg-[#05ef28] p-3 text-[#014040]"><Layers className="h-6 w-6" /></span><span><strong className="block text-lg font-black">Request software</strong><small className="mt-1 block leading-5 text-white/75">Ask for software that is not currently listed in the store.</small></span></button>
                <button type="button" onClick={() => { setRequestLaunchMode('laptop'); setActiveTab('request'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-4 rounded-2xl border border-[#7aa39b] bg-white p-6 text-left text-[#014040] shadow-sm transition hover:bg-[#edf5f3]"><span className="rounded-2xl bg-[#014040] p-3 text-[#05ef28]"><PackageCheck className="h-6 w-6" /></span><span><strong className="block text-lg font-black">Request a laptop</strong><small className="mt-1 block leading-5 text-slate-600">Tell us your budget and specifications for laptop sourcing.</small></span></button>
              </section>
            </div>
          </div>
        )}

        {/* Tab 2: Find my order */}
        {route.view === 'home' && activeTab === 'find-order' && <FindOrderView catalogItems={catalog?.products || []} paymentOptions={paymentOptions || undefined} initialPhone={nextSteps?.phone} focusOrderId={nextSteps?.orderId} />}

        {/* Tab 3: Help support hub */}
        {route.view === 'home' && activeTab === 'help' && <HelpHubView />}

        {/* Tab 4: Request software or laptop */}
        {route.view === 'home' && activeTab === 'request' && <RequestView key={requestLaunchMode || 'launcher'} initialMode={requestLaunchMode} />}

        {/* Tab 5: Cart */}
        {route.view === 'home' && activeTab === 'cart' && (
          <CartView
            items={cartItems}
            onRemoveItem={(id) => setCartItems(cartItems.filter((item) => item.id !== id))}
            onClearCart={() => setCartItems([])}
            onContinueShopping={() => setActiveTab('home')}
            onCheckout={() => setCartCheckoutItems(cartItems)}
          />
        )}
      </main>

      {/* Persistent WhatsApp shortcut */}
      <FloatingWhatsApp />

      {announcementOpen && catalog?.announcement && (
        <AnnouncementModal announcement={catalog.announcement} onClose={() => setAnnouncementOpen(false)} />
      )}

      {buyNowItem && <CheckoutModal items={[buyNowItem]} mode="buy-now" paymentOptions={paymentOptions || undefined} onClose={() => setBuyNowItem(null)} onPaymentResolved={(order) => { setBuyNowItem(null); setNextSteps({ phone: order.phone, orderId: order.orderId }); setActiveTab('find-order'); navigate('/'); }} />}
      {cartCheckoutItems?.length ? <CheckoutModal items={cartCheckoutItems} mode="cart" paymentOptions={paymentOptions || undefined} onClose={() => setCartCheckoutItems(null)} onSubmitted={() => setCartItems([])} onPaymentResolved={(order) => { setCartCheckoutItems(null); setNextSteps({ phone: order.phone, orderId: order.orderId }); setActiveTab('find-order'); navigate('/'); }} /> : null}
      {pendingBuyNowItem && <DeliveryWindowGate item={pendingBuyNowItem} onCancel={() => setPendingBuyNowItem(null)} onConfirm={() => { setBuyNowItem(pendingBuyNowItem); setPendingBuyNowItem(null); }} />}
      {cardChoice && <CardSoftwareChoice request={cardChoice} onClose={() => setCardChoice(null)} onChoose={(variant, os) => { if (cardChoice.mode === 'add') handleAddToCart(cardChoice.product, variant, os); else handleBuyNow(cardChoice.product, variant, os); }} />}

      {/* Mobile Fixed Bottom Navigation */}
      {!productDetailOpen && <CurvedNav
        // The pre-order tab gets its own three-item bar; every other section
        // keeps the software one.
        items={inHacks ? HACKS_NAV_ITEMS : inLaptops ? LAPTOP_NAV_ITEMS : inPreorder ? PREORDER_NAV_ITEMS : undefined}
        activeTab={inHacks ? hackNavTab : inLaptops ? (route.view === 'laptop-request' ? 'request' : 'home') : route.view === 'order-access' ? 'find-order' : activeTab}
        cartSlot={inPreorder ? {
          label: STORE_COPY.preorder.title,
          count: preorderCart.count,
          onSelect: () => preorderCart.setOpen(true),
        } : undefined}
        onSelectTab={(tab) => {
          if (inHacks) {
            setSearchQuery('');
            if (tab === 'home') setHackBrowseRevision(revision => revision + 1);
            navigate(tab === 'categories' ? '/hacks/categories' : tab === 'request' ? '/hacks/issue' : '/hacks');
            return;
          }

          if (inLaptops) {
            if (tab === 'filters') { shell.close(); if (window.location.pathname !== '/laptops') navigate('/laptops'); setLaptopAdvancedOpen(true); return; }
            if (tab === 'home') { setSearchQuery(''); setLaptopBrowseRevision(revision => revision + 1); setLaptopAdvancedOpen(false); navigate('/laptops'); return; }
            if (tab === 'request') { setSearchQuery(''); navigate('/laptops/request'); return; }
          }
          if (inPreorder) {
            // Advanced filters open over the preorder listing.
            if (tab === 'filters') {
              // Both want the same corner of a phone screen.
              shell.close();
              if (route.view !== 'preorder' || route.productId) navigate('/preorder');
              setPreorderFiltersOpen(true);
              return;
            }
            if (tab === 'home') {
              setSearchQuery('');
              preorderCompare.clear();
              if (route.view !== 'preorder' || route.productId) navigate('/preorder');
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }
          }
          // The cart is a flyout rather than a page, same as the header's cart
          // button. Setting it as the active tab would show an empty page.
          if (tab === 'cart') { setCartOpen(true); return; }
          if (route.view !== 'home') navigate('/');
          if (tab === 'request') setRequestLaunchMode(null);
          // 'filters' and 'cart' never become the active tab: they open a
          // panel rather than a page, and the bar falls back to Home.
          if (tab !== 'filters' && tab !== 'categories') setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />}

      {/* Storefront footer */}
      <footer className={`${route.view === 'home' && activeTab === 'home' ? '' : 'hidden md:block'} hk-brand-pattern hk-pattern-outline hk-footer-pattern relative border-t border-[#025656] bg-[#014040] pb-24 pt-9 text-xs text-white md:pb-8`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 border-b border-white/20 pb-7 md:grid-cols-3">
            <div className="space-y-3">
              <BrandLogo variant="full" textColor="#ffffff" glyphColor="#ffffff" />
              <address className="max-w-sm not-italic leading-6 text-white/80">JE/GW/042, Jeffisi, Sissala West District,<br />Upper West Region, Ghana<br /><a className="font-bold text-white hover:underline" href={`tel:${STORE_COPY.brand.phoneRaw}`}>{STORE_COPY.brand.phone}</a><br /><a className="font-bold text-white hover:underline" href="mailto:orders@hackeytech.com">orders@hackeytech.com</a></address>
            </div>
            <div className="space-y-3 md:justify-self-center">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#05ef28]">Quick Navigation</span>
              {inHacks ? <ul className="space-y-2">{HACKS_NAV_ITEMS.map(item => <li key={item.id}><button className="hover:text-[#05ef28]" onClick={() => { setSearchQuery(''); if (item.id === 'home') setHackBrowseRevision(revision => revision + 1); navigate(item.id === 'categories' ? '/hacks/categories' : item.id === 'request' ? '/hacks/issue' : '/hacks'); }}>{item.label}</button></li>)}</ul> : <ul className="space-y-2"><li><button onClick={() => { setSearchQuery(''); if (inLaptops) setLaptopBrowseRevision(revision => revision + 1); if (inPreorder) preorderCompare.clear(); navigate(inLaptops ? '/laptops' : inPreorder ? '/preorder' : '/'); setActiveTab('home'); }} className="hover:text-[#05ef28]">{STORE_COPY.navigation.home}</button></li>{!inLaptops && !inPreorder && <li><button onClick={() => { navigate('/'); setActiveTab('find-order'); }} className="hover:text-[#05ef28]">{STORE_COPY.navigation.findOrder}</button></li>}<li><button onClick={() => { setSearchQuery(''); navigate(inLaptops ? '/laptops/help' : inPreorder ? '/preorder/help' : '/'); setActiveTab('help'); }} className="hover:text-[#05ef28]">{STORE_COPY.navigation.help}</button></li><li><button onClick={() => { setSearchQuery(''); navigate(inLaptops ? '/laptops/request' : inPreorder ? '/preorder/request' : '/'); setRequestLaunchMode(null); setActiveTab('request'); }} className="hover:text-[#05ef28]">{inLaptops || inPreorder ? STORE_COPY.navigation.request : STORE_COPY.requestPage.pageTitle}</button></li></ul>}
            </div>
            <div className="space-y-5 md:justify-self-end">
              <div><span className="block text-[11px] font-bold uppercase tracking-wider text-[#05ef28]">About us</span><p className="mt-2 max-w-xs leading-5 text-white/65">More information coming soon.</p></div>
              <div><span className="block text-[11px] font-bold uppercase tracking-wider text-[#05ef28]">Our location</span><p className="mt-2 font-bold text-white">University of Cape Coast Campus</p></div>
            </div>
          </div>
          <div className="pt-4 text-[11px] text-white/65">© {new Date().getFullYear()} {STORE_COPY.brand.name}. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
