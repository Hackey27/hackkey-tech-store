import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Copy, Download, RefreshCw, X } from 'lucide-react';
import type { CatalogueItem, Order } from '../types';
import { installationGuideForOrder } from '../data/installationGuides';

interface Props {
  order: Order;
  product?: Pick<CatalogueItem, 'installationGuides'>;
  onClose: () => void;
  onOrderUpdated: (order: Order) => void;
  onRefresh: () => Promise<Order>;
}

export function InstallationGuide({ order, product, onClose, onOrderUpdated, onRefresh }: Props) {
  const guide = useMemo(() => installationGuideForOrder(order, product), [order, product]);
  const storageKey = `hkt-install-guide:${order.orderId}:${guide?.id || 'none'}`;
  const [position, setPosition] = useState(() => {
    try { return Number(window.localStorage.getItem(storageKey) || 0); } catch { return 0; }
  });
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inputValue, setInputValue] = useState(order.customerInputValue || '');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, String(position)); } catch { /* private browsing */ }
  }, [position, storageKey]);

  if (!guide) return null;
  const stepIndex = Math.min(Math.max(0, position), guide.steps.length);
  const step = guide.steps[stepIndex];
  const complete = stepIndex === guide.steps.length;
  const percent = Math.round((stepIndex / guide.steps.length) * 100);
  const waitingForLicence = step?.kind === 'licence' && !order.activationCodeOrKey;
  const needsInput = step?.kind === 'customer-input' && !order.customerInputValue;
  const canContinue = !waitingForLicence && !needsInput && !busy;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setError('Could not copy automatically. Select and copy the text instead.'); }
  };

  const refreshOrder = async () => {
    setBusy(true); setError('');
    try {
      onOrderUpdated(await onRefresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to refresh the order.');
    } finally { setBusy(false); }
  };

  const submitInput = async () => {
    if (!inputValue.trim()) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/customer-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputValue: inputValue.trim() })
      });
      const data = await response.json();
      if (!response.ok || !data.order) throw new Error(data.error || 'Could not submit your code.');
      onOrderUpdated(data.order);
      setPosition((current) => Math.min(current + 1, guide.steps.length));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit your code.');
    } finally { setBusy(false); }
  };

  const command = guide.command;
  const downloadUrl = order.windowsInstallerUrl;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#001e1e]/80 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={guide.title}>
      <div className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#d8e7e4] px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#047857]">{order.productName} · {order.versionOrPlan} · {order.deliveryOs}</p>
            <h2 className="mt-1 text-xl font-black text-[#014040] sm:text-2xl">{guide.title}</h2>
            {guide.caption && <p className="mt-1 text-sm leading-5 text-slate-600">{guide.caption}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Close installation guide"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-5 pt-4 sm:px-7">
          <div className="flex justify-between text-sm font-bold text-[#014040]"><span>{complete ? 'Installation complete' : `Step ${stepIndex + 1} of ${guide.steps.length}`}</span><span>{percent}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#d8e7e4]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Installation progress"><div className="h-full rounded-full bg-[#05d92b] transition-[width] duration-300" style={{ width: `${percent}%` }} /></div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {complete ? (
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d9ffe0] text-[#047857]"><Check className="h-7 w-7" /></div>
              <h3 className="text-2xl font-black text-[#014040]">You have completed the installation steps</h3>
              <p className="text-sm leading-6 text-slate-700">You can revisit any step using Back. If the software still needs activation, return to your order to check its status or contact support.</p>
              {order.learningResourcesUrl && <div className="rounded-xl border border-[#b9d7cb] bg-[#f4faf7] p-5">
                <h4 className="flex items-center gap-2 font-bold text-[#014040]"><BookOpen className="h-5 w-5" />Continue learning</h4>
                <p className="mt-2 text-sm text-slate-600">Use these learning resources to get started with {order.productName} and explore its features.</p>
                <a href={order.learningResourcesUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center rounded-xl bg-[#014040] px-4 py-3 text-sm font-bold text-white">Open learning resources <ArrowRight className="ml-2 h-4 w-4" /></a>
              </div>}
              {!order.learningResourcesUrl && <p className="text-sm text-slate-500">Learning resources will appear here when they are added to this software version.</p>}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-black text-[#014040] sm:text-2xl">{step.title}</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{step.body}</p>
              </div>

              {step.kind === 'download' && <div className="rounded-xl border border-[#bdd9d1] bg-[#f4faf7] p-4">
                {downloadUrl ? <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-bold text-white"><Download className="h-4 w-4" />Download software</a>
                  : command ? <button type="button" onClick={() => void copy(command)} className="inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-bold text-white"><Copy className="h-4 w-4" />{copied ? 'Copied download command' : 'Copy download command'}</button>
                    : <p className="text-sm text-amber-800">A download link has not been added to this order yet. Please contact support.</p>}
              </div>}

              {step.kind === 'command' && command && <div className="rounded-xl border border-[#bdd9d1] bg-[#f4faf7] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Command for your ordered version</p>
                <code className="mt-2 block overflow-x-auto rounded-lg bg-[#062e2e] p-3 text-sm text-white">{command}</code>
                <button type="button" onClick={() => void copy(command)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#014040] px-4 py-2 text-sm font-bold text-white"><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy command'}</button>
              </div>}

              {step.kind === 'licence' && <div className="rounded-xl border border-[#bdd9d1] bg-[#f4faf7] p-4">
                {order.activationCodeOrKey ? <>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your licence</p>
                  <p className="mt-2 break-all font-mono text-base font-bold text-[#014040]">{order.activationCodeOrKey}</p>
                  <button type="button" onClick={() => void copy(order.activationCodeOrKey!)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#014040] px-4 py-2 text-sm font-bold text-white"><Copy className="h-4 w-4" />{copied ? 'Copied' : 'Copy licence'}</button>
                </> : <>
                  <p className="text-sm text-slate-700">Your licence has not been added to this order yet. Keep this guide open and check again shortly.</p>
                  <button type="button" disabled={busy} onClick={() => void refreshOrder()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#014040] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><RefreshCw className="h-4 w-4" />Check for licence</button>
                </>}
              </div>}

              {step.kind === 'customer-input' && <div className="rounded-xl border border-[#bdd9d1] bg-[#f4faf7] p-4">
                {order.customerInputValue ? <p className="text-sm font-bold text-[#014040]">Your {order.customerInputType || 'code'} was submitted: <span className="break-all font-mono">{order.customerInputValue}</span></p> : <>
                  <label className="block text-sm font-bold text-[#014040]" htmlFor="installation-customer-input">Paste your {order.customerInputType || 'code'}</label>
                  <input id="installation-customer-input" value={inputValue} onChange={(event) => setInputValue(event.target.value)} className="mt-2 w-full rounded-xl border border-[#9ebeb7] bg-white px-4 py-3 font-mono text-sm" autoComplete="off" />
                  <button type="button" disabled={busy || !inputValue.trim()} onClick={() => void submitInput()} className="mt-3 rounded-xl bg-[#014040] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Submit {order.customerInputType || 'code'}</button>
                </>}
              </div>}

              {step.actionLabel && step.actionUrl && <a href={step.actionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-bold text-white hover:bg-[#025656]">{step.actionLabel}<ArrowRight className="h-4 w-4" /></a>}

              {step.images?.map((picture) => <figure key={picture.src} className="overflow-hidden rounded-xl border border-[#d8e7e4] bg-slate-50 p-2">
                <div className="relative mx-auto w-fit max-w-full">
                  <img src={picture.src} alt={picture.alt} className="block h-auto max-h-[55dvh] max-w-full object-contain" />
                  {picture.markers?.map((marker, index) => <span key={`${marker.label}-${index}`} className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>
                    <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/70 motion-reduce:animate-none" />
                    <span className="relative block h-5 w-5 rounded-full border-2 border-white bg-amber-500 shadow-lg" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#3b2905] px-2 py-1 text-xs font-bold text-white shadow-lg group-hover:block group-focus-within:block">{marker.label}</span>
                  </span>)}
                </div>
                <figcaption className="mt-2 text-center text-xs text-slate-500">{picture.alt} · Amber markers show where to act</figcaption>
              </figure>)}
              {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8e7e4] px-5 py-4 sm:px-7">
          <button type="button" disabled={stepIndex === 0} onClick={() => setPosition((current) => Math.max(0, current - 1))} className="inline-flex items-center gap-2 rounded-xl border border-[#bdd1cc] px-4 py-2.5 text-sm font-bold text-[#014040] disabled:opacity-40"><ArrowLeft className="h-4 w-4" />Back</button>
          <div className="flex gap-2">
            {step?.optional && <button type="button" onClick={() => setPosition((current) => Math.min(current + 1, guide.steps.length))} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600">Skip</button>}
            <button type="button" disabled={complete ? false : !canContinue} onClick={() => complete ? onClose() : setPosition((current) => Math.min(current + 1, guide.steps.length))} className="inline-flex items-center gap-2 rounded-xl bg-[#05ef28] px-5 py-2.5 text-sm font-black text-[#014040] disabled:opacity-45">{complete ? 'Back to order' : stepIndex === guide.steps.length - 1 ? 'Finish' : 'Done, next step'}{!complete && <ArrowRight className="h-4 w-4" />}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
