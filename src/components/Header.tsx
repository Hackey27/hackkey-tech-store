import React from 'react';
import { Search, ShoppingBag } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { STORE_COPY } from '../config/storeCopy';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTab: 'home' | 'find-order' | 'help' | 'request' | 'cart';
  onSelectTab: (tab: 'home' | 'find-order' | 'help' | 'request' | 'cart') => void;
  cartCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeTab,
  onSelectTab,
  cartCount = 0
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#e2ecea] shadow-xs">
      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Brand Logo (Replacing HK with User Logo) */}
          <div
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-3 cursor-pointer select-none shrink-0"
            title={STORE_COPY.brand.name}
          >
            {/* Full logo for screens sm and up.
                Wrapped so the display utility is not overridden by the svg's own
                base classes, which would render both logo variants at once. */}
            <span className="hidden sm:inline-block">
              <BrandLogo height={38} />
            </span>
            
            {/* Glyph + text on small mobile */}
            <div className="flex items-center gap-2 sm:hidden">
              <BrandLogo variant="glyph" height={34} />
              <div>
                <div className="font-extrabold text-base tracking-tight text-[#014040] leading-none">
                  {STORE_COPY.brand.name}
                </div>
              </div>
            </div>
          </div>

          {/* Search Field */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="q"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={STORE_COPY.brand.searchPlaceholder}
                autoComplete="off"
                className="w-full pl-10 pr-8 py-2 bg-[#f4f8f7] border border-[#d3e3e0] rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#05ef28]/40 transition-all"
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
                  ? 'bg-[#014040] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-[#edf4f3]'
              }`}
            >
              {STORE_COPY.navigation.home}
            </button>

            <button
              onClick={() => onSelectTab('find-order')}
              className={`hidden md:inline-flex px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'find-order'
                  ? 'bg-[#014040] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-[#edf4f3]'
              }`}
            >
              {STORE_COPY.navigation.findOrder}
            </button>

            <button
              onClick={() => onSelectTab('help')}
              className={`hidden md:inline-flex px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'help'
                  ? 'bg-[#014040] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-[#edf4f3]'
              }`}
            >
              {STORE_COPY.navigation.help}
            </button>

            <button
              onClick={() => onSelectTab('request')}
              className={`hidden md:inline-flex px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'request'
                  ? 'bg-[#014040] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-[#edf4f3]'
              }`}
            >
              {STORE_COPY.navigation.request}
            </button>

            {/* Cart Button (Always accessible in top header) */}
            <button
              id="header-cart-btn"
              onClick={() => onSelectTab('cart')}
              className="relative p-2.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#014040] hover:bg-[#025656] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer"
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={STORE_COPY.brand.searchPlaceholder}
              autoComplete="off"
              className="w-full pl-9 pr-8 py-2 bg-[#f4f8f7] border border-[#d3e3e0] rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]"
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
    </header>
  );
};
