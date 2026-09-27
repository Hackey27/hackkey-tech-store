import { useEffect, useRef, useState } from 'react';

/**
 * True while the reader is scrolling down, so a fixed bar can get out of the way
 * and come back when they scroll up looking for it.
 *
 * Reads scroll position inside requestAnimationFrame and listens passively, so
 * the handler never blocks the scroll it is watching. The threshold exists
 * because touch scrolling reports tiny alternating deltas at the end of a
 * flick, which would otherwise flap the bar in and out.
 */
export function useHideOnScrollDown(
  enabled = true,
  { threshold = 8, revealWithin = 24 }: { threshold?: number; revealWithin?: number } = {}
): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }

    lastY.current = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - lastY.current;
        // Near the top the bar is always available: hiding it there reads as a
        // glitch rather than as getting out of the way.
        if (y <= revealWithin) {
          setHidden(false);
          lastY.current = y;
          return;
        }
        if (Math.abs(delta) <= threshold) return;
        setHidden(delta > 0);
        lastY.current = y;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled, threshold, revealWithin]);

  return hidden;
}
