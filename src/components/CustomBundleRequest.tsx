import React, { memo, useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Layers3, Search, Send, X } from 'lucide-react';
import type { CatalogueItem } from '../types';
import { bundleOperatingSystems, bundleVariantsForOs, selectableBundleVariants } from '../utils/customBundle';
import { useBackDismiss } from '../utils/useBackDismiss';

type SoftwareSelection = { os: string; variantId: string };

const SoftwareChoice = memo(function SoftwareChoice({ item, selection, onToggle, onOsChange, onVariantChange }: {
  item: CatalogueItem;
  selection?: SoftwareSelection;
  onToggle: (itemId: string) => void;
  onOsChange: (itemId: string, os: string) => void;
  onVariantChange: (itemId: string, variantId: string) => void;
}) {
  const systems = useMemo(() => bundleOperatingSystems(item), [item]);
  const versions = useMemo(() => selection?.os ? bundleVariantsForOs(item, selection.os) : [], [item, selection?.os]);
  return <div className={`rounded-xl border p-3 ${selection ? 'border-[#014040] bg-[#f2faf7]' : 'border-slate-200 bg-white'}`}>
    <button type="button" onClick={() => onToggle(item.itemId)} aria-pressed={Boolean(selection)} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="min-w-0 text-sm font-bold text-[#014040]">{item.name}</span>
      <span className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-black ${selection ? 'bg-[#014040] text-white' : 'border border-[#a7c4bd] text-[#014040]'}`}>{selection ? 'Selected' : 'Add'}</span>
    </button>
    {selection && <div className="mt-3 grid gap-3 border-t border-[#d8e7e4] pt-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-slate-700">Operating system<select required value={selection.os} onChange={(event) => onOsChange(item.itemId, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">{!selection.os && <option value="">Choose OS</option>}{systems.map((os) => <option key={os} value={os}>{os}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-700">Version<select required disabled={!selection.os} value={selection.variantId} onChange={(event) => onVariantChange(item.itemId, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 disabled:opacity-50">{!selection.variantId && <option value="">Choose version</option>}{versions.map((variant) => <option key={variant.variantId} value={variant.variantId}>Version {variant.versionOrPlan}{variant.latest ? ' · Latest' : ''}</option>)}</select></label>
    </div>}
  </div>;
});

export function CustomBundleRequest({ software }: { software: CatalogueItem[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'software' | 'details'>('software');
  const [selected, setSelected] = useState<Record<string, SoftwareSelection>>({});
  const [query, setQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const closeForm = useBackDismiss(open, () => setOpen(false));

  const selectedItems = useMemo(() => software.filter((item) => selected[item.itemId]), [software, selected]);
  const visibleSoftware = useMemo(() => software.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [software, query]);
  const ready = selectedItems.length >= 2 && selectedItems.every((item) => selected[item.itemId]?.os && selected[item.itemId]?.variantId);

  const toggle = useCallback((itemId: string) => {
    const item = software.find((entry) => entry.itemId === itemId);
    if (!item) return;
    setSelected((old) => {
      if (old[itemId]) { const next = { ...old }; delete next[itemId]; return next; }
      const systems = bundleOperatingSystems(item);
      const os = systems.length === 1 ? systems[0] : '';
      const variants = os ? bundleVariantsForOs(item, os) : [];
      return { ...old, [itemId]: { os, variantId: variants.length === 1 ? variants[0].variantId : '' } };
    });
  }, [software]);
  const chooseOs = useCallback((itemId: string, os: string) => {
    const item = software.find((entry) => entry.itemId === itemId);
    if (!item) return;
    const variants = bundleVariantsForOs(item, os);
    setSelected((old) => ({ ...old, [itemId]: { os, variantId: variants.length === 1 ? variants[0].variantId : '' } }));
  }, [software]);
  const chooseVariant = useCallback((itemId: string, variantId: string) => {
    setSelected((old) => old[itemId] ? { ...old, [itemId]: { ...old[itemId], variantId } } : old);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError('');
    try {
      const chosen = selectedItems.map((item) => ({ itemId: item.itemId, variantId: selected[item.itemId].variantId, os: selected[item.itemId].os }));
      const response = await fetch('/api/requests/custom-bundle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName, phone, email, notes, software: chosen }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send your request.');
      setSubmitted(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to send your request.'); }
    finally { setBusy(false); }
  };

  return <>
    <article className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#7aa39b] bg-[#edf5f3] p-6 text-center">
      <span className="rounded-2xl bg-[#014040] p-3 text-[#05ef28]"><Layers3 className="h-7 w-7" /></span>
      <h2 className="mt-4 text-xl font-black text-[#014040]">Request a custom bundle</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Choose the software, versions and operating systems you want bundled together for a discounted quote.</p>
      <button type="button" onClick={() => { setStep('software'); setError(''); setSubmitted(false); setOpen(true); }} className="mt-5 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white">Build my bundle</button>
    </article>
    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#002b2b]/75 p-2 sm:p-4" onClick={closeForm}>
      <section role="dialog" aria-modal="true" aria-label="Request a custom bundle" onClick={(event) => event.stopPropagation()} className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#d8e7e4] p-5 sm:px-8"><div><h2 className="text-xl font-black text-[#014040] sm:text-2xl">Request a custom bundle</h2><p className="mt-1 text-sm text-slate-600">{submitted ? 'Request received' : step === 'software' ? '1 of 2 · Choose software, version and OS' : '2 of 2 · Your contact details'}</p></div><button type="button" onClick={closeForm} className="shrink-0 rounded-full p-2 hover:bg-slate-100" aria-label="Close"><X /></button></div>
        {submitted ? <div className="overflow-y-auto p-6 text-center text-emerald-900 sm:p-8"><CheckCircle2 className="mx-auto h-10 w-10" /><p className="mt-3 font-black">Your details have been received. We will contact you within 24 hours.</p><button type="button" className="mt-5 rounded-xl bg-[#014040] px-5 py-2.5 text-sm font-black text-white" onClick={closeForm}>Close</button></div>
          : step === 'software' ? <>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:px-8"><p className="text-sm text-slate-600">Select at least two titles. Pick an operating system and version for each one.</p><label className="relative mt-4 block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><span className="sr-only">Search software</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find software" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm" /></label><div className="mt-4 grid gap-3">{visibleSoftware.map((item) => <SoftwareChoice key={item.itemId} item={item} selection={selected[item.itemId]} onToggle={toggle} onOsChange={chooseOs} onVariantChange={chooseVariant} />)}</div>{!visibleSoftware.length && <p className="mt-5 text-sm text-slate-500">No software matches your search.</p>}</div>
            <div className="shrink-0 border-t border-[#d8e7e4] bg-white p-4 sm:px-8"><button type="button" disabled={!ready} onClick={() => { setError(''); setStep('details'); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#014040] px-5 py-3.5 text-sm font-black text-white disabled:opacity-50">Continue with {selectedItems.length} selected <ArrowRight className="h-4 w-4" /></button>{selectedItems.length > 0 && !ready && <p className="mt-2 text-center text-xs text-slate-600">Choose at least two titles and complete their OS and version selections.</p>}</div>
          </> : <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:px-8"><div className="rounded-xl border border-[#d8e7e4] bg-[#f2faf7] p-4"><p className="text-xs font-black uppercase tracking-wide text-[#014040]">Your bundle · {selectedItems.length} software titles</p><ul className="mt-2 space-y-1.5 text-sm text-slate-700">{selectedItems.map((item) => { const choice = selected[item.itemId]; const variant = selectableBundleVariants(item).find((value) => value.variantId === choice.variantId); return <li key={item.itemId}><b>{item.name}</b> · {variant?.versionOrPlan} · {choice.os}</li>; })}</ul></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">Full name<input required autoComplete="name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label className="text-xs font-bold text-slate-700">Phone number<input required type="tel" autoComplete="tel" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="text-xs font-bold text-slate-700 sm:col-span-2">Email address<input required type="email" autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="text-xs font-bold text-slate-700 sm:col-span-2">Notes (optional)<textarea rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}</div>
            <div className="flex shrink-0 gap-2 border-t border-[#d8e7e4] bg-white p-4 sm:px-8"><button type="button" onClick={() => setStep('software')} className="inline-flex items-center gap-1.5 rounded-xl border border-[#bdd1cc] px-4 py-3 text-sm font-bold text-[#014040]"><ArrowLeft className="h-4 w-4" />Back</button><button disabled={busy || !ready} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'Sending…' : 'Submit details'}</button></div>
          </form>}
      </section>
    </div>}
  </>;
}
