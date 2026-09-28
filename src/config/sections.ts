import { Boxes, CalendarClock, Laptop, Sparkles, Wrench } from 'lucide-react';
import { STORE_COPY } from './storeCopy';

/**
 * The store's top-level sections, as listed in the hamburger panel.
 *
 * Only Software and Services and Pre-order are built. The other three render
 * as disabled tabs with a coming-soon state rather than dead links, because a
 * tab that navigates nowhere reads as a broken site while a tab that says
 * "coming soon" reads as a roadmap.
 *
 * Laptops deliberately stays a placeholder even though laptops are already
 * purchasable: they live under the Software and Services catalogue at
 * /category/{laptopsCategoryId} until the Laptops brief moves them here.
 * Pointing the tab at an empty section before then would hide stock that is
 * currently selling.
 */

export type SectionId = 'software' | 'laptops' | 'preorder' | 'hacks' | 'technicians';

export interface SectionTab {
  id: SectionId;
  path: string;
  label: string;
  caption: string;
  icon: typeof Boxes;
  /** False renders the tab disabled with a coming-soon note. */
  live: boolean;
}

export const SECTION_TABS: SectionTab[] = [
  {
    id: 'software',
    path: '/',
    label: STORE_COPY.sections.software.label,
    caption: STORE_COPY.sections.software.caption,
    icon: Boxes,
    live: true,
  },
  {
    id: 'laptops',
    path: '/laptops',
    label: STORE_COPY.sections.laptops.label,
    caption: STORE_COPY.sections.laptops.caption,
    icon: Laptop,
    live: false,
  },
  {
    id: 'preorder',
    path: '/preorder',
    label: STORE_COPY.sections.preorder.label,
    caption: STORE_COPY.sections.preorder.caption,
    icon: CalendarClock,
    live: true,
  },
  {
    id: 'hacks',
    path: '/hacks',
    label: STORE_COPY.sections.hacks.label,
    caption: STORE_COPY.sections.hacks.caption,
    icon: Sparkles,
    live: false,
  },
  {
    id: 'technicians',
    path: '/technicians',
    label: STORE_COPY.sections.technicians.label,
    caption: STORE_COPY.sections.technicians.caption,
    icon: Wrench,
    live: false,
  },
];

/**
 * The tab whose path owns this pathname, or Software and Services.
 *
 * A section owns everything BENEATH its path as well as the path itself, so
 * that /preorder/some-product belongs to Pre-order rather than falling through
 * to the storefront. Software's path is `/`, which would otherwise own
 * everything, so it stays the fallback and is never matched by prefix.
 */
export function sectionForPath(pathname: string): SectionTab {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return (
    SECTION_TABS.find(
      (tab) => tab.id !== 'software' && (clean === tab.path || clean.startsWith(`${tab.path}/`))
    ) || SECTION_TABS[0]
  );
}
