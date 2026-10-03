import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { CatalogueItem, PreorderProduct } from '../../shared/types';
import { SECTION_TABS } from '../config/sections';

export const HACK_STORE_DESCRIPTIONS = {
  software: 'Software licences and research services: statistical software, plagiarism checks and data analysis.',
  laptops: 'Available and preorder laptops, with CPU, RAM, storage and touchscreen options to suit your needs.',
  preorder: 'Products ordered for delivery in weeks. Explore the latest product categories and available variants.',
  technicians: 'Tools and replacement parts for technicians. This section is coming soon.',
};
export function hackStoreExamples(items: CatalogueItem[], preorders: PreorderProduct[]) {
  const names = (values: string[]) => [...new Set(values.filter(Boolean))].slice(0, 3).join(', ');
  return {
    software: names(items.filter(item => ['product', 'service', 'bundle'].includes(item.kind)).map(item => item.name)),
    laptops: names(items.filter(item => item.kind === 'laptop').map(item => item.laptop ? `${item.laptop.brand} ${item.laptop.model}`.trim() : item.name)),
    preorder: names(preorders.filter(item => item.active).map(item => item.name)),
  };
}
export function HackGuideSupport({ navigate }: { navigate?: (path: string) => void }) {
  const [examples, setExamples] = useState({ software: '', laptops: '', preorder: '' });
  useEffect(() => {
    let active = true;
    const read = async (url: string) => { try { const response = await fetch(url); return response.ok ? await response.json() : {}; } catch { return {}; } };
    void Promise.all([read('/api/catalog'), read('/api/preorder/catalogue')]).then(([catalogue, preorders]) => { if (active) setExamples(hackStoreExamples(catalogue.products || [], preorders.products || [])); });
    return () => { active = false; };
  }, []);
  return <section className="min-w-0 space-y-4 rounded-2xl border border-[#bdd1cc] bg-white p-4 sm:p-5" aria-label="Support Hack-Key Tech">
    <h3 className="text-xl font-black text-[#014040]">Found this guide helpful?</h3>
    <p className="text-sm leading-7 text-slate-600">If you appreciate this help, you can support us by exploring our store and recommending Hack-Key Tech to friends, family and colleagues.</p>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">{SECTION_TABS.filter(tab => tab.id !== 'hacks').map(tab => {
      const sectionId = tab.id as keyof typeof HACK_STORE_DESCRIPTIONS;
      const example = sectionId === 'technicians' ? '' : examples[sectionId];
      const Icon = tab.icon;
      return <div key={tab.id} className="min-w-0 rounded-xl border border-[#d8e7e4] p-4"><p className="break-words text-xs leading-6 text-slate-600">{HACK_STORE_DESCRIPTIONS[sectionId]}{example && <span className="mt-2 block font-semibold text-[#014040]">Explore: {example}.</span>}</p><a href={tab.path} onClick={event => { if (navigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); navigate(tab.path); } }} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl bg-[#014040] px-3 py-2 text-xs font-bold text-[#05ef28]"><Icon className="h-4 w-4 shrink-0" /><span>{tab.label}{!tab.live && ' · Coming soon'}</span><ArrowRight className="h-4 w-4 shrink-0" /></a></div>;
    })}</div>
  </section>;
}
