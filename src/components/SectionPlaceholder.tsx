import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { SectionTab } from '../config/sections';

interface SectionPlaceholderProps {
  tab: SectionTab;
  onBack: () => void;
}

/**
 * Stands in for a section that has a tab but no content yet.
 *
 * Pre-order uses this until pass 2 fills it; the three unbuilt tabs use it if
 * someone reaches their path directly. Before this existed every unmatched
 * path fell through to the home page with a 200, so a mistyped URL silently
 * looked like the storefront.
 */
export const SectionPlaceholder: React.FC<SectionPlaceholderProps> = ({ tab, onBack }) => {
  const Icon = tab.icon;
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#014040]/8">
        <Icon className="h-8 w-8 text-[#025656]" />
      </span>
      <h1 className="mt-4 text-2xl font-black text-[#014040]">{tab.label}</h1>
      <p className="mt-1 text-sm font-bold text-[#025656]">{STORE_COPY.sections.comingSoon}</p>
      <p className="mt-3 text-sm text-slate-600">{STORE_COPY.sections.comingSoonNote}</p>
      <button
        type="button"
        onClick={onBack}
        className="hk-pressable mt-6 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {STORE_COPY.catalog.backToBrowse}
      </button>
    </div>
  );
};
