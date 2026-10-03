import { useEffect, useRef } from 'react';

export function isDownwardScrollKey(key: string): boolean {
  return ['ArrowDown', 'PageDown', ' ', 'End'].includes(key);
}

/** History restoration is not a user scroll. Keep a returning bar hidden until
 * a real downward gesture finishes, so momentum cannot immediately hide it
 * again in the middle of its reveal. */
export function useResumeNavAfterBack(waiting: boolean, onResume?: () => void) {
  const resume = useRef(onResume);
  resume.current = onResume;
  useEffect(() => {
    if (!waiting) return;
    let startY = window.scrollY;
    let armed = false;
    let touchY = 0;
    let timer = 0;
    let lastIntent = 0;
    const arm = () => {
      const now = performance.now();
      if (!armed || now - lastIntent > 180) { startY = window.scrollY; armed = true; }
      lastIntent = now;
    };
    const wheel = (event: WheelEvent) => { if (event.deltaY > 0) arm(); };
    const touchStart = (event: TouchEvent) => { armed = false; window.clearTimeout(timer); touchY = event.touches[0]?.clientY || 0; };
    const touchMove = (event: TouchEvent) => { if ((event.touches[0]?.clientY ?? touchY) < touchY - 8) arm(); };
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
      if (!event.shiftKey && isDownwardScrollKey(event.key)) arm();
    };
    const scroll = () => {
      if (!armed) return;
      window.clearTimeout(timer);
      if (window.scrollY - startY < 8) return;
      timer = window.setTimeout(() => resume.current?.(), 180);
    };
    window.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: true });
    window.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll);
    };
  }, [waiting]);
}
