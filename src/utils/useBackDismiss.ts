import { useCallback, useEffect, useRef } from 'react';
import { DismissibleStack } from './dismissibleStack';

let dismissibleSequence = 0;
const dismissibles = new DismissibleStack();

/**
 * Gives a temporary form or dialog its own browser-history entry. Pressing the
 * browser/phone Back control dismisses the temporary UI instead of leaving the
 * store page. Use the returned callback for visible close/cancel controls so
 * the temporary history entry is consumed as well.
 */
export function useBackDismiss(active: boolean, onDismiss: () => void): () => void {
  const onDismissRef = useRef(onDismiss);
  const markerRef = useRef<string | null>(null);
  const closingRef = useRef(false);
  const hrefRef = useRef('');

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!active) return;

    if (!markerRef.current) {
      dismissibleSequence += 1;
      markerRef.current = `hk-dismissible-${Date.now()}-${dismissibleSequence}`;
      hrefRef.current = window.location.href;
      window.history.replaceState({ ...(window.history.state || {}), hkScrollY: window.scrollY }, '', window.location.href);
      window.history.pushState(
        { ...(window.history.state || {}), hkDismissible: markerRef.current },
        '',
        window.location.href,
      );
    }
    const marker = markerRef.current;
    dismissibles.add(marker);

    const onPopState = (event: PopStateEvent) => {
      if (!markerRef.current || !dismissibles.claim(marker, event.state?.hkDismissible)) return;
      // Same-page overlays do not navigate or run the route's scroll reset.
      if (window.location.href === hrefRef.current) event.stopImmediatePropagation();
      markerRef.current = null;
      closingRef.current = false;
      onDismissRef.current();
    };

    window.addEventListener('popstate', onPopState, true);
    return () => { dismissibles.remove(marker); window.removeEventListener('popstate', onPopState, true); };
  }, [active]);

  return useCallback(() => {
    if (closingRef.current) return;
    const marker = markerRef.current;
    if (marker && window.history.state?.hkDismissible === marker) {
      closingRef.current = true;
      window.history.back();
      return;
    }
    if (marker) dismissibles.remove(marker);
    markerRef.current = null;
    onDismissRef.current();
  }, []);
}
