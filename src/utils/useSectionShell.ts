import { useCallback, useEffect, useState } from 'react';

/** How far the reader has to scroll before the opening display gets out of
 *  the way. Far enough not to trip on a stray wheel notch. */
const COLLAPSE_THRESHOLD_PX = 120;
/** Width of the expanded panel. It overlays the page, so this displaces
 *  nothing. */
export const SECTION_PANEL_WIDTH_PX = 248;
/** Width of the collapsed rail. Matched to the header hamburger's 40px button
 *  so the rail's icons sit on the same vertical line as the hamburger. */
export const COLLAPSED_RAIL_PX = 40;

/**
 * Where the panel is, and how it got there.
 *
 * `showcase` is the one automatic state: the panel is open because the page
 * just loaded, not because anyone asked. It is the only state scrolling is
 * allowed to close, and it happens once per page load.
 */
type ShellState = 'showcase' | 'open' | 'closed';

export interface SectionShell {
  expanded: boolean;
  /** Tapping away from the panel should close it. True on phones, where it
   *  covers the content, and whenever the reader opened it by hand. False for
   *  the opening display on a desktop, where a backdrop would swallow the
   *  reader's first click on the page behind it. */
  dismissable: boolean;
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
 * THE FULL TABS ARE SHOWN ONCE PER PAGE LOAD, THEN NEVER BY THEMSELVES AGAIN.
 * A fresh load or a refresh opens the panel so the reader sees the sections
 * exist; the first real scroll closes it; and from then on only the hamburger
 * reopens it. Scrolling back to the top does not bring it back, and neither
 * does opening a category — those are client-side navigations that never
 * remount this hook, so the closed state simply persists.
 *
 * It used to be scrubbed to scroll position and reversed on the way back up,
 * which meant the panel reappeared over the catalogue every time the reader
 * returned to the top. Showing it once and then leaving it alone is the point
 * of this hook now, so the state is a latch rather than a position.
 *
 * Scrolling closes ONLY the opening display. A panel the reader opened
 * deliberately stays open until they act on it — closing that one on the next
 * pixel of scroll would make the hamburger feel broken. It closes when they
 * pick a tab, tap away from it, or press the hamburger again.
 *
 * The panel ALWAYS overlays the page and never displaces it. It used to push
 * the content right by its own width, so a fresh load reflowed the whole
 * storefront sideways and then unwound it again on the first scroll.
 */
export function useSectionShell(): SectionShell {
  const desktop = useIsDesktop();
  const [state, setState] = useState<ShellState>('showcase');

  useEffect(() => {
    const onScroll = () => {
      // Only the opening display yields to scroll, and only once.
      setState((current) =>
        current === 'showcase' && window.scrollY > COLLAPSE_THRESHOLD_PX ? 'closed' : current
      );
    };
    // A reload that restores a scroll position partway down the page should
    // not flash the panel open and then shut.
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggle = useCallback(() => {
    setState((current) => (current === 'closed' ? 'open' : 'closed'));
  }, []);

  const close = useCallback(() => setState('closed'), []);

  return {
    expanded: state !== 'closed',
    dismissable: state === 'open' || (!desktop && state === 'showcase'),
    toggle,
    close,
  };
}
