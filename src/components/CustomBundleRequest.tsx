import React, { useState } from 'react';
import { CheckCircle2, Layers3, Send, X } from 'lucide-react';
import type { CatalogueItem } from '../types';

export function CustomBundleRequest({ software }: { software: CatalogueItem[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const toggle = (itemId: string) => setSelected((old) => old.includes(itemId) ? old.filter((id) => id !== itemId) : [...old, itemId]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const chosen = software.filter((item) => selected.includes(item.itemId)).map((item) => ({ itemId: item.itemId, name: item.name }));
      const response = await fetch('/api/requests/custom-bundle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName, phone, email, notes, software: chosen }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send your request.');
      setMessage('Your details have been received. We will contact you within 24 hours.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to send your request.'); }
    finally { setBusy(false); }
  };

  return <>
    <article className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#7aa39b] bg-[#edf5f3] p-6 text-center">
      <span className="rounded-2xl bg-[#014040] p-3 text-[#05ef28]"><Layers3 className="h-7 w-7" /></span>
      <h2 className="mt-4 text-xl font-black text-[#014040]">Request a custom bundle</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">Choose the software you want bundled together and submit your details for a discounted quote.</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-5 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white">Build my bundle</button>
    </article>
    {open && <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#002b2b]/65 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}><section role="dialog" aria-modal="true" aria-label="Request a custom bundle" onClick={(event) => event.stopPropagation()} className="mx-auto my-4 max-w-3xl rounded-3xl bg-white p-5 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black text-[#014040]">Request a custom bundle</h2><p className="mt-1 text-sm text-slate-600">Select at least two software titles. We will contact you with a discounted quote.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-slate-100" aria-label="Close"><X /></button></div>
      {message ? <div className="mt-8 rounded-2xl bg-emerald-50 p-6 text-center text-emerald-900"><CheckCircle2 className="mx-auto h-9 w-9" /><p className="mt-3 font-black">{message}</p><button type="button" className="mt-5 rounded-xl bg-[#014040] px-5 py-2.5 text-sm font-black text-white" onClick={() => setOpen(false)}>Close</button></div> : <form onSubmit={submit} className="mt-6 space-y-5"><fieldset><legend className="text-sm font-black text-[#014040]">Software to include</legend><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-2xl border p-3 sm:grid-cols-2">{software.map((item) => <label key={item.itemId} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${selected.includes(item.itemId) ? 'border-[#014040] bg-[#edf5f3] text-[#014040]' : 'border-slate-200'}`}><input type="checkbox" checked={selected.includes(item.itemId)} onChange={() => toggle(item.itemId)} />{item.name}</label>)}</div></fieldset><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">Full name<input required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label className="text-xs font-bold text-slate-700">Phone number<input required type="tel" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="text-xs font-bold text-slate-700 sm:col-span-2">Email address<input required type="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="text-xs font-bold text-slate-700 sm:col-span-2">Notes (optional)<textarea rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div><button disabled={busy || selected.length < 2} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#014040] px-5 py-3.5 text-sm font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'Sending…' : 'Request discounted quote'}</button></form>}
    </section></div>}
  </>;
}
