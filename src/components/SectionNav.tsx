import React from 'react';
import { STORE_COPY } from '../config/storeCopy';
import { SECTION_TABS, SectionId } from '../config/sections';
import { SECTION_PANEL_WIDTH_PX, SectionShell } from '../utils/useSectionShell';

interface SectionNavProps {
  activeSection: SectionId;
  onSelectSection: (section: SectionId) => void;
  shell: SectionShell;
}

const COLLAPSED_RAIL_PX = 64;

/**
 * The store's section panel, down the left edge.
 *
 * Two states and no blur in either. Expanded shows an icon, a label and a
 * caption per tab; collapsed shows icons only, at reduced opacity, floating
 * over the content.
 *
 * On phones the collapsed state is a single floating button rather than a rail
 * of icons. A rail down the left would compete with the bottom navigation for
 * the same thumb, and the two together would leave very little of a phone
 * screen for the store itself. Tapping that button opens the panel as a
 * floating overlay, exactly as the hamburger in the header does.
 *
 * The panel is only as tall as its tabs. It deliberately does not run the full
 * viewport height.
 */
export const SectionNav: React.FC<SectionNavProps> = ({ activeSection, onSelectSection, shell }) => {
  const { collapse, floating } = shell;
  const expanded = collapse < 0.5;

  return (
    <>
      {/* Phones: the collapsed state is this button alone. It sits clear of the
          bottom navigation and out of the way of the content behind it. */}
      {!expanded && (
        <button
          type="button"
          onClick={shell.toggle}
          aria-label={STORE_COPY.sections.openLabel}
          aria-expanded={false}
          className="hk-pressable hk-section-floating-icon fixed left-3 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#014040]/15 bg-white text-[#014040] shadow-lg md:hidden"
        >
          <span aria-hidden="true" className="flex flex-col gap-[3px]">
            <span className="block h-[2px] w-4 rounded-full bg-current" />
            <span className="block h-[2px] w-4 rounded-full bg-current" />
            <span className="block h-[2px] w-4 rounded-full bg-current" />
          </span>
        </button>
      )}

      {/* An expanded floating panel is dismissable by tapping away from it,
          which is the only way off it on a phone. */}
      {expanded && floating && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={shell.close}
          className="fixed inset-0 z-40 cursor-default bg-transparent"
        />
      )}

      <nav
        aria-label={STORE_COPY.sections.ariaLabel}
        data-expanded={expanded ? 'true' : 'false'}
        data-floating={floating ? 'true' : 'false'}
        className={`hk-section-nav fixed left-0 top-[104px] z-40 px-2 md:top-[84px] ${
          expanded ? '' : 'pointer-events-none md:pointer-events-auto'
        }`}
        style={{
          width: expanded ? SECTION_PANEL_WIDTH_PX : COLLAPSED_RAIL_PX,
          // Scrubbed rather than stepped, so the panel tracks the scrollbar and
          // reverses on the way back up.
          opacity: expanded ? 1 : 0.55,
        }}
      >
        <ul
          className={`flex flex-col gap-1 rounded-2xl border border-[#014040]/10 bg-white/95 p-2 shadow-lg ${
            expanded ? '' : 'hidden md:flex'
          }`}
        >
          {SECTION_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeSection;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  disabled={!tab.live}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => tab.live && onSelectSection(tab.id)}
                  title={tab.live ? tab.label : `${tab.label} — ${STORE_COPY.sections.comingSoon}`}
                  className={`hk-pressable flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left ${
                    active
                      ? 'bg-[#014040] text-white'
                      : tab.live
                        ? 'text-[#014040] hover:bg-[#014040]/8'
                        : 'cursor-not-allowed text-[#014040]/40'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-[#05ef28]' : ''}`} />
                  {expanded && (
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black leading-tight">{tab.label}</span>
                      <span
                        className={`mt-0.5 block text-[11px] leading-snug ${
                          active ? 'text-white/70' : 'text-slate-500'
                        }`}
                      >
                        {tab.live ? tab.caption : STORE_COPY.sections.comingSoon}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};
