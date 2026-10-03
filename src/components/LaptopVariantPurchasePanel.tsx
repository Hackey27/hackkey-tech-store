import React from 'react';
import type { CatalogueItem, PreorderDelivery } from '../../shared/types';
import { cpuLabel, switchLaptopVariant } from '../../shared/laptopVariants';
import { formatPesewas } from '../../shared/money';
import { LaptopVariantChip } from './LaptopVariantChip';
import { LaptopDeliveryPrices } from './LaptopDeliveryPrices';

export function LaptopVariantPurchasePanel({ item, delivery, onDeliveryChange, onChange, onAddToCart }: { item: CatalogueItem; delivery?: PreorderDelivery; onDeliveryChange: (delivery: PreorderDelivery) => void; onChange?: (rowId: string) => void; onAddToCart?: (item: CatalogueItem) => void }) {
  const selection = item.laptopVariant!;
  const options = item.laptopVariantOptions || [];
  const current = options.find(row => row.rowId === selection.rowId);
  const properties = item.laptopVariantProperties;
  if (!current || !properties) return null;
  const price = selection.currencyBasis === 'RMB' ? (delivery ? item.preorderPricesPesewas?.[delivery] : undefined) : item.pricePesewas;
  const pricedOptions = options.map(option => ({ ...option, pricePesewas: option.currencyBasis === 'RMB' ? (delivery ? option.deliveryPrices?.[delivery] : undefined) : option.pricePesewas }));
  return <div className="min-w-0 text-[#014040]">
    <section data-testid="your-laptop-selection" className="min-w-0 space-y-[18.4px] text-[19.55px]">
      <h2 className="font-black">Your selection</h2>
      <div className="flex min-w-0 flex-wrap gap-[9.2px]">{[selection.cpu, selection.ram, selection.storage].map((value, index) => <LaptopVariantChip key={index} selected large>{value}</LaptopVariantChip>)}</div>
      <p aria-live="polite" className="break-words text-3xl font-black">{price ? formatPesewas(price) : 'Price unavailable'}</p>
      <LaptopDeliveryPrices item={item} selected={delivery} onSelect={onDeliveryChange} />
      <button type="button" disabled={!price || !onAddToCart} onClick={() => onAddToCart?.({ ...item, pricePesewas: price, ...(selection.currencyBasis === 'RMB' && delivery ? { laptopDelivery: delivery } : {}) })} className="w-full rounded-xl bg-[#014040] px-4 py-3 font-black text-[#05ef28] disabled:opacity-50">Add to cart</button>
    </section>
    <section data-testid="other-laptop-variants" className="mt-6 min-w-0 space-y-4 border-t border-[#d8e7e4] pt-4 text-[17px]">
      <h2 className="font-black">Other variants for this model</h2>
      <p className="text-xs text-slate-500">Choose CPU, then RAM and Storage. Grey choices have no priced combination for your selection.</p>
      {(['cpuId', 'ramId', 'storageId'] as const).map((field, index) => <fieldset key={field} className="min-w-0"><legend className="mb-2 font-bold">{['CPU', 'RAM', 'Storage'][index]}</legend><div className="flex min-w-0 flex-wrap gap-2">{(field === 'cpuId' ? properties.cpus.map(value => ({ id: value.id, label: cpuLabel(value) })) : properties[field === 'ramId' ? 'ram' : 'storage'].map(value => ({ id: value.id, label: value.value }))).map(value => {
        const next = switchLaptopVariant(pricedOptions, current, field, value.id);
        return <LaptopVariantChip key={value.id} selected={current[field] === value.id} disabled={!next} onClick={() => next && onChange?.(next.rowId)}>{value.label}</LaptopVariantChip>;
      })}</div></fieldset>)}
    </section>
  </div>;
}
