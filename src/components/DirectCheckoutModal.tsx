import React, { useState } from 'react';
import { CreditCard, X } from 'lucide-react';
import type { CartItem } from './CartView';
import type { Order, PublicPaymentOptions } from '../types';
import { cartItemToCheckoutItem } from '../utils/checkout';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { FulfilmentTimeNotice } from './FulfilmentTimeNotice';
import { cartDeliveryNotice } from '../utils/cartDeliveryNotice';
import { useBackDismiss } from '../utils/useBackDismiss';
import { PaymentMethodPanel } from './PaymentMethodPanel';
import { STORE_COPY } from '../config/storeCopy';
import { OrderPaymentWatcher } from './OrderPaymentWatcher';

export function DirectCheckoutModal({ item, paymentOptions, onClose, onPaymentResolved }: { item: CartItem; paymentOptions?: PublicPaymentOptions; onClose: () => void; onPaymentResolved?: (order: Order) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState<{ options: PublicPaymentOptions; orderIds: string[]; totalPesewas: number; authorizationUrl?: string } | null>(null);
  const [paymentResolved, setPaymentResolved] = useState<Order | null>(null);
  const total = resolveLinePricePesewas({ item: item.product, variant: item.variant, serviceOption: item.serviceOption, quantity: item.quantity }).totalPesewas;
  const deliveryNotice = cartDeliveryNotice(item);
  const closeForm = useBackDismiss(true, onClose);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/orders/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: `${firstName.trim()} ${lastName.trim()}`, phone: phone.trim(), email: email.trim(), items: [cartItemToCheckoutItem(item)] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to place order.');
      if (data.paymentOptions?.mode === 'paystack' && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      if (!data.paymentOptions) throw new Error(STORE_COPY.payment.unavailable);
      setPaymentResult({ options: data.paymentOptions, orderIds: data.orders?.map((order: { orderId: string }) => order.orderId) || [], totalPesewas: data.totalPesewas, authorizationUrl: data.authorizationUrl });
      setBusy(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to place order.');
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#001f1f]/75 p-4" role="dialog" aria-modal="true" aria-label="Buy now">
    <form onSubmit={submit} className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <button type="button" onClick={closeForm} className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
      {paymentResult ? <div className="pr-8">{paymentResolved ? <><p className="text-xs font-black uppercase tracking-wider text-[#047857]">Order updated</p><h2 className="mt-1 text-2xl font-black text-[#014040]">{paymentResolved.paymentStatus === 'paid' ? STORE_COPY.payment.confirmedTitle : STORE_COPY.payment.deferredTitle}</h2><p className="mt-2 text-sm text-slate-600">{paymentResolved.paymentStatus === 'paid' ? STORE_COPY.payment.confirmedDescription : STORE_COPY.payment.deferredDescription}</p><button type="button" className="mt-5 w-full rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white" onClick={() => onPaymentResolved?.(paymentResolved)}>{STORE_COPY.payment.seeNextSteps}</button></> : <><p className="text-xs font-black uppercase tracking-wider text-[#047857]">{STORE_COPY.payment.paymentPending}</p><h2 className="mt-1 text-2xl font-black text-[#014040]">{STORE_COPY.payment.awaitingConfirmation}</h2><p className="mt-2 text-sm text-slate-600">{STORE_COPY.payment.paymentPendingDescription}</p><div className="mt-5"><PaymentMethodPanel options={paymentResult.options} orderIds={paymentResult.orderIds} totalPesewas={paymentResult.totalPesewas} authorizationUrl={paymentResult.authorizationUrl} /></div><div className="mt-3"><OrderPaymentWatcher orderId={paymentResult.orderIds[0]} onResolved={setPaymentResolved} /></div></>}</div> : <>
      <div className="pr-10"><p className="text-xs font-black uppercase tracking-wider text-[#047857]">Buy now</p><h2 className="mt-1 text-2xl font-black text-[#014040]">{item.product.name}</h2><p className="mt-2 text-sm text-slate-600">Enter your details to continue directly to secure payment. This item will not be added to your cart.</p></div>
      {deliveryNotice.enabled && <div className="mt-5"><FulfilmentTimeNotice kind={deliveryNotice.kind} beforePayment customerInputLabel={deliveryNotice.customerInputLabel} /></div>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">First name<input required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
        <label className="text-xs font-bold text-slate-700">Last name<input required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
        <label className="text-xs font-bold text-slate-700">Phone<input required type="tel" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="text-xs font-bold text-slate-700">Email<input required type="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      </div>
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-5 py-3.5 text-sm font-black text-[#014040] disabled:opacity-50"><CreditCard className="h-4 w-4" />{busy ? 'Starting payment…' : `${paymentOptions?.mode === 'momo' ? STORE_COPY.payment.momoOnlyButton : paymentOptions?.mode === 'both' ? STORE_COPY.payment.bothButton : 'Submit and Pay'} — ${formatPesewas(total)}`}</button>
      </>}
    </form>
  </div>;
}
