import { useEffect } from 'react';

/**
 * Content blocks inside the page body. `<section>` is already the markup this
 * store uses for "a block of content", so the reveal lands on the same
 * granularity a reader perceives — a whole card or band at a time, rather than
 * every heading and paragraph arriving separately. Anything else can opt in
 * with data-reveal.
 */
const REVEAL_SELECTOR = 'main section, [data-reveal]';

/**
 * Marks that the script is running. The hidden state is scoped to this class,
 * so if the bundle fails, this hook throws, or the browser has no
 * IntersectionObserver, every block simply stays visible. Content that depends
 * on JavaScript to become readable is a worse outcome than no animation.
 */
const READY_CLASS = 'hk-reveal-ready';

/**
 * Fades content blocks in as they come into view, once each.
 *
 * Deliberately one-way. Fading a block back out as it leaves would dim things
 * the reader is still working with, and re-fade everything above them on the
 * way back up, which reads as flicker rather than polish.
 */
export function useScrollReveal(): void {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    // Movement is the whole effect, so reduced motion opts out entirely rather
    // than getting a faster version of it.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const watched = new WeakSet<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealed = 'true';
          // Once revealed it stays revealed, so stop paying for it.
          observer.unobserve(entry.target);
        }
      },
      // A little short of the fold, so a block is already settled by the time
      // it is comfortably readable.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
    );

    const watch = (element: Element) => {
      if (watched.has(element)) return;
      watched.add(element);
      observer.observe(element);
    };

    const scan = (scope: ParentNode) => {
      if (scope instanceof Element && scope.matches(REVEAL_SELECTOR)) watch(scope);
      scope.querySelectorAll(REVEAL_SELECTOR).forEach(watch);
    };

    scan(document);
    document.documentElement.classList.add(READY_CLASS);

    // Tabs and routes swap the whole of <main>, and views load their content
    // after a fetch, so the set of blocks is never fixed at mount.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      document.documentElement.classList.remove(READY_CLASS);
    };
  }, []);
}
