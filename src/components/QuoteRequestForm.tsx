import React, { useState } from 'react';
import { Send } from 'lucide-react';
import type { CatalogueItem, ServiceField } from '../types';

function Input({ field, value, onChange }: { field: ServiceField; value: string; onChange: (value: string) => void }) {
  const common = { required: field.required, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value), className: 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm', placeholder: field.placeholder };
  if (field.type === 'textarea') return <textarea {...common} rows={3} />;
  if (field.type === 'select' || field.type === 'radio') return <select {...common}><option value="">Select…</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>;
  return <input {...common} type={field.type === 'datetime' ? 'datetime-local' : field.type} />;
}

export function QuoteRequestForm({ item, submitLabel = 'Submit details' }: { item: CatalogueItem; submitLabel?: string }) {
  const fields = item.kind === 'service' ? item.service?.fields || [] : [];
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const endpoint = item.kind === 'laptop' ? '/api/requests/laptop-enquiry' : '/api/services/submit';
      const payload = item.kind === 'laptop'
        ? { customerName, phone, email, laptopId: item.itemId, laptopName: item.name, offerPrice: item.pricePesewas, notes: answers.notes, location: answers.location }
        : { serviceId: item.itemId, serviceName: item.name, customerName, phone, email, answers, summary: answers.summary };
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send your request.');
      setMessage('Your details have been received. We will contact you within 24 hours.');
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Unable to send your request.'); }
    finally { setBusy(false); }
  };

  return <form onSubmit={submit} className="space-y-4">
    <div><h2 className="text-xl font-black text-[#014040]">{item.kind === 'laptop' ? 'I am interested' : 'Get a quote'}</h2><p className="mt-1 text-xs leading-5 text-slate-600">Tell us what you need and we will contact you with the next steps.</p></div>
    <label className="block text-xs font-bold text-slate-700">Full name<input required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></label>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      <label className="block text-xs font-bold text-slate-700">Phone<input required type="tel" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="block text-xs font-bold text-slate-700">Email<input required type="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    </div>
    {item.kind === 'laptop' && <><label className="block text-xs font-bold text-slate-700">Location<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={answers.location || ''} onChange={(e) => setAnswers((old) => ({ ...old, location: e.target.value }))} /></label><label className="block text-xs font-bold text-slate-700">Message<textarea rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={answers.notes || ''} onChange={(e) => setAnswers((old) => ({ ...old, notes: e.target.value }))} /></label></>}
    {fields.map((field) => {
      if (['name', 'fullName', 'phone', 'email'].includes(field.key)) return null;
      if (field.showIf && answers[field.showIf.field] !== field.showIf.equals) return null;
      return <label key={field.key} className="block text-xs font-bold text-slate-700">{field.label}<Input field={field} value={answers[field.key] || ''} onChange={(value) => setAnswers((old) => ({ ...old, [field.key]: value }))} />{field.helper && <span className="mt-1 block font-normal text-slate-500">{field.helper}</span>}</label>;
    })}
    {message && <p role="status" className="rounded-xl bg-[#edf5f3] p-3 text-xs font-bold text-[#014040]">{message}</p>}
    <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#014040] px-5 py-3.5 text-sm font-black text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'Sending…' : submitLabel}</button>
  </form>;
}
