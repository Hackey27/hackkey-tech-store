import React from 'react';

export function LaptopActions({ onInterest, onCompare, compact = false, hoverCompare = false }: { onInterest?: () => void; onCompare?: () => void; compact?: boolean; hoverCompare?: boolean }) {
  const size = compact ? 'min-h-8 px-1 py-2 text-[11px]' : 'min-h-11 px-1 py-[11px] text-[12.1px]';
  return <div className={`grid min-w-0 gap-2 ${onCompare ? 'grid-cols-2' : 'grid-cols-1'}`}>
    <button type="button" onClick={event => { event.stopPropagation(); onInterest?.(); }} className={`hk-activation-gradient flex items-center justify-center whitespace-nowrap rounded-xl text-center font-black text-white ${size}`}>I am interested</button>
    {onCompare && <button type="button" onClick={event => { event.stopPropagation(); onCompare(); }} className={`flex items-center justify-center whitespace-nowrap rounded-xl border border-[#014040] text-center font-black text-[#014040] ${size} ${hoverCompare ? 'hk-card-compare' : ''}`}>Compare laptop</button>}
  </div>;
}
