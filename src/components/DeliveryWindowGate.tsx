import React from 'react';
import { X } from 'lucide-react';
import type { CartItem } from './CartView';
import { FulfilmentTimeNotice } from './FulfilmentTimeNotice';
import { cartDeliveryNotice } from '../utils/cartDeliveryNotice';

export function DeliveryWindowGate({ item, onConfirm, onCancel }: { item: CartItem; onConfirm: () => void; onCancel: () => void }) {
  const notice = cartDeliveryNotice(item);
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#001f1f]/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Delivery-window information">
    <section className="relative w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
      <button type="button" onClick={onCancel} className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
      <div className="pr-10"><p className="text-xs font-black uppercase tracking-wider text-amber-700">Before you continue</p><h2 className="mt-1 text-xl font-black text-[#014040]">Please note the delivery time</h2></div>
      <div className="mt-4"><FulfilmentTimeNotice kind={notice.kind} beforePayment customerInputLabel={notice.customerInputLabel} /></div>
      <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700">Cancel</button><button type="button" onClick={onConfirm} className="rounded-xl bg-[#014040] px-4 py-3 text-sm font-black text-white">Understood</button></div>
    </section>
  </div>;
}
