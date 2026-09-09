import React, { useState, useEffect } from 'react';
import { Search, Activity, Shield, RefreshCw } from 'lucide-react';
import { HealthResponse } from '../types';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onResetFilters
}) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full bg-[#014040] border-b border-[#05ef28]/30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 md:h-16 gap-3">
          {/* Brand Identity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={onResetFilters}>
              <div className="w-10 h-10 rounded-lg bg-[#05ef28] text-[#014040] flex items-center justify-center font-black text-xl shadow-md">
                HK
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg tracking-tight text-white">
                    Hack-Key Tech
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-[#05ef28] border border-[#05ef28]/40 uppercase tracking-wider">
                    Phase 1 Foundation
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 font-medium tracking-tight">
                  Software, Research Services & Hardware Catalogue
                </p>
              </div>
            </div>

            {/* Mobile health badge */}
            <div className="flex md:hidden items-center gap-1.5 text-[11px] text-[#05ef28]">
              <div className="w-2 h-2 rounded-full bg-[#05ef28] animate-pulse" />
              <span>/api/health</span>
            </div>
          </div>

          {/* Search and Server State */}
          <div className="flex items-center gap-3 flex-1 max-w-md md:justify-end">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                id="catalog-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Filter sample items, statistical tools, or services..."
                className="w-full pl-9 pr-8 py-1.5 bg-black/30 border border-[#05ef28]/40 rounded-lg text-xs text-white placeholder-slate-300 focus:outline-none focus:border-[#05ef28] focus:ring-1 focus:ring-[#05ef28] transition-all"
              />
              {searchQuery && (
                <button
                  id="clear-search-btn"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-300 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Desktop API Health Pill */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-[#05ef28]/30 shrink-0 text-xs">
              <Activity className="w-3.5 h-3.5 text-[#05ef28]" />
              <span className="text-slate-200 font-medium">API:</span>
              <span className="text-[#05ef28] font-bold">
                {health ? 'Connected' : 'Checking...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
