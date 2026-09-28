import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/** Fully expanded at the top of the page, fully collapsed by here. */
const COLLAPSE_THRESHOLD_PX = 120;
/** Width of the expanded panel, and so how far it pushes the page across. */
export const SECTION_PANEL_WIDTH_PX = 248;

export interface SectionShell {
  /** 0 fully expanded, 1 fully collapsed. Scrubbed, so it reverses cleanly. */
  collapse: number;
  /** Pixels the page content is pushed right. Zero on phones and when floating. */
  shiftPx: number;
  /** The panel is floating over the content rather than sitting in the flow. */
  floating: boolean;
  /** True once the reader has opened or closed it by hand. */
  manual: boolean;
  toggle: () => void;
  close: () => void;
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const onChange = () => setDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

/**
 * Drives the hamburger panel.
 *
 * The collapse is scrubbed to scroll POSITION, not velocity: fully expanded at
 * scrollY 0, fully collapsed by COLLAPSE_THRESHOLD_PX. Position means the
 * panel tracks the scrollbar predictably and unwinds on the way back up.
 * Velocity-linked movement jitters on the tiny alternating deltas a touch
 * flick produces at the end of its travel.
 *
 * A hamburger click suspends the scroll link until the reader returns to the
 * top, otherwise a panel opened deliberately would snap shut on the next pixel
 * of scroll. "Returns to" means it has to leave the top first — clearing the
 * override the instant it is set at scrollY 0 would make the close button
 * appear to do nothing.
 */
export function useSectionShell(): SectionShell {
  const reduceMotion = useReducedMotion();
  const desktop = useIsDesktop();
  const [progress, setProgress] = useState(() =>
    typeof window === 'undefined' ? 0 : Math.min(1, window.scrollY / COLLAPSE_THRESHOLD_PX)
  );
  const [override, setOverride] = useState<boolean | null>(null);
  /** Has the reader left the top since the override was set? */
  const leftTop = useRef(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const next = Math.min(1, Math.max(0, window.scrollY / COLLAPSE_THRESHOLD_PX));
      if (next > 0) leftTop.current = true;
      setProgress(next);
      if (next === 0 && leftTop.current) {
        leftTop.current = false;
        setOverride(null);
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const toggle = useCallback(() => {
    leftTop.current = false;
    setOverride((current) => {
      const expandedNow = current === null
        ? (typeof window === 'undefined' ? true : window.scrollY < COLLAPSE_THRESHOLD_PX)
        : current;
      return !expandedNow;
    });
  }, []);

  const close = useCallback(() => {
    leftTop.current = false;
    setOverride(false);
  }, []);

  let collapse = override === null ? progress : override ? 0 : 1;
  // Reduced motion gets the two states and nothing in between.
  if (reduceMotion) collapse = collapse < 0.5 ? 0 : 1;

  // Floating whenever the reader has taken control, and always on phones,
  // where there is no room to push the page sideways.
  const floating = !desktop || override !== null;

  return {
    collapse,
    shiftPx: floating ? 0 : SECTION_PANEL_WIDTH_PX * (1 - collapse),
    floating,
    manual: override !== null,
    toggle,
    close,
  };
}
