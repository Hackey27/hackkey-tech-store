import React from 'react';
import { STORE_COPY } from '../config/storeCopy';
import { SECTION_TABS, SectionId } from '../config/sections';
import { COLLAPSED_RAIL_PX, SECTION_PANEL_WIDTH_PX, SectionShell } from '../utils/useSectionShell';

interface SectionNavProps {
  activeSection: SectionId;
  onSelectSection: (section: SectionId) => void;
  shell: SectionShell;
}

/**
 * The store's section panel, down the left edge.
 *
 * Two states and no blur in either. Expanded shows an icon, a label and a
 * caption per tab; collapsed shows icons only, at reduced opacity. It overlays
 * the content in both states and never displaces it.
 *
 * On phones the collapsed state shows nothing at all. The header already
 * carries a hamburger in the top-left corner, and a second floating button for
 * the same panel is one control too many on a screen that also has the bottom
 * navigation — two affordances for one panel reads as two different panels.
 *
 * The panel is only as tall as its tabs. It deliberately does not run the full
 * viewport height.
 */
export const SectionNav: React.FC<SectionNavProps> = ({ activeSection, onSelectSection, shell }) => {
  const { expanded, dismissable } = shell;

  return (
    <>
      {/* Tapping away closes it, which is the only way off it on a phone. Not
          rendered for the panel a desktop reader never opened: a backdrop there
          would eat their first click on the page behind it. */}
      {expanded && dismissable && (
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
        className={`hk-section-nav fixed left-4 top-[104px] z-40 sm:left-6 md:top-[84px] lg:left-8 ${
          expanded ? '' : 'pointer-events-none md:pointer-events-auto'
        }`}
        style={{
          width: expanded ? SECTION_PANEL_WIDTH_PX : COLLAPSED_RAIL_PX,
          opacity: expanded ? 1 : 0.55,
        }}
      >
        <ul
          className={`flex flex-col gap-1 rounded-2xl border border-[#014040]/10 bg-white/95 shadow-lg ${
            expanded ? 'p-2' : 'hidden p-1 md:flex'
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
                  className={`hk-pressable flex w-full items-center rounded-xl py-3 ${
                    expanded ? 'gap-3 px-2.5 text-left' : 'justify-center px-0'
                  } ${
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
