import React, { useState } from 'react';
import { Check, Copy, CreditCard, MessageCircle, Smartphone } from 'lucide-react';
import { PublicPaymentOptions } from '../types';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas } from '../utils/money';

interface PaymentMethodPanelProps {
  options: PublicPaymentOptions;
  orderIds: string[];
  totalPesewas: number;
  authorizationUrl?: string;
}

function whatsappRecipient(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return `233${digits.slice(1)}`;
  return digits;
}

export function PaymentMethodPanel({ options, orderIds, totalPesewas, authorizationUrl }: PaymentMethodPanelProps) {
  const [copied, setCopied] = useState('');
  const refs = orderIds.join(', ');
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1_500);
    } catch {
      setCopied('');
    }
  };
  const copyButton = (key: string, value: string, label: string) => <button type="button" onClick={() => void copy(key, value)} className="inline-flex items-center gap-1 rounded-lg border border-[#9dbbb5] bg-white px-2 py-1 text-[11px] font-black text-[#014040] transition motion-reduce:transition-none hover:bg-[#edf5f3]" aria-label={`${STORE_COPY.payment.copy} ${label}`}>{copied === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === key ? STORE_COPY.payment.copied : STORE_COPY.payment.copy}</button>;
  const message = STORE_COPY.payment.screenshotMessage(refs);
  const whatsappUrl = `https://wa.me/${whatsappRecipient(options.momo.whatsappNumber)}?text=${encodeURIComponent(message)}`;
  const momo = <div className="space-y-4 rounded-2xl border border-[#9dbbb5] bg-[#f3faf8] p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-[#014040] p-2 text-[#05ef28]"><Smartphone className="h-5 w-5" /></span><div><h4 className="font-black text-[#014040]">{STORE_COPY.payment.momoTitle}</h4><p className="mt-1 text-xs leading-5 text-slate-600">{STORE_COPY.payment.momoIntro}</p></div></div>
    <div className="rounded-xl bg-white p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{STORE_COPY.payment.merchantId}</p><div className="mt-1 flex flex-wrap items-center justify-between gap-2"><div><b className="font-mono text-base text-[#014040]">{options.momo.merchantId}</b><p className="text-xs text-slate-600">{options.momo.merchantName}</p></div>{copyButton('merchant', options.momo.merchantId, STORE_COPY.payment.merchantId)}</div></div>
    <div className="rounded-xl bg-white p-3"><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{STORE_COPY.payment.transferNumber}</p><div className="mt-1 flex flex-wrap items-center justify-between gap-2"><div><b className="font-mono text-base text-[#014040]">{options.momo.transferNumber}</b><p className="text-xs text-slate-600">{options.momo.transferName}</p></div>{copyButton('transfer', options.momo.transferNumber, STORE_COPY.payment.transferNumber)}</div></div>
    <div className="rounded-xl border-l-4 border-[#05ef28] bg-white p-3"><p className="text-xs leading-5 text-slate-700">{STORE_COPY.payment.screenshotInstruction(options.momo.whatsappNumber)}</p><div className="mt-2 flex flex-wrap gap-2">{copyButton('whatsapp', options.momo.whatsappNumber, 'WhatsApp number')}<a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#25d366] px-3 py-1.5 text-xs font-black text-[#014040]"><MessageCircle className="h-4 w-4" />{STORE_COPY.payment.sendScreenshot}</a></div></div>
    <div className="rounded-xl bg-[#014040] p-3 text-white"><p className="text-[10px] font-bold uppercase tracking-wider text-white/65">{STORE_COPY.payment.orderReference}</p><p className="mt-1 break-all font-mono text-xs font-bold">{refs}</p><p className="mt-2 text-lg font-black text-[#05ef28]">{formatPesewas(totalPesewas)}</p></div>
  </div>;

  return <div className="space-y-3">
    {authorizationUrl && <a href={authorizationUrl} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-5 py-3.5 text-sm font-black text-[#014040] transition motion-reduce:transition-none hover:bg-[#04d824]"><CreditCard className="h-4 w-4" />{STORE_COPY.payment.paystackButton}</a>}
    {options.mode === 'momo' ? momo : options.mode === 'both' ? <details className="group rounded-2xl border border-[#cbdcd9] bg-white p-3"><summary className="cursor-pointer list-none text-sm font-black text-[#014040] marker:hidden">{STORE_COPY.payment.otherOptions}</summary><div className="mt-3">{momo}</div></details> : null}
  </div>;
}
