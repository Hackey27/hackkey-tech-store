import React, { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CatalogueItem, Variant } from '../types';
import { formatPesewas } from '../utils/money';
import { useBackDismiss } from '../utils/useBackDismiss';

export interface CardChoiceRequest {
  product: CatalogueItem;
  mode: 'buy-latest' | 'add';
}

const osFor = (variant: Variant) => variant.osList?.length ? variant.osList : [variant.os || 'Windows'];

export function availableCardChoices(product: CatalogueItem, mode: CardChoiceRequest['mode']): Variant[] {
  const available = (product.variants || []).filter((variant) => variant.available);
  if (mode === 'add') return available;
  const latest = available.find((variant) => variant.latest) || available[0];
  return latest ? available.filter((variant) => variant.versionOrPlan === latest.versionOrPlan) : [];
}

export function CardSoftwareChoice({ request, onChoose, onClose }: {
  request: CardChoiceRequest;
  onChoose: (variant: Variant, os: string) => void;
  onClose: () => void;
}) {
  const [os, setOs] = useState('');
  const [variantId, setVariantId] = useState('');
  const pendingChoice = useRef<{ variant: Variant; os: string } | null>(null);
  const dismiss = useBackDismiss(true, () => {
    onClose();
    const pending = pendingChoice.current;
    pendingChoice.current = null;
    if (pending) onChoose(pending.variant, pending.os);
  });
  const variants = useMemo(() => availableCardChoices(request.product, request.mode), [request]);
  const systems = useMemo(() => [...new Set(variants.flatMap(osFor))], [variants]);
  const forOs = useMemo(() => variants.filter((variant) => osFor(variant).includes(os)), [variants, os]);
  const chosen = forOs.find((variant) => variant.variantId === variantId) || (request.mode === 'buy-latest' ? forOs[0] : undefined);

  return <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[#002b2b]/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="card-software-choice-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><h2 id="card-software-choice-title" className="text-lg font-black text-[#014040]">{request.mode === 'add' ? 'Choose OS and version' : 'Choose your operating system'}</h2><p className="mt-1 text-sm text-slate-600">{request.product.name}</p></div><button type="button" onClick={dismiss} aria-label="Close selection" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="mt-5 space-y-4"><div><p className="mb-2 text-xs font-black text-[#014040]">Operating system</p><div className="grid grid-cols-2 gap-2">{systems.map((option) => <button key={option} type="button" onClick={() => { setOs(option); setVariantId(''); }} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${os === option ? 'border-[#014040] bg-[#edf5f3] text-[#014040]' : 'border-slate-200 text-slate-700'}`}>{option}</button>)}</div></div>
        {os && request.mode === 'add' && <div><p className="mb-2 text-xs font-black text-[#014040]">Version</p><div className="max-h-52 space-y-2 overflow-y-auto">{forOs.map((variant) => <button key={variant.variantId} type="button" onClick={() => setVariantId(variant.variantId)} className={`flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm ${variantId === variant.variantId ? 'border-[#014040] bg-[#edf5f3]' : 'border-slate-200'}`}><span className="font-bold">{variant.versionOrPlan}{variant.latest ? ' · Latest' : ''}</span><span className="shrink-0 font-black text-[#014040]">{formatPesewas(variant.payablePricePesewas ?? Math.round(variant.priceGhs * 100))}</span></button>)}</div></div>}
        {os && request.mode === 'buy-latest' && chosen && <p className="rounded-xl bg-[#edf5f3] p-3 text-sm text-[#014040]">Latest version <b>{chosen.versionOrPlan}</b> · {formatPesewas(chosen.payablePricePesewas ?? Math.round(chosen.priceGhs * 100))}</p>}
      </div>
      <button type="button" disabled={!chosen || !os} onClick={() => { if (chosen) { pendingChoice.current = { variant: chosen, os }; dismiss(); } }} className="mt-5 w-full rounded-xl bg-[#05ef28] px-4 py-3 text-sm font-black text-[#014040] disabled:opacity-50">{request.mode === 'add' ? 'Add to cart' : 'Continue to buy'}</button>
    </section>
  </div>;
}
