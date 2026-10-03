import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Home, SearchCheck, HelpCircle, FilePlus2, ShoppingBag, SlidersHorizontal, Layers } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { useHideOnScrollDown } from '../utils/useHideOnScrollDown';
import { useResumeNavAfterBack } from '../utils/useResumeNavAfterBack';

export type NavTab = 'home' | 'find-order' | 'help' | 'request' | 'cart' | 'filters' | 'categories';

export interface NavItem {
  id: NavTab;
  label: string;
  icon: typeof Home;
}

/**
 * Replaces what the cart slot shows and does.
 *
 * The pre-order section has its own basket. It takes this slot rather than
 * adding a sixth button: the bar's geometry is built on five columns, and the
 * cart is the one destination people reach for by position. Same place, its
 * own icon, its own count — and the software cart it stands in for keeps
 * everything that was in it.
 */
export interface CartSlotOverride {
  label: string;
  count: number;
  onSelect: () => void;
}

interface CurvedNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  cartSlot?: CartSlotOverride;
  /** Which bar to render. Defaults to the software section's five. */
  items?: NavItem[];
  waitForScroll?: boolean;
  onResumeAfterBack?: () => void;
}

/*
 * Home sits in the middle and the cart at the far right: the middle of a phone
 * bar is the easiest reach with one thumb, and the cart is the one destination
 * people look for by position rather than by icon.
 */
export const SOFTWARE_NAV_ITEMS: NavItem[] = [
  { id: 'find-order', label: STORE_COPY.navigation.findOrder, icon: SearchCheck },
  { id: 'help', label: STORE_COPY.navigation.help, icon: HelpCircle },
  { id: 'home', label: STORE_COPY.navigation.home, icon: Home },
  { id: 'request', label: STORE_COPY.navigation.request, icon: FilePlus2 },
  { id: 'cart', label: STORE_COPY.navigation.cart, icon: ShoppingBag }
];

/* The pre-order tab's own bar: filters on the left, home in the middle where
   the thumb falls, its cart on the right. Three items rather than five because
   the other three destinations belong to the software section. */
export const PREORDER_NAV_ITEMS: NavItem[] = [
  { id: 'filters', label: STORE_COPY.preorder.filters.open, icon: SlidersHorizontal },
  { id: 'home', label: STORE_COPY.navigation.home, icon: Home },
  { id: 'cart', label: STORE_COPY.preorder.title, icon: ShoppingBag }
];
export const LAPTOP_NAV_ITEMS: NavItem[] = [
  { id: 'filters', label: 'Advanced filter', icon: SlidersHorizontal },
  { id: 'home', label: STORE_COPY.navigation.home, icon: Home },
  { id: 'request', label: STORE_COPY.navigation.request, icon: FilePlus2 },
];
export const HACKS_NAV_ITEMS: NavItem[] = [
  { id: 'request', label: 'Submit an issue', icon: FilePlus2 },
  { id: 'home', label: 'All Hacks', icon: Home },
  { id: 'categories', label: 'Categories', icon: Layers },
];
/* Wider and deeper than the bubble's 24px radius, so a rim of background shows
   all the way around it rather than the bubble meeting white on its flanks. */
const NOTCH_RX = 33;
const NOTCH_RY = 26;

const notchMask = (centrePercent: number) =>
  `radial-gradient(${NOTCH_RX}px ${NOTCH_RY}px at ${centrePercent}% 0px, transparent 99%, #000 100%)`;

export const CurvedNav: React.FC<CurvedNavProps> = ({
  activeTab,
  onSelectTab,
  cartSlot,
  items = SOFTWARE_NAV_ITEMS,
  waitForScroll = false,
  onResumeAfterBack,
}) => {
  /* Derived rather than fixed at five: the notch, the slider and the grid all
     have to agree on the column count, and a second hard-coded bar for the
     pre-order tab would be three copies of that arithmetic. */
  const NAV_ITEMS = items;
  const COLUMN_PERCENT = 100 / NAV_ITEMS.length;
  const reduceMotion = useReducedMotion();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Movement is the whole point of docking, so reduced motion keeps the bar put.
  const hidden = useHideOnScrollDown(!reduceMotion && !waitForScroll);
  useResumeNavAfterBack(waitForScroll, onResumeAfterBack);

  // The cart opens the header flyout rather than becoming a page, so it has a
  // slot but never reads as the active tab. Falling back to Home keeps the
  // bubble somewhere real instead of off the end of the bar.
  const foundIndex = NAV_ITEMS.findIndex((item) => item.id === activeTab);
  const activeIndex = foundIndex === -1 ? NAV_ITEMS.findIndex((item) => item.id === 'home') : foundIndex;
  const active = NAV_ITEMS[activeIndex];
  const ActiveIcon = active.icon;

  // One spring in tab-index units feeds both the bubble's transform and the
  // notch's position, so they cannot drift apart. A spring because tapping
  // through tabs quickly retargets from the current velocity rather than
  // restarting, which a tween cannot do.
  const index = useSpring(activeIndex, { duration: 0.5, bounce: 0.2 });
  // A full transform string, not Motion's `x` shorthand, which is not hardware
  // accelerated and drops frames while the browser is busy.
  const sliderTransform = useTransform(index, (value) => `translateX(${value * 100}%)`);
  const surfaceMask = useTransform(index, (value) => notchMask((value + 0.5) * COLUMN_PERCENT));

  useEffect(() => {
    if (reduceMotion) index.jump(activeIndex);
    else index.set(activeIndex);
  }, [activeIndex, index, reduceMotion]);

  // Arrow keys walk the bar, which is what a horizontal control is expected to
  // do. Tab order still works on its own.
  const onKeyDown = (event: React.KeyboardEvent, position: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = (position + delta + NAV_ITEMS.length) % NAV_ITEMS.length;
    buttonRefs.current[next]?.focus();
  };

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label={STORE_COPY.navigation.ariaLabel}
      data-docked={hidden || waitForScroll ? 'false' : 'true'}
      data-awaiting-scroll={waitForScroll}
      className="hk-nav-dock fixed inset-x-0 bottom-0 z-50 px-3 md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
    >
      <div className="relative mx-auto h-[70px] w-full max-w-[480px]">
        {/* The bar surface, with the notch punched out of it. */}
        <motion.div
          aria-hidden
          className="hk-nav-surface absolute inset-0 rounded-[24px] bg-white"
          style={{ maskImage: surfaceMask, WebkitMaskImage: surfaceMask }}
        />

        {/* Notch contents. Decoration: every label it could carry is already on
            the button underneath it. */}
        <motion.div
          aria-hidden
          style={{ transform: sliderTransform, width: `${COLUMN_PERCENT}%` }}
          className="pointer-events-none absolute left-0 top-0 h-full"
          // eslint-disable-next-line react/forbid-dom-props
        >
          <div
            className="hk-nav-bubble absolute left-1/2 flex h-[47px] w-[47px] -translate-x-1/2 items-center justify-center rounded-full"
            style={{ top: '-23px' }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={active.id}
                className="flex text-[#05ef28]"
                initial={{ opacity: 0, transform: 'scale(0.6)' }}
                animate={{ opacity: 1, transform: 'scale(1)' }}
                exit={{ opacity: 0, transform: 'scale(0.6)' }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', duration: 0.42, bounce: 0.3, delay: 0.06 }
                }
              >
                <ActiveIcon className="h-[21px] w-[21px] stroke-[2.25]" />
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>

        <div
          className="relative z-10 grid h-full"
          style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
        >
          {NAV_ITEMS.map((item, position) => {
            const isActive = position === activeIndex;
            const overridden = item.id === 'cart' && cartSlot ? cartSlot : null;
            const Icon = overridden ? ShoppingBag : item.icon;
            const label = overridden ? overridden.label : item.label;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                data-testid={`nav-btn-${item.id}`}
                ref={(node) => { buttonRefs.current[position] = node; }}
                type="button"
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => (overridden ? overridden.onSelect() : onSelectTab(item.id))}
                onKeyDown={(event) => onKeyDown(event, position)}
                className={`hk-pressable flex cursor-pointer select-none flex-col items-center justify-end gap-1 rounded-[20px] pb-3.5 ${
                  isActive ? 'text-[#014040]' : 'text-slate-500 hover:text-[#014040]'
                }`}
              >
                <span className="relative flex">
                  <Icon className="hk-nav-icon h-[18px] w-[18px] stroke-[2]" data-hidden={isActive} aria-hidden />
                  {overridden && overridden.count > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#05ef28] px-1 text-[9px] font-black text-[#014040]">
                      {overridden.count}
                    </span>
                  )}
                </span>
                <span className={`whitespace-nowrap text-[10px] leading-none tracking-tight ${isActive ? 'font-black' : 'font-medium'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <span
          aria-hidden
          className="absolute bottom-1.5 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-[#014040]/15"
        />
      </div>
    </nav>
  );
};
