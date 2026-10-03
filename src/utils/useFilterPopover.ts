import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function shouldDismissFilterPopover(type: string, insideMenu: boolean, insideStrip: boolean, editingPrice: boolean): boolean {
  if (insideMenu || type === 'resize') return false;
  if (type === 'pointerdown') return !insideStrip;
  return type === 'scroll' && !editingPrice;
}

/** Keep focused price fields usable through keyboard resizing, focus scrolling
 * and catalogue-height changes. Other menus still close on page scrolling. */
export function useFilterPopover(open: boolean, price: boolean, onDismiss: () => void) {
  const strip = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const [position, setPosition] = useState({ top: 0, left: 12, maxHeight: '50vh' });

  const reposition = () => {
    const button = anchor.current;
    if (!button) return;
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const height = viewport?.height || window.innerHeight;
    const rect = button.getBoundingClientRect();
    const maxHeight = Math.max(100, Math.min(window.innerHeight / 2, height - 24));
    const menuHeight = Math.min(menu.current?.offsetHeight || maxHeight, maxHeight);
    setPosition({
      top: Math.max(viewportTop + 12, Math.min(rect.bottom + 6, viewportTop + height - menuHeight - 12)),
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
      maxHeight: `${maxHeight}px`,
    });
  };

  useLayoutEffect(() => { if (open) reposition(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onViewportEvent = (event: Event) => {
      const insideMenu = event.target instanceof Node && !!menu.current?.contains(event.target);
      const insideStrip = event.target instanceof Node && !!strip.current?.contains(event.target);
      const editingPrice = price && !!menu.current?.contains(document.activeElement);
      if (shouldDismissFilterPopover(event.type, insideMenu, insideStrip, editingPrice)) dismissRef.current();
      else if (event.type !== 'pointerdown') reposition();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismissRef.current(); };
    document.addEventListener('pointerdown', onViewportEvent);
    window.addEventListener('scroll', onViewportEvent, true);
    window.addEventListener('resize', onViewportEvent);
    window.visualViewport?.addEventListener('resize', onViewportEvent);
    window.visualViewport?.addEventListener('scroll', onViewportEvent);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', onViewportEvent);
      window.removeEventListener('scroll', onViewportEvent, true);
      window.removeEventListener('resize', onViewportEvent);
      window.visualViewport?.removeEventListener('resize', onViewportEvent);
      window.visualViewport?.removeEventListener('scroll', onViewportEvent);
      document.removeEventListener('keydown', escape);
    };
  }, [open, price]);
  return { strip, menu, position, anchorTo: (button: HTMLButtonElement) => { anchor.current = button; reposition(); } };
}
