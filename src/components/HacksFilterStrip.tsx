import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { HacksFilters, HackTheme } from '../../shared/hacks';

const control = 'inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/25 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20';
export function HacksFilterStrip({ themes, filters, onChange }: { themes: HackTheme[]; filters: HacksFilters; onChange: (filters: HacksFilters) => void }) {
  const [open, setOpen] = useState<keyof HacksFilters | null>(null), [position, setPosition] = useState({ left: 12, top: 0 });
  const strip = useRef<HTMLDivElement>(null), menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (menu.current?.contains(event.target as Node) || event.type === 'pointerdown' && strip.current?.contains(event.target as Node)) return; setOpen(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', close); window.addEventListener('scroll', close, true); window.addEventListener('resize', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  const options: Record<keyof HacksFilters, Array<[string, string]>> = {
    sort: [['popular', 'Popular'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['with-steps', 'With steps'], ['without-steps', 'Without steps']],
    themeId: [['', 'All categories'], ...themes.map(theme => [theme.themeId, theme.name] as [string, string])],
    links: [['all', 'All posts'], ['with-links', 'With tool links'], ['without-links', 'Without tool links']],
  };
  const labels = { sort: 'Sort by', themeId: 'Categories', links: 'Tool links' };
  return <div ref={strip} data-testid="hacks-filter-strip" className="hk-activation-gradient sticky top-[112px] z-40 mt-4 flex items-center gap-2 rounded-xl p-2 text-white md:top-[76px]">
    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {(['sort', 'themeId', 'links'] as const).map(key => <button type="button" key={key} className={control} aria-expanded={open === key} aria-haspopup="listbox" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setPosition({ top: rect.bottom + 6, left: Math.max(12, Math.min(rect.left, window.innerWidth - 292)) }); setOpen(current => current === key ? null : key); }}><span>{labels[key]}{filters[key] && !(key === 'links' && filters.links === 'all') ? `: ${options[key].find(([value]) => value === filters[key])?.[1] || ''}` : ''}</span><ChevronDown className="h-3.5 w-3.5" /></button>)}
    </div>
    <button type="button" className={control} onClick={() => onChange({ themeId: '', sort: 'newest', links: 'all' })}>Reset</button>
    {open && createPortal(<div ref={menu} role="listbox" aria-label={labels[open]} className="fixed z-[60] max-h-[50vh] w-[280px] overflow-y-auto rounded-xl border border-[#bdd1cc] bg-white p-2 text-[#014040] shadow-2xl" style={position}>{options[open].map(([value, label]) => <button type="button" key={value} role="option" aria-selected={filters[open] === value} className={`block w-full rounded-lg px-3 py-3 text-left text-sm font-bold ${filters[open] === value ? 'bg-[#edf5f3]' : 'hover:bg-slate-50'}`} onClick={() => { onChange({ ...filters, [open]: value }); setOpen(null); }}>{label}</button>)}</div>, document.body)}
  </div>;
}
