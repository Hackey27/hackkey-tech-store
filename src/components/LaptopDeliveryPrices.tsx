import React from 'react';
import type { CatalogueItem, PreorderDelivery } from '../../shared/types';
import { formatPesewas } from '../../shared/money';
import { PreorderDeliveryLabel } from './preorder/PreorderDeliveryLabel';

export function LaptopDeliveryPrices({ item, selected, onSelect, tone = 'default' }: { item: CatalogueItem; selected?: PreorderDelivery; onSelect?: (delivery: PreorderDelivery) => void; tone?: 'default' | 'banner' }) {
  if (!item.preorderPricesPesewas) return null;
  const deliveries = item.laptop?.preorderDeliveryOptions || ['express', 'two-months'];
  return <fieldset className={tone === 'banner' ? 'mt-2 min-w-0' : 'my-3 min-w-0'}><legend className={`mb-2 text-[10px] font-black uppercase tracking-wide ${tone === 'banner' ? 'text-white' : 'text-[#014040]'}`}>Delivery time</legend><div className={`grid gap-2 ${deliveries.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>{deliveries.map(delivery => {
    const price = item.preorderPricesPesewas?.[delivery];
    const contents = <><PreorderDeliveryLabel delivery={delivery} /><span className={`mt-1 block text-sm font-black ${tone === 'banner' ? 'text-[#05ef28]' : 'text-[#014040]'}`}>{price === undefined ? 'Price unavailable' : formatPesewas(price)}</span></>;
    const classes = `min-w-0 rounded-xl border ${tone === 'banner' ? 'border-white/25 bg-[#014040]/80 p-1.5' : 'bg-white p-2'} text-center ${selected === delivery ? 'border-[#014040] ring-1 ring-[#014040]' : 'border-[#d8e7e4]'}`;
    return onSelect ? <button key={delivery} type="button" aria-pressed={selected === delivery} disabled={price === undefined} onClick={() => onSelect(delivery)} className={`${classes} disabled:opacity-50`}>{contents}</button> : <div key={delivery} className={classes}>{contents}</div>;
  })}</div></fieldset>;
}
