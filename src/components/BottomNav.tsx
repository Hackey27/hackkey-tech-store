import React from 'react';
import { Home, SearchCheck, HelpCircle, FilePlus2 } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

interface BottomNavProps {
  activeTab: 'home' | 'find-order' | 'help' | 'request' | 'cart';
  onSelectTab: (tab: 'home' | 'find-order' | 'help' | 'request') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const navItems = [
    {
      id: 'home' as const,
      label: STORE_COPY.navigation.home,
      icon: Home,
    },
    {
      id: 'find-order' as const,
      label: STORE_COPY.navigation.findOrder,
      icon: SearchCheck,
    },
    {
      id: 'help' as const,
      label: STORE_COPY.navigation.help,
      icon: HelpCircle,
    },
    {
      id: 'request' as const,
      label: STORE_COPY.navigation.request,
      icon: FilePlus2,
    },
  ];

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#d8e7e4] shadow-[0_-4px_16px_rgba(1,64,64,0.06)] pb-safe"
    >
      <div className="grid grid-cols-4 items-center justify-around w-full max-w-lg mx-auto px-1 py-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center min-h-[54px] py-1 px-1 rounded-xl transition-all cursor-pointer select-none active:scale-95 ${
                isActive
                  ? 'text-[#014040] font-black'
                  : 'text-slate-500 hover:text-[#014040] font-medium'
              }`}
            >
              <div className="relative flex items-center justify-center w-7 h-7">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-115 text-[#014040] stroke-[2.5]' : 'stroke-[2]'
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#05ef28] rounded-full shadow-xs" />
                )}
              </div>
              <span
                className={`text-[11px] leading-tight tracking-tight mt-0.5 text-center truncate max-w-full ${
                  isActive ? 'text-[#014040] font-black' : 'text-slate-600'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
