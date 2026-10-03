import React from 'react';
import type { Laptop } from '../../shared/types';
import { hasLaptopTouchscreen, LAPTOP_TWO_IN_ONE_OPTIONS, laptopTwoInOneStatus } from '../../shared/laptopTouchSpecs';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#014040]/10';
export function LaptopTouchFields({ laptop, onChange }: { laptop: Laptop; onChange: (patch: Partial<Laptop>) => void }) {
  return <>
    <label className="space-y-1 text-xs font-bold text-slate-700">Touchscreen
      <input className={input} value={laptop.touchscreen || ''} placeholder="Yes, No, or touchscreen details" onChange={event => {
        const touchscreen = event.target.value;
        onChange({ touchscreen, twoInOne: laptopTwoInOneStatus({ ...laptop, touchscreen }) });
      }} />
    </label>
    {hasLaptopTouchscreen(laptop) && <label className="space-y-1 text-xs font-bold text-slate-700">2-in-1
      <select className={input} value={laptopTwoInOneStatus(laptop)} onChange={event => onChange({ twoInOne: event.target.value as Laptop['twoInOne'] })}>
        {LAPTOP_TWO_IN_ONE_OPTIONS.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>}
  </>;
}
