import React, { useState } from 'react';
import { CreditCard, X } from 'lucide-react';
import type { CartItem } from './CartView';
import type { Order, PublicPaymentOptions } from '../../shared/types';
import { cartItemToCheckoutItem } from '../utils/checkout';
import { cartLineDetail } from '../utils/cartLineDetail';
import { formatPesewas, resolveLinePricePesewas } from '../../shared/money';
import { FulfilmentTimeNotice } from './FulfilmentTimeNotice';
import { cartDeliveryNotice } from '../utils/cartDeliveryNotice';
import { useBackDismiss } from '../utils/useBackDismiss';
import { PaymentMethodPanel } from './PaymentMethodPanel';
import { STORE_COPY } from '../config/storeCopy';
import { OrderPaymentWatcher } from './OrderPaymentWatcher';

/**
 * The one checkout form, used by "Buy now" and by the cart alike.
 *
 * Both paths post the same items[] to the same route, so they only ever
 * differed in their wrapper: a modal for one item, and a cramped panel inside
 * the cart summary for several. Two forms against one endpoint drift, and the
 * cart copy had already fallen behind. This is that one form.
 */
export interface CheckoutModalProps {
  items: CartItem[];
  /** 'cart' empties the cart once the orders exist, and names the cart in its heading. */
  mode: 'buy-now' | 'cart';
  paymentOptions?: PublicPaymentOptions;
  onClose: () => void;
  onPaymentResolved?: (order: Order) => void;
  /** Fired once the orders exist, so the caller can empty the cart. */
  onSubmitted?: () => void;
}

const linePesewas = (item: CartItem) => resolveLinePricePesewas({
  item: item.product,
  variant: item.variant,
  serviceOption: item.serviceOption,
  quantity: item.quantity
}).totalPesewas;

export function CheckoutModal({ items, mode, paymentOptions, onClose, onPaymentResolved, onSubmitted }: CheckoutModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState<{ options: PublicPaymentOptions; orderIds: string[]; cartId?: string; totalPesewas: number; authorizationUrl?: string } | null>(null);
  const [paymentResolved, setPaymentResolved] = useState<Order | null>(null);
  const [licenceAgreed, setLicenceAgreed] = useState(false);
  const restrictedSoftware = items.filter((item) => item.product.kind === 'product' && item.product.showSingleLicenceDisclaimer === true);

  const total = items.reduce((sum, item) => sum + linePesewas(item), 0);
  const closeForm = useBackDismiss(true, onClose);

  // One notice per distinct kind: a cart of three licences must not stack the
  // same sentence three times.
  const notices = items.map(cartDeliveryNotice).filter((notice) => notice.enabled);
  const uniqueNotices = notices.filter((notice, index) => notices.findIndex(
    (other) => other.kind === notice.kind && other.customerInputLabel === notice.customerInputLabel
  ) === index);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/orders/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // The browser sends what was CHOSEN, never what it costs: the server
        // prices every line from the catalogue.
        body: JSON.stringify({ customerName: `${firstName.trim()} ${lastName.trim()}`, phone: phone.trim(), email: email.trim(), items: items.map(cartItemToCheckoutItem) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to place order.');

      // The orders exist from here on, so the cart has served its purpose
      // whichever payment route follows.
      onSubmitted?.();

      if (data.paymentOptions?.mode === 'paystack' && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      if (!data.paymentOptions) throw new Error(STORE_COPY.payment.unavailable);
      setPaymentResult({
        options: data.paymentOptions,
        orderIds: data.orders?.map((order: { orderId: string }) => order.orderId) || [],
        cartId: data.cartId,
        totalPesewas: data.totalPesewas,
        authorizationUrl: data.authorizationUrl
      });
      setBusy(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to place order.');
      setBusy(false);
    }
  };

  const eyebrow = mode === 'cart' ? STORE_COPY.cart.checkoutEyebrow : 'Buy now';
  const heading = mode === 'cart' ? STORE_COPY.cart.title : items[0]?.product.name;
  const lead = mode === 'cart'
    ? STORE_COPY.cart.checkoutLead(items.length)
    : 'Enter your details to continue directly to secure payment. This item will not be added to your cart.';

  // Gate the shared checkout, so card purchases, selected versions and cart
  // purchases all require agreement before customer details are rendered.
  if (restrictedSoftware.length > 0 && !licenceAgreed) {
    return <div className="hk-overlay-enter fixed inset-0 z-[90] flex items-center justify-center bg-[#001f1f]/75 p-4" role="dialog" aria-modal="true" aria-labelledby="licence-disclaimer-title" aria-describedby="licence-disclaimer-text" onKeyDown={(event) => { if (event.key === 'Escape') closeForm(); }}>
      <div className="hk-modal-enter relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <button type="button" onClick={closeForm} className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close licence disclaimer"><X className="h-5 w-5" /></button>
        <h2 id="licence-disclaimer-title" className="pr-10 text-2xl font-black text-[#014040]">Before installation</h2>
        <p className="mt-3 text-sm font-bold text-[#014040]">{[...new Set(restrictedSoftware.map(item => item.product.name))].join(', ')}</p>
        <p id="licence-disclaimer-text" className="mt-4 rounded-2xl border-l-4 border-[#e0a800] bg-[#fffaf0] p-4 text-sm leading-7 text-[#8a5b00]">{STORE_COPY.deviceLock.before}</p>
        <button type="button" autoFocus onClick={() => setLicenceAgreed(true)} className="hk-pressable mt-6 w-full rounded-xl bg-[#05ef28] px-5 py-3.5 text-sm font-black text-[#014040]">Agree</button>
      </div>
    </div>;
  }

  return <div className="hk-overlay-enter fixed inset-0 z-[90] flex items-center justify-center bg-[#001f1f]/75 p-4" role="dialog" aria-modal="true" aria-label={eyebrow}>
    <form onSubmit={submit} className="hk-modal-enter relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <button type="button" onClick={closeForm} className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
      {paymentResult ? <div className="pr-8">{paymentResolved ? <><p className="text-xs font-black uppercase tracking-wider text-[#047857]">Order updated</p><h2 className="mt-1 text-2xl font-black text-[#014040]">{paymentResolved.paymentStatus === 'paid' ? STORE_COPY.payment.confirmedTitle : STORE_COPY.payment.deferredTitle}</h2><p className="mt-2 text-sm text-slate-600">{paymentResolved.paymentStatus === 'paid' ? STORE_COPY.payment.confirmedDescription : STORE_COPY.payment.deferredDescription}</p><button type="button" className="mt-5 w-full rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white" onClick={() => onPaymentResolved?.(paymentResolved)}>{STORE_COPY.payment.seeNextSteps}</button></> : <><p className="text-xs font-black uppercase tracking-wider text-[#047857]">{STORE_COPY.payment.paymentPending}</p><h2 className="mt-1 text-2xl font-black text-[#014040]">{STORE_COPY.payment.awaitingConfirmation}</h2><p className="mt-2 text-sm text-slate-600">{STORE_COPY.payment.paymentPendingDescription}</p>
        {paymentResult.cartId && <div className="mt-4 rounded-xl bg-[#edf5f3] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{STORE_COPY.cart.cartReference}</p><p className="mt-0.5 break-all font-mono text-sm font-black text-[#014040]">{paymentResult.cartId}</p></div>}
        <div className="mt-5"><PaymentMethodPanel options={paymentResult.options} orderIds={paymentResult.orderIds} reference={paymentResult.cartId} totalPesewas={paymentResult.totalPesewas} authorizationUrl={paymentResult.authorizationUrl} /></div><div className="mt-3"><OrderPaymentWatcher orderId={paymentResult.orderIds[0]} onResolved={setPaymentResolved} /></div></>}</div> : <>
      <div className="pr-10"><p className="text-xs font-black uppercase tracking-wider text-[#047857]">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-[#014040]">{heading}</h2><p className="mt-2 text-sm text-slate-600">{lead}</p></div>

      {mode === 'cart' && <ul className="mt-5 divide-y divide-[#edf4f3] rounded-2xl border border-[#d8e7e4]">
        {items.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0"><p className="truncate text-sm font-bold text-[#014040]">{item.product.name}</p><p className="truncate text-[11px] text-slate-500">{cartLineDetail(item)}</p></div>
          <span className="shrink-0 text-xs font-black text-[#014040]">{formatPesewas(linePesewas(item))}</span>
        </li>)}
      </ul>}

      {uniqueNotices.map((notice, index) => <div key={`${notice.kind}-${index}`} className="mt-5"><FulfilmentTimeNotice kind={notice.kind} beforePayment customerInputLabel={notice.customerInputLabel} /></div>)}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">{STORE_COPY.cart.firstName}<input required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
        <label className="text-xs font-bold text-slate-700">{STORE_COPY.cart.lastName}<input required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
        <label className="text-xs font-bold text-slate-700">{STORE_COPY.cart.phone}<input required type="tel" placeholder="e.g. 0542638979" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="text-xs font-bold text-slate-700">{STORE_COPY.cart.email}<input required type="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{STORE_COPY.cart.checkoutSubtitle}</p>
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      <button disabled={busy} className="hk-pressable mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-5 py-3.5 text-sm font-black text-[#014040] disabled:opacity-50"><CreditCard className="h-4 w-4" />{busy ? 'Starting payment…' : `${paymentOptions?.mode === 'momo' ? STORE_COPY.payment.momoOnlyButton : paymentOptions?.mode === 'both' ? STORE_COPY.payment.bothButton : STORE_COPY.cart.submitAndPay} — ${formatPesewas(total)}`}</button>
      </>}
    </form>
  </div>;
}
