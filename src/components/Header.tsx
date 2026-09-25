import React, { useEffect, useRef, useState } from 'react';
import { Search, ShoppingBag } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { STORE_COPY } from '../config/storeCopy';
import { CartItem } from './CartView';
import { CartFlyout } from './CartFlyout';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTab: 'home' | 'find-order' | 'help' | 'request' | 'cart';
  onSelectTab: (tab: 'home' | 'find-order' | 'help' | 'request' | 'cart') => void;
  cartCount?: number;
  cartItems: CartItem[];
  onRemoveCartItem: (id: string) => void;
  isLandingTransparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeTab,
  onSelectTab,
  cartCount = 0,
  cartItems,
  onRemoveCartItem,
  isLandingTransparent = false,
}) => {
  const [cartOpen, setCartOpen] = useState(false);
  const cartButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setCartOpen(false), [activeTab]);

  const openCartPage = () => {
    setCartOpen(false);
    onSelectTab('cart');
  };

  return (
    <header className={`hk-store-header sticky top-0 z-[55] w-full border-b ${!isLandingTransparent ? 'hk-brand-pattern hk-pattern-outline hk-header-scrolled-pattern' : ''} ${
      isLandingTransparent
        ? 'border-white/20 bg-transparent shadow-none'
        : 'border-[#0b5a59] bg-[#014040] shadow-sm'
    }`}>
      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Brand Logo (Replacing HK with User Logo) */}
          <div
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none shrink-0"
            title={STORE_COPY.brand.name}
          >
            {/* Full logo for screens sm and up. */}
            <BrandLogo height={38} className="hidden sm:block" />
            
            {/* Glyph + text on small mobile */}
            <div className="flex items-center gap-2 sm:hidden">
              <BrandLogo variant="glyph" height={34} />
              <div>
                <div className="font-extrabold text-base tracking-tight text-white leading-none">
                  {STORE_COPY.brand.name}
                </div>
              </div>
            </div>
          </div>

          {/* Search Field */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#014040]/70" />
              <input
                id="q"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={STORE_COPY.brand.searchPlaceholder}
                autoComplete="off"
                className="w-full pl-10 pr-8 py-2 bg-white/90 border border-white/60 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:border-[#05ef28] focus:ring-2 focus:ring-[#05ef28]/40 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Desktop Nav Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={() => onSelectTab('home')}
              className={`hidden md:inline-flex px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-[#05ef28] text-[#014040] shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {STORE_COPY.navigation.home}
            </button>

            <button
              onClick={() => onSelectTab('find-order')}
              className={`hidden md:inline-flex px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'find-order'
                  ? 'bg-[#05ef28] text-[#014040] shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {STORE_COPY.navigation.findOrder}
            </button>

            <button
              onClick={() => onSelectTab('help')}
              className={`hidden md:inline-flex px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'help'
                  ? 'bg-[#05ef28] text-[#014040] shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {STORE_COPY.navigation.help}
            </button>

            <button
              onClick={() => onSelectTab('request')}
              className={`hidden md:inline-flex px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'request'
                  ? 'bg-[#05ef28] text-[#014040] shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              {STORE_COPY.navigation.request}
            </button>

            {/* Cart Button (Always accessible in top header) */}
            <button
              ref={cartButtonRef}
              id="header-cart-btn"
              onClick={() => setCartOpen((open) => !open)}
              aria-expanded={cartOpen}
              aria-controls="header-cart-flyout"
              aria-haspopup="dialog"
              className="relative p-2.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
              title={STORE_COPY.navigation.cart}
            >
              <ShoppingBag className="w-4 h-4 text-[#05ef28]" />
              <span className="hidden sm:inline">{STORE_COPY.navigation.cart}</span>
              {cartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#05ef28] text-[#014040] font-black text-[11px] flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-3 block sm:hidden">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#014040]/70" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={STORE_COPY.brand.searchPlaceholder}
              autoComplete="off"
              className="w-full pl-9 pr-8 py-2 bg-white/90 border border-white/60 rounded-xl text-xs text-slate-800 placeholder-slate-500 focus:outline-none focus:border-[#05ef28] focus:ring-1 focus:ring-[#05ef28]"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
      <CartFlyout
        open={cartOpen}
        items={cartItems}
        triggerRef={cartButtonRef}
        onClose={() => setCartOpen(false)}
        onCheckout={openCartPage}
        onBrowse={() => {
          setCartOpen(false);
          onSelectTab('home');
        }}
        onRemoveItem={onRemoveCartItem}
      />
    </header>
  );
};
