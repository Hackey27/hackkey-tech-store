import { useCallback, useEffect, useRef } from 'react';

let dismissibleSequence = 0;

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

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!active) return;

    if (!markerRef.current) {
      dismissibleSequence += 1;
      markerRef.current = `hk-dismissible-${Date.now()}-${dismissibleSequence}`;
      window.history.pushState(
        { ...(window.history.state || {}), hkDismissible: markerRef.current },
        '',
        window.location.href,
      );
    }

    const onPopState = () => {
      if (!markerRef.current) return;
      markerRef.current = null;
      closingRef.current = false;
      onDismissRef.current();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [active]);

  return useCallback(() => {
    if (closingRef.current) return;
    const marker = markerRef.current;
    if (marker && window.history.state?.hkDismissible === marker) {
      closingRef.current = true;
      window.history.back();
      return;
    }
    markerRef.current = null;
    onDismissRef.current();
  }, []);
}
