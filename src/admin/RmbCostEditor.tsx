import React from 'react';
import type { PreorderDelivery, RmbPricingSettings, RmbSourceCost } from '../../shared/types';
import { calculateRmbPrice, emptyRmbPricingSettings } from '../../shared/rmbPricing';
import { formatPesewas, formatGhsCost } from '../../shared/money';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040]';
export const rmbDeliveryLabel = (delivery: PreorderDelivery) => delivery === 'express' ? '2–3 weeks' : '6–8 weeks';
export function RmbCostEditor({ cost, deliveries, settings, onChange }: { cost?: RmbSourceCost; deliveries: PreorderDelivery[]; settings?: RmbPricingSettings; onChange: (value: RmbSourceCost) => void }) {
  const set = (key: keyof RmbSourceCost, text: string) => onChange({ ...cost, rawCostRmb: cost?.rawCostRmb ?? 0, [key]: text === '' ? undefined : Number(text) } as RmbSourceCost);
  const money = formatGhsCost;
  return <section className="space-y-4 rounded-xl border border-[#cbdcd9] bg-[#f8fbfa] p-4">
    <h4 className="font-black text-[#014040]">Automated preorder price</h4>
    <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-xs font-bold">Raw product cost (¥ RMB)<input className={input} type="number" min="0.01" step="0.01" value={cost?.rawCostRmb ?? ''} onChange={event => set('rawCostRmb', event.target.value)} /></label>{deliveries.map(delivery => { const key = delivery === 'express' ? 'shippingExpressGhs' : 'shippingTwoMonthsGhs'; return <label key={delivery} className="space-y-1 text-xs font-bold">Shipping · {rmbDeliveryLabel(delivery)} (₵)<input className={input} type="number" min="0" step="0.01" value={cost?.[key] ?? ''} onChange={event => set(key, event.target.value)} /></label>; })}</div>
    <div className="grid gap-3 md:grid-cols-2">{deliveries.map(delivery => {
      try {
        const price = calculateRmbPrice(cost, delivery, settings || emptyRmbPricingSettings());
        const rows = [['Raw product cost', `¥${price.rawCostRmb}`], ['Exchange rate', `${money(price.exchangeRate)} / RMB`], ['Converted product cost', money(price.convertedCostGhs)], ['Bank charge', money(price.bankChargeGhs)], ['Transaction fee', `¥${price.transactionFeeRmb} = ${money(price.transactionFeeGhs)}`], ['Shipping', money(price.shippingGhs)], ['Final landed cost', money(price.landedCostGhs)], ['Profit margin', `${price.marginPercent}%`], ['Profit', money(price.profitGhs)], ['Calculated selling price', money(price.sellingPriceGhs)], ['Storefront price', formatPesewas(price.pricePesewas)]];
        return <div key={delivery} className="rounded-xl border bg-white p-3"><h5 className="mb-3 text-sm font-black text-[#014040]">{rmbDeliveryLabel(delivery)}</h5><dl className="space-y-2 text-xs">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-600">{label}</dt><dd className="text-right font-bold text-[#014040]">{value}</dd></div>)}</dl></div>;
      } catch (error) { return <p key={delivery} role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{rmbDeliveryLabel(delivery)}: {(error as Error).message}</p>; }
    })}</div>
    <p className="text-xs text-slate-500">Source costs stay in RMB. Payments → Exchange Rate &amp; Charges controls the conversion and markup. This breakdown is visible only in admin.</p>
  </section>;
}
