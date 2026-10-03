import React from 'react';
import { Check } from 'lucide-react';

export function LaptopVariantChip({ children, selected, disabled, onClick, large = false, compact = false }: { children: React.ReactNode; selected: boolean; disabled?: boolean; onClick?: () => void; large?: boolean; compact?: boolean }) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-xl border ${compact ? 'px-2 py-1 text-[10px]' : large ? 'px-[13.8px] py-[9.2px]' : 'px-3 py-2'} text-left font-bold [overflow-wrap:anywhere] ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : selected ? 'border-[#014040] bg-[#014040] text-[#05ef28]' : 'border-[#9cbfba] bg-white text-[#014040] hover:bg-[#edf5f3]'}`}>{selected && <Check className={compact ? "h-3 w-3 shrink-0" : "h-4 w-4 shrink-0"} aria-hidden="true" />}<span className="min-w-0">{children}</span></button>;
}
