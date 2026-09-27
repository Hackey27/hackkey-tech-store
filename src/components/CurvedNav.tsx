import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Home, SearchCheck, HelpCircle, FilePlus2, ShoppingBag } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { useHideOnScrollDown } from '../utils/useHideOnScrollDown';

type NavTab = 'home' | 'find-order' | 'help' | 'request' | 'cart';

interface CurvedNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

/*
 * Home sits in the middle and the cart at the far right: the middle of a phone
 * bar is the easiest reach with one thumb, and the cart is the one destination
 * people look for by position rather than by icon.
 */
const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: 'find-order', label: STORE_COPY.navigation.findOrder, icon: SearchCheck },
  { id: 'help', label: STORE_COPY.navigation.help, icon: HelpCircle },
  { id: 'home', label: STORE_COPY.navigation.home, icon: Home },
  { id: 'request', label: STORE_COPY.navigation.request, icon: FilePlus2 },
  { id: 'cart', label: STORE_COPY.navigation.cart, icon: ShoppingBag }
];

const COLUMN_PERCENT = 100 / NAV_ITEMS.length;
/* Wider and deeper than the bubble's 24px radius, so a rim of background shows
   all the way around it rather than the bubble meeting white on its flanks. */
const NOTCH_RX = 33;
const NOTCH_RY = 26;

const notchMask = (centrePercent: number) =>
  `radial-gradient(${NOTCH_RX}px ${NOTCH_RY}px at ${centrePercent}% 0px, transparent 99%, #000 100%)`;

export const CurvedNav: React.FC<CurvedNavProps> = ({ activeTab, onSelectTab }) => {
  const reduceMotion = useReducedMotion();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Movement is the whole point of docking, so reduced motion keeps the bar put.
  const hidden = useHideOnScrollDown(!reduceMotion);

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
      data-docked={hidden ? 'false' : 'true'}
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
          style={{ transform: sliderTransform }}
          className="pointer-events-none absolute left-0 top-0 h-full w-1/5"
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

        <div className="relative z-10 grid h-full grid-cols-5">
          {NAV_ITEMS.map((item, position) => {
            const isActive = position === activeIndex;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                ref={(node) => { buttonRefs.current[position] = node; }}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(item.id)}
                onKeyDown={(event) => onKeyDown(event, position)}
                className={`hk-pressable flex cursor-pointer select-none flex-col items-center justify-end gap-1 rounded-[20px] pb-3.5 ${
                  isActive ? 'text-[#014040]' : 'text-slate-500 hover:text-[#014040]'
                }`}
              >
                <Icon className="hk-nav-icon h-[18px] w-[18px] stroke-[2]" data-hidden={isActive} aria-hidden />
                <span className={`text-[10px] leading-none tracking-tight ${isActive ? 'font-black' : 'font-medium'}`}>
                  {item.label}
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
