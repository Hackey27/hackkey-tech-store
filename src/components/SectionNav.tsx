import React from 'react';
import { STORE_COPY } from '../config/storeCopy';
import { SECTION_TABS, SectionId } from '../config/sections';
import { SECTION_PANEL_WIDTH_PX, SectionShell } from '../utils/useSectionShell';

interface SectionNavProps {
  activeSection: SectionId;
  onSelectSection: (section: SectionId) => void;
  shell: SectionShell;
}

/** The section menu floats above the page only while open. The header
 * hamburger reopens it; there is no collapsed rail over the catalogue. */
export const SectionNav: React.FC<SectionNavProps> = ({ activeSection, onSelectSection, shell }) => {
  const { expanded, dismissable } = shell;
  if (!expanded) return null;

  return (
    <>
      {/* Outside clicks dismiss a manually opened menu. Leave the header
          toggle accessible so it can also close the floating panel. */}
      {dismissable && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={shell.close}
          className="fixed inset-x-0 bottom-0 top-[112px] z-[110] cursor-default bg-transparent md:top-[76px]"
        />
      )}

      <nav
        aria-label={STORE_COPY.sections.ariaLabel}
        data-expanded={expanded ? 'true' : 'false'}
        className="hk-section-nav fixed left-4 top-[104px] z-[120] sm:left-6 md:top-[84px] lg:left-8"
        style={{ width: SECTION_PANEL_WIDTH_PX }}
      >
        <ul
          className="flex flex-col gap-1 rounded-2xl border border-[#014040]/10 bg-white p-2 shadow-lg"
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
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};
