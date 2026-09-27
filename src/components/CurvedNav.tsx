import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Home, SearchCheck, HelpCircle, FilePlus2 } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

type NavTab = 'home' | 'find-order' | 'help' | 'request';

interface CurvedNavProps {
  /** Accepts the full tab union so App can pass its state unchanged. */
  activeTab: NavTab | 'cart';
  onSelectTab: (tab: NavTab) => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: STORE_COPY.navigation.home, icon: Home },
  { id: 'find-order', label: STORE_COPY.navigation.findOrder, icon: SearchCheck },
  { id: 'help', label: STORE_COPY.navigation.help, icon: HelpCircle },
  { id: 'request', label: STORE_COPY.navigation.request, icon: FilePlus2 }
];

/*
 * The notch is drawn in a 120x40 viewBox stretched to the slider's width. The
 * y=16 line is the bar's top edge, so everything above it is page colour laid
 * over page colour and the seam cannot show; only the dip below y=16 is
 * actually cut out of the white. That makes the shape self-correcting if the
 * bar's height or radius is ever retuned.
 */
const NOTCH_FILL = 'M 0 0 H 120 V 16 C 105 16, 99 39, 80 39 C 72 39, 48 39, 40 39 C 21 39, 15 16, 0 16 Z';
const NOTCH_EDGE = 'M 0 16 C 15 16, 21 39, 40 39 C 48 39, 72 39, 80 39 C 99 39, 105 16, 120 16';

export const CurvedNav: React.FC<CurvedNavProps> = ({ activeTab, onSelectTab }) => {
  const reduceMotion = useReducedMotion();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 'cart' is in the union because App owns that tab, but it opens the header
  // flyout and never becomes activeTab, so it has no slot on the bar.
  const foundIndex = NAV_ITEMS.findIndex((item) => item.id === activeTab);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;
  const active = NAV_ITEMS[activeIndex];
  const ActiveIcon = active.icon;

  // A spring, so tapping through tabs quickly retargets from the current
  // velocity instead of restarting. Driven as a full transform string rather
  // than Motion's `x` shorthand, which is not hardware accelerated and drops
  // frames while the browser is busy.
  const offset = useSpring(activeIndex * 100, { duration: 0.5, bounce: 0.2 });
  const transform = useTransform(offset, (value) => `translateX(${value}%)`);

  useEffect(() => {
    const next = activeIndex * 100;
    if (reduceMotion) offset.jump(next);
    else offset.set(next);
  }, [activeIndex, offset, reduceMotion]);

  // Arrow keys move along the bar, which is the expected ergonomics for a
  // horizontal control. Tab order still works on its own.
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + delta + NAV_ITEMS.length) % NAV_ITEMS.length;
    buttonRefs.current[next]?.focus();
  };

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label={STORE_COPY.navigation.ariaLabel}
      className="fixed inset-x-0 bottom-0 z-50 px-3 md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
    >
      <div className="relative mx-auto h-[78px] w-full max-w-[480px] rounded-[26px] bg-white shadow-[0_-4px_20px_rgba(1,64,64,0.10)]">
        {/* Notch and bubble. Decoration: every label it could carry is already
            on the button underneath. */}
        <motion.div
          aria-hidden
          style={{ transform }}
          className="pointer-events-none absolute left-0 top-0 h-full w-1/4"
        >
          <svg
            className="absolute left-0 w-full"
            style={{ top: '-16px', height: '40px' }}
            viewBox="0 0 120 40"
            preserveAspectRatio="none"
            fill="none"
          >
            <path d={NOTCH_FILL} fill="var(--hk-surface-page)" />
            {/* non-scaling-stroke keeps the hairline exactly 1px: the viewBox is
                stretched horizontally, which would otherwise thicken it. */}
            <path
              d={NOTCH_EDGE}
              fill="none"
              stroke="#014040"
              strokeOpacity="0.1"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div
            className="hk-nav-bubble absolute left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full"
            style={{ top: '-26px' }}
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
                <ActiveIcon className="h-6 w-6 stroke-[2.25]" />
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="relative z-10 grid h-full grid-cols-4">
          {NAV_ITEMS.map((item, index) => {
            const isActive = index === activeIndex;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id}`}
                ref={(node) => { buttonRefs.current[index] = node; }}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(item.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={`hk-pressable flex cursor-pointer select-none flex-col items-center justify-end gap-1 rounded-[22px] pb-4 ${
                  isActive ? 'text-[#014040]' : 'text-slate-500 hover:text-[#014040]'
                }`}
              >
                <Icon className="hk-nav-icon h-5 w-5 stroke-[2]" data-hidden={isActive} aria-hidden />
                <span className={`text-[11px] leading-none tracking-tight ${isActive ? 'font-black' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <span
          aria-hidden
          className="absolute bottom-1.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-[#014040]/15"
        />
      </div>
    </nav>
  );
};
