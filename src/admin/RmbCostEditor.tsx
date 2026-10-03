import React from 'react';
import { Plane, Ship } from 'lucide-react';
import type { PreorderDelivery, RmbPricingSettings, RmbSourceCost } from '../../shared/types';
import { calculateRmbPrice, emptyRmbPricingSettings } from '../../shared/rmbPricing';
import { formatPesewas, formatGhsCost } from '../../shared/money';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040]';
export const rmbDeliveryLabel = (delivery: PreorderDelivery) => delivery === 'express' ? '2–3 weeks' : '6–8 weeks';
export function RmbCostEditor({ cost, deliveries, settings, onChange }: { cost?: RmbSourceCost; deliveries: PreorderDelivery[]; settings?: RmbPricingSettings; onChange: (value: RmbSourceCost) => void }) {
  const set = (key: keyof RmbSourceCost, text: string) => onChange({ ...cost, rawCostRmb: cost?.rawCostRmb ?? 0, [key]: text === '' ? undefined : Number(text) } as RmbSourceCost);
  const money = formatGhsCost;
  const quotes = deliveries.map(delivery => {
    try { return { delivery, price: calculateRmbPrice(cost, delivery, settings || emptyRmbPricingSettings()), error: null }; }
    catch (error) { return { delivery, price: null, error: (error as Error).message }; }
  });
  return <section className="space-y-4 rounded-xl border border-[#cbdcd9] bg-[#f8fbfa] p-4">
    <div><h4 className="font-black text-[#014040]">Live selling price</h4><p className="mt-1 text-xs text-slate-500">Updates as you type. Includes exchange conversion, transaction fee, bank charge, each delivery’s shipping and profit markup.</p></div>
    <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-xs font-bold">Raw product cost (¥ RMB)<input className={input} type="number" min="0.01" step="0.01" value={cost?.rawCostRmb ?? ''} onChange={event => set('rawCostRmb', event.target.value)} /></label>{deliveries.map(delivery => { const key = delivery === 'express' ? 'shippingExpressGhs' : 'shippingTwoMonthsGhs'; return <label key={delivery} className="space-y-1 text-xs font-bold">Shipping · {rmbDeliveryLabel(delivery)} (₵)<input className={input} type="number" min="0" step="0.01" value={cost?.[key] ?? ''} onChange={event => set(key, event.target.value)} /></label>; })}</div>
    {!deliveries.length && <p className="text-xs font-bold text-amber-800">Choose a delivery option to preview its selling price.</p>}
    <div aria-live="polite" aria-atomic="true" className="grid gap-3 sm:grid-cols-2">{quotes.map(({ delivery, price, error }) => {
      const Icon = delivery === 'express' ? Plane : Ship;
      return <div key={delivery} className={`min-w-0 rounded-xl border p-4 ${price ? 'border-[#014040] bg-[#014040] text-white' : 'border-[#cbdcd9] bg-white text-[#014040]'}`}>
        <h5 className="flex items-center gap-2 text-sm font-bold"><Icon className={`h-4 w-4 shrink-0 ${price ? 'text-[#05ef28]' : ''}`} />{rmbDeliveryLabel(delivery)}</h5>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wide">Final selling price</p>
        {price ? <><p className="mt-1 break-words text-3xl font-black text-[#05ef28]">{formatPesewas(price.pricePesewas)}</p><p className="mt-2 text-xs text-white/80">Shipping included: {money(price.shippingGhs)} · Profit markup: {price.marginPercent}%</p><p className="mt-1 text-[11px] text-white/70">Rounded up to a whole cedi.</p></> : <><p className="mt-1 text-lg font-black">Not ready</p><p className="mt-2 text-xs text-rose-800">{error}</p></>}
      </div>;
    })}</div>
    <div className="grid gap-3 md:grid-cols-2">{quotes.map(({ delivery, price }) => {
      if (price) {
        const rows = [['Raw product cost', `¥${price.rawCostRmb}`], ['Exchange rate', `${money(price.exchangeRate)} / RMB`], ['Converted product cost', money(price.convertedCostGhs)], ['Bank charge mode', price.bankChargeMode === 'percentage_min' ? 'Percentage with minimum' : 'Fixed ranges'], ['Bank charge base', money(price.bankChargeBaseGhs)], ['Bank charge', money(price.bankChargeGhs)], [`Transaction fee (${price.transactionFeePercent}%)`, `¥${price.transactionFeeRmb} = ${money(price.transactionFeeGhs)}`], ['Shipping', money(price.shippingGhs)], ['Final landed cost', money(price.landedCostGhs)], ['Profit margin', `${price.marginPercent}%`], ['Profit', money(price.profitGhs)], ['Calculated selling price', money(price.sellingPriceGhs)], ['Storefront price', formatPesewas(price.pricePesewas)]];
        return <details key={delivery} className="self-start rounded-xl border bg-white p-3"><summary className="cursor-pointer text-xs font-bold text-[#014040]">Price breakdown · {rmbDeliveryLabel(delivery)}</summary><dl className="mt-3 space-y-2 text-xs">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-600">{label}</dt><dd className="text-right font-bold text-[#014040]">{value}</dd></div>)}</dl></details>;
      }
      return null;
    })}</div>
    <p className="text-xs text-slate-500">Source costs stay in RMB. Payments → Exchange Rate &amp; Charges controls the conversion and markup. This breakdown is visible only in admin.</p>
  </section>;
}
