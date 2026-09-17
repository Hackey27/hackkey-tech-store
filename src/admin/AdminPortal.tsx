import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Boxes,
  ClipboardList,
  Download,
  Eye,
  FileText,
  KeyRound,
  Images,
  ImagePlus,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Trash2,
  X
} from 'lucide-react';
import { ADMIN_COPY } from '../config/storeCopy';
import { Announcement, Laptop as LaptopType, Order, Product, Service, ServiceField, ServiceFieldType, ServiceOption } from '../types';
import { formatPesewas } from '../utils/money';
import { defaultCustomerInputType, defaultDeliveryCodeType, effectiveActivationWebsiteUrl } from '../utils/softwareFulfilment';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { ProductImage, renderableProductImageUrl } from '../components/ProductImage';
import { adminAuth } from './firebase';
import { AdminApiError, adminRequest, loadAdminData } from './api';
import { AdminData, AdminLicence, ApiValidationError } from './types';

type Section = 'orders' | 'licences' | 'services' | 'software' | 'laptops' | 'announcements' | 'products' | 'landing' | 'ordering';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#014040]/10';
const labelClass = 'space-y-1 text-xs font-bold text-slate-700';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#014040] px-4 py-2.5 text-sm font-black text-white hover:bg-[#025656] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const credential = await signInWithEmailAndPassword(adminAuth, email.trim(), password);
      const claims = await credential.user.getIdTokenResult(true);
      if (claims.claims.admin !== true) {
        await signOut(adminAuth);
        throw new Error('This account does not have administrator access.');
      }
    } catch (err) {
      setError(messageOf(err).replace('Firebase: ', ''));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError(ADMIN_COPY.enterEmailForReset);
      return;
    }
    setResetBusy(true);
    setError('');
    setNotice('');
    try {
      await sendPasswordResetEmail(adminAuth, email.trim(), {
        url: `${window.location.origin}/admin`,
        handleCodeInApp: false
      });
      setNotice(ADMIN_COPY.resetSent);
    } catch (err) {
      setError(messageOf(err).replace('Firebase: ', ''));
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf5f3] p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-[#cbdcd9] bg-white p-7 shadow-xl sm:p-9">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#014040] text-[#05ef28]"><KeyRound /></div>
        <h1 className="text-2xl font-black text-[#014040]">{ADMIN_COPY.signInTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{ADMIN_COPY.signInSubtitle}</p>
        <div className="mt-7 space-y-4">
          <label className={labelClass}>{ADMIN_COPY.email}<input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className={labelClass}>{ADMIN_COPY.password}<input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</p>}
        <button className={`${primaryButton} mt-6 w-full`} disabled={busy}>{busy ? ADMIN_COPY.signingIn : ADMIN_COPY.signIn}</button>
        <button type="button" className="mt-3 w-full py-2 text-sm font-bold text-[#014040] hover:underline disabled:opacity-50" disabled={busy || resetBusy} onClick={resetPassword}>
          {resetBusy ? ADMIN_COPY.sendingReset : ADMIN_COPY.forgotPassword}
        </button>
      </form>
    </main>
  );
}

const bucketLabel: Record<Order['fulfilmentStatus'], string> = {
  'pending-payment': 'Pending payment',
  'awaiting-licence': 'Awaiting licence',
  'awaiting-customer-input': 'Awaiting Customer Input',
  'awaiting-seller-activation': 'Awaiting Seller Activation',
  'awaiting-document': 'Awaiting Document',
  ready: 'Ready'
};

function OrdersSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<'action' | 'all' | Order['fulfilmentStatus']>('action');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [manualKey, setManualKey] = useState('');
  const [note, setNote] = useState('');
  const [offlineReference, setOfflineReference] = useState('');
  const [offlineReason, setOfflineReason] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(0);
  const [workflow, setWorkflow] = useState<Partial<Order>>({});
  const [selectedSalesLicenceId, setSelectedSalesLicenceId] = useState('');

  const selectedProduct = selected
    ? data.products.find((product) => product.productId === selected.productId || product.variants.some((variant) => variant.variantId === selected.variantId))
    : undefined;
  const selectedVariant = selectedProduct?.variants.find((variant) => variant.variantId === selected?.variantId);
  const productId = String(selected?.productId || selectedProduct?.productId || '').toUpperCase();
  const effectiveInputType = (selected?.customerInputType || selectedVariant?.customerInputRequired || defaultCustomerInputType(productId)) as Order['customerInputType'];
  const usesSalesId = selected?.deliveryCodeType === 'sales-code' || selectedVariant?.deliveryCodeType === 'sales-code' || defaultDeliveryCodeType(productId) === 'sales-code';
  const usesLicence = Boolean(selectedVariant && !usesSalesId && !effectiveInputType && selected?.fulfilmentType !== 'Service');
  const activationUrl = effectiveActivationWebsiteUrl(selectedVariant);
  const availableCodes = data.licences.filter((licence) => licence.variantId === selected?.variantId && licence.status === 'available');
  const orderSteps = [
    { id: 'payment', label: 'Payment & price' },
    ...(effectiveInputType ? [{ id: 'activation', label: 'Activation details' }] : []),
    ...(usesLicence ? [{ id: 'licence', label: 'Licence' }] : []),
    { id: 'finish', label: 'Finish' }
  ];
  const activeStep = orderSteps[Math.min(step, orderSteps.length - 1)]?.id || 'payment';

  useEffect(() => {
    if (selected) setSelected(data.orders.find((order) => order.orderId === selected.orderId) || null);
  }, [data]);

  useEffect(() => {
    if (!selected) return;
    setWorkflow({ paymentStatus: selected.paymentStatus, fulfilmentStatus: selected.fulfilmentStatus, amountPesewas: selected.amountPesewas, customerInputType: effectiveInputType, customerInputValue: selected.customerInputValue || '', salesCode: selected.salesCode || '', activationCodeOrKey: '' });
    setManualKey('');
    setSelectedSalesLicenceId('');
    setStep(0);
  }, [selected?.orderId, selected?.salesCode, selected?.customerInputValue, selected?.paymentStatus, selected?.fulfilmentStatus, selected?.amountPesewas]);

  const rows = useMemo(() => data.orders.filter((order) => {
    if (filter === 'action' && ['ready', 'pending-payment'].includes(order.fulfilmentStatus)) return false;
    if (filter !== 'action' && filter !== 'all' && order.fulfilmentStatus !== filter) return false;
    const haystack = `${order.phone} ${order.orderId} ${order.email}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }).sort((a, b) => a.orderDate.localeCompare(b.orderDate)), [data.orders, filter, search]);

  const act = async (name: string, path: string, body?: unknown) => {
    setBusy(name);
    setMessage('');
    try {
      await adminRequest(user, path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
      setMessage('Saved successfully.');
      await reload();
    } catch (err) {
      setMessage(messageOf(err));
    } finally {
      setBusy('');
    }
  };

  const downloadDocument = async () => {
    if (!selected) return;
    setBusy('document');
    try {
      const result = await adminRequest<{ url: string }>(user, `/orders/${encodeURIComponent(selected.orderId)}/document`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setMessage(messageOf(err));
    } finally { setBusy(''); }
  };

  const saveWorkflow = async () => {
    if (!selected) return;
    setBusy('workflow'); setMessage('');
    try {
      await adminRequest(user, `/orders/${selected.orderId}/workflow`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentStatus: workflow.paymentStatus,
          fulfilmentStatus: workflow.fulfilmentStatus,
          amountPesewas: workflow.amountPesewas,
          customerInputType: effectiveInputType,
          customerInputValue: workflow.customerInputValue,
          salesCode: usesSalesId ? workflow.salesCode : undefined,
          activationCodeOrKey: workflow.activationCodeOrKey?.trim() || undefined
        })
      });
      setMessage('Order workflow saved.'); await reload();
    } catch (err) { setMessage(messageOf(err)); } finally { setBusy(''); }
  };

  const deleteOrder = async () => {
    if (!selected || !window.confirm('Delete this unpaid/test order permanently?')) return;
    setBusy('delete');
    try { await adminRequest(user, `/orders/${selected.orderId}`, { method: 'DELETE' }); setSelected(null); await reload(); }
    catch (err) { setMessage(messageOf(err)); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-black text-[#014040]">{ADMIN_COPY.orders.title}</h2><p className="text-sm text-slate-600">{ADMIN_COPY.orders.subtitle}</p></div>
      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <input className={inputClass} placeholder={ADMIN_COPY.orders.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="action">{ADMIN_COPY.orders.actionRequired}</option><option value="all">{ADMIN_COPY.orders.all}</option>
          {Object.entries(bucketLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{ADMIN_COPY.orders.empty}</p>}
        {rows.map((order) => (
          <button key={order.orderId} onClick={() => { setSelected(order); setMessage(''); }} className="grid w-full gap-2 border-b border-slate-100 p-4 text-left hover:bg-[#f3faf8] last:border-0 md:grid-cols-[140px_1fr_1fr_140px] md:items-center">
            <span className="font-mono text-xs font-bold text-[#014040]">{order.orderId}</span>
            <span><strong className="block text-sm text-slate-900">{order.customerName}</strong><small className="text-slate-500">{order.phone}</small></span>
            <span><strong className="block text-sm text-slate-800">{order.productName}</strong><small className="text-slate-500">{order.versionOrPlan}</small></span>
            <span className="text-xs font-bold text-amber-700">{bucketLabel[order.fulfilmentStatus]}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#002b2b]/60 p-3 sm:p-8">
          <section className="mx-auto max-w-4xl rounded-3xl bg-white p-5 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-xs font-bold text-[#025656]">{selected.orderId}</p><h3 className="text-2xl font-black text-[#014040]">{ADMIN_COPY.orders.details}</h3></div><button onClick={() => setSelected(null)} className="rounded-full p-2 hover:bg-slate-100" aria-label={ADMIN_COPY.orders.close}><X /></button></div>
            <div className="mt-6 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-3">
              <div><b>Customer</b><p>{selected.customerName}<br />{selected.phone}<br />{selected.email}</p></div>
              <div><b>Purchase</b><p>{selected.productName}<br />{selected.versionOrPlan} × {selected.quantity || 1}<br />{formatPesewas(selected.amountPesewas)}</p></div>
              <div><b>Status</b><p>{selected.paymentStatus} · {selected.paymentMethod || 'not recorded'}<br />{bucketLabel[selected.fulfilmentStatus]}<br />{new Date(selected.orderDate).toLocaleString()}</p></div>
              <div className="md:col-span-3"><b>Payment reference</b><p className="break-all font-mono text-xs">{selected.paystackReference || selected.offlinePaymentReference || '—'}</p></div>
              {selected.activationCodeOrKey && <div className="md:col-span-3"><b>Attached licence / activation code</b><p className="break-all font-mono text-xs">{selected.activationCodeOrKey}</p></div>}
              {selected.serviceAnswers && <div className="md:col-span-3"><b>Service answers</b><pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">{JSON.stringify(selected.serviceAnswers, null, 2)}</pre></div>}
            </div>

            <section className="mt-5 rounded-2xl border border-[#cbdcd9] p-4 sm:p-5"><div className="flex flex-wrap gap-2">{orderSteps.map((item, index) => <button key={item.id} type="button" onClick={() => setStep(index)} className={`rounded-full px-3 py-2 text-xs font-black ${step === index ? 'bg-[#014040] text-white' : 'bg-slate-100 text-slate-600'}`}>{index + 1}. {item.label}</button>)}</div>
              <div className="mt-5">
                {activeStep === 'payment' && <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Payment status<select className={inputClass} value={workflow.paymentStatus} onChange={(e) => setWorkflow((old) => ({ ...old, paymentStatus: e.target.value as Order['paymentStatus'] }))}><option value="pending">Pending</option><option value="paid">Paid</option></select></label><label className={labelClass}>Adjusted price (GHS)<input className={inputClass} type="number" min="0.01" step="0.01" value={(workflow.amountPesewas || 0) / 100} onChange={(e) => setWorkflow((old) => ({ ...old, amountPesewas: Math.round(Number(e.target.value) * 100) }))} /></label><p className="sm:col-span-2 text-xs text-slate-500">The buyer sees this new amount immediately in Find Order and pays it when they click Proceed to pay.</p></div>}
                {activeStep === 'activation' && <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>{effectiveInputType}<input className={inputClass} value={workflow.customerInputValue || ''} onChange={(e) => setWorkflow((old) => ({ ...old, customerInputValue: e.target.value }))} /></label>
                  {usesSalesId && <label className={labelClass}>Sales ID (admin only)<input className={inputClass} value={workflow.salesCode || ''} placeholder={selectedVariant?.autoFulfil ? 'Assigned automatically after payment' : 'Enter a Sales ID or choose one below'} onChange={(e) => setWorkflow((old) => ({ ...old, salesCode: e.target.value }))} /></label>}
                  <label className={`${labelClass} ${usesSalesId ? 'sm:col-span-2' : ''}`}>Licence code<input className={inputClass} value={workflow.activationCodeOrKey || ''} placeholder={selected.activationCodeOrKey ? 'A licence code is already saved — enter a replacement only if needed' : 'Enter the generated licence code'} onChange={(e) => setWorkflow((old) => ({ ...old, activationCodeOrKey: e.target.value }))} /></label>
                  {usesSalesId && !selectedVariant?.autoFulfil && !selected.salesCode && <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4"><label className={labelClass}>Suggested Sales IDs in stock<select className={inputClass} value={selectedSalesLicenceId} onChange={(e) => setSelectedSalesLicenceId(e.target.value)}><option value="">Use next available Sales ID</option>{availableCodes.map((licence) => <option key={licence.licenceId} value={licence.licenceId}>{licence.maskedCode}</option>)}</select></label><button className={`${secondaryButton} mt-3`} disabled={Boolean(busy) || selected.paymentStatus !== 'paid' || availableCodes.length === 0} onClick={() => act('sales-id', `/orders/${selected.orderId}/assign-sales-code`, selectedSalesLicenceId ? { licenceId: selectedSalesLicenceId } : {})}><KeyRound className="h-4 w-4" />Assign Sales ID from stock</button>{selected.paymentStatus !== 'paid' && <p className="mt-2 text-xs text-slate-500">Save this order as paid before assigning a Sales ID.</p>}</div>}
                  {usesSalesId && selectedVariant?.autoFulfil && !selected.salesCode && <p className="sm:col-span-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800">Automatic Sales ID delivery is on. The next available Sales ID is assigned when payment is confirmed.</p>}
                  {activationUrl && (workflow.customerInputValue || selected.customerInputValue) && <a className={`${primaryButton} sm:col-span-2`} href={activationUrl} target="_blank" rel="noreferrer">Activation link</a>}
                </div>}
                {activeStep === 'licence' && <div className="rounded-xl bg-slate-50 p-4"><h4 className="font-black">Assign a licence</h4><p className="mt-1 text-xs text-slate-500">For SmartPLS, NVivo and other direct-licence software.</p>{selected.licenceId ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">A licence has already been assigned to this order.</p> : selectedVariant?.autoFulfil && selected.fulfilmentStatus !== 'awaiting-licence' ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Automatic licence delivery is on. The next key in stock is assigned when payment is confirmed.</p> : <><input className={`${inputClass} mt-3`} placeholder="Optional manual licence key" value={manualKey} onChange={(e) => setManualKey(e.target.value)} /><button className={`${primaryButton} mt-3`} disabled={Boolean(busy) || selected.paymentStatus !== 'paid'} onClick={() => act('assign', `/orders/${selected.orderId}/assign-licence`, manualKey ? { manualKey } : {})}><KeyRound className="h-4 w-4" />{manualKey ? 'Assign licence' : 'Use next key in stock'}</button>{selected.paymentStatus !== 'paid' && <p className="mt-2 text-xs text-slate-500">Save this order as paid before assigning a licence.</p>}</>}</div>}
                {activeStep === 'finish' && <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Fulfilment status<select className={inputClass} value={workflow.fulfilmentStatus} onChange={(e) => setWorkflow((old) => ({ ...old, fulfilmentStatus: e.target.value as Order['fulfilmentStatus'] }))}>{Object.entries(bucketLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>}
              </div>
              <div className="mt-5 flex flex-wrap justify-between gap-2"><div className="flex gap-2"><button className={secondaryButton} disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button><button className={secondaryButton} disabled={step >= orderSteps.length - 1} onClick={() => setStep((value) => Math.min(orderSteps.length - 1, value + 1))}>Next / skip</button></div><div className="flex gap-2">{selected.paymentStatus !== 'paid' && <button className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-xs font-black text-rose-700" disabled={Boolean(busy)} onClick={deleteOrder}><Trash2 className="h-4 w-4" />Delete order</button>}<button className={primaryButton} disabled={Boolean(busy)} onClick={saveWorkflow}><Save className="h-4 w-4" />Save workflow</button></div></div>
            </section>

            {selected.fulfilmentHistory?.length ? <div className="mt-5"><h4 className="text-sm font-black text-slate-800">Fulfilment history</h4><ol className="mt-2 space-y-2 border-l-2 border-[#cbdcd9] pl-4">{selected.fulfilmentHistory.map((item, i) => <li key={`${item.at}-${i}`} className="text-xs"><b>{bucketLabel[item.status]}</b> · {new Date(item.at).toLocaleString()}<br /><span className="text-slate-500">{item.note}</span></li>)}</ol></div> : null}
            {selected.internalNotes?.length ? <div className="mt-5"><h4 className="text-sm font-black">Internal notes</h4>{selected.internalNotes.map((item, i) => <p key={`${item.createdAt}-${i}`} className="mt-2 rounded-xl bg-amber-50 p-3 text-xs">{item.text}<br /><span className="text-slate-500">{item.actorEmail || item.actorUid} · {new Date(item.createdAt).toLocaleString()}</span></p>)}</div> : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {selected.fulfilmentStatus === 'awaiting-document' && <div className="rounded-2xl border p-4"><button className={primaryButton} disabled={!!busy} onClick={() => act('received', `/orders/${selected.orderId}/mark-document-received`)}><FileText className="h-4 w-4" />{ADMIN_COPY.orders.documentReceived}</button></div>}
              {selected.fulfilmentStatus === 'awaiting-customer-input' && <div className="rounded-2xl border p-4"><button className={secondaryButton} disabled={!!busy} onClick={() => act('nudge', `/orders/${selected.orderId}/nudge`)}><Send className="h-4 w-4" />{ADMIN_COPY.orders.nudgeCustomer}</button></div>}
              {selected.documentPath && <div className="rounded-2xl border p-4"><button className={secondaryButton} disabled={!!busy} onClick={downloadDocument}><Download className="h-4 w-4" />{ADMIN_COPY.orders.downloadDocument}</button></div>}
              <div className="rounded-2xl border p-4"><h4 className="font-black">Email</h4><div className="mt-3 flex flex-wrap gap-2"><button className={secondaryButton} disabled={!!busy} onClick={() => act('receipt', `/orders/${selected.orderId}/resend`, { kind: 'receipt' })}><Send className="h-4 w-4" />{ADMIN_COPY.orders.resendReceipt}</button><button className={secondaryButton} disabled={!!busy} onClick={() => act('delivery', `/orders/${selected.orderId}/resend`, { kind: 'delivery' })}>{ADMIN_COPY.orders.resendDelivery}</button></div></div>
              {selected.paymentStatus !== 'paid' && <div className="rounded-2xl border p-4"><h4 className="font-black">{ADMIN_COPY.orders.offlinePayment}</h4><input className={`${inputClass} mt-3`} placeholder={ADMIN_COPY.orders.offlineReference} value={offlineReference} onChange={(e) => setOfflineReference(e.target.value)} /><input className={`${inputClass} mt-2`} placeholder={ADMIN_COPY.orders.offlineReason} value={offlineReason} onChange={(e) => setOfflineReason(e.target.value)} /><button className={`${primaryButton} mt-3`} disabled={!!busy || !offlineReference || !offlineReason} onClick={() => act('offline', `/orders/${selected.orderId}/record-offline-payment`, { reference: offlineReference, reason: offlineReason })}>{ADMIN_COPY.orders.offlinePayment}</button></div>}
              <div className="rounded-2xl border p-4"><h4 className="font-black">{ADMIN_COPY.orders.internalNote}</h4><textarea className={`${inputClass} mt-3`} placeholder={ADMIN_COPY.orders.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} /><button className={`${secondaryButton} mt-3`} disabled={!!busy || !note.trim()} onClick={async () => { await act('note', `/orders/${selected.orderId}/note`, { text: note }); setNote(''); }}>{ADMIN_COPY.orders.internalNote}</button></div>
            </div>
            {selected.paymentStatus === 'paid' && selected.fulfilmentStatus !== 'ready' && <div className="mt-6 rounded-2xl bg-[#014040] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"><div><h4 className="font-black text-white">Complete this order</h4><p className="mt-1 text-xs text-white/75">Marks the order fulfilled and emails the customer their next steps.</p></div><button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-5 py-3 text-sm font-black text-[#014040] hover:bg-[#20f43d] disabled:opacity-50 sm:mt-0 sm:w-auto" disabled={Boolean(busy)} onClick={() => act('fulfil', `/orders/${selected.orderId}/fulfil`, workflow.activationCodeOrKey?.trim() ? { activationCodeOrKey: workflow.activationCodeOrKey } : {})}><Send className="h-4 w-4" />Mark fulfilled and email customer</button></div>}
            {message && <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function LicencesSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const [keysByVariant, setKeysByVariant] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<ApiValidationError[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const categoryGroups = useMemo(() => {
    const groups = data.categories
      .map((category) => ({ category, products: data.products.filter((product) => product.categoryId === category.categoryId) }))
      .filter((group) => group.products.length > 0);
    const categoryIds = new Set(data.categories.map((category) => category.categoryId));
    const uncategorized = data.products.filter((product) => !categoryIds.has(product.categoryId));
    if (uncategorized.length) groups.push({ category: { categoryId: 'OTHER', name: 'Other software', tagline: '', icon: '', sortOrder: 999, active: true }, products: uncategorized });
    return groups;
  }, [data.categories, data.products]);

  const importRows = async (variant: Product['variants'][number]) => {
    const codeType = variant.deliveryCodeType === 'sales-code' ? 'sales-code' : 'licence';
    const rows = (keysByVariant[variant.variantId] || '').split(/\r?\n/).map((key) => key.trim()).filter(Boolean).map((licenceCode, i) => ({ row: i + 1, variantId: variant.variantId, licenceCode, codeType }));
    setBusy(true); setErrors([]); setMessage('');
    try {
      const result = await adminRequest<{ imported: number }>(user, '/licences/import', { method: 'POST', body: JSON.stringify({ rows }) });
      setMessage(`${result.imported} ${codeType === 'sales-code' ? 'Sales IDs' : 'licences'} added to ${variant.variantId}.`);
      setKeysByVariant((old) => ({ ...old, [variant.variantId]: '' }));
      await reload();
    } catch (err) {
      if (err instanceof AdminApiError) setErrors(err.validationErrors || []);
      setMessage(messageOf(err));
    } finally { setBusy(false); }
  };
  const reveal = async (licence: AdminLicence) => {
    try {
      const result = await adminRequest<{ licenceCode: string }>(user, `/licences/${encodeURIComponent(licence.licenceId)}/reveal`);
      setRevealed((old) => ({ ...old, [licence.licenceId]: result.licenceCode }));
    } catch (error) { setMessage(messageOf(error)); }
  };

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-black text-[#014040]">{ADMIN_COPY.licences.title}</h2><p className="text-sm text-slate-600">{ADMIN_COPY.licences.subtitle}</p></div>
    <p className="rounded-xl bg-[#edf5f3] p-4 text-sm text-[#014040]">Open a category, software title and version to manage stock for each operating system.</p>
    <div className="space-y-4">{categoryGroups.map(({ category, products }) => <details key={category.categoryId} className="group rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none p-5 text-lg font-black text-[#014040]">{category.name}<span className="ml-2 text-xs font-bold text-slate-400">({products.length} software titles)</span></summary><div className="space-y-3 border-t bg-slate-50 p-3 sm:p-5">{products.map((product) => <details key={product.productId} className="rounded-xl border bg-white"><summary className="cursor-pointer list-none p-4 font-black text-slate-800">{product.productName}<span className="ml-2 font-mono text-[10px] text-slate-400">{product.productId}</span></summary><div className="space-y-3 border-t p-3">{[...new Set(product.variants.map((variant) => variant.versionOrPlan))].map((version) => <details key={version} className="rounded-xl border border-slate-200"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[#025656]">Version {version}</summary><div className="grid gap-4 border-t bg-[#f8fbfa] p-3 lg:grid-cols-2">{product.variants.filter((variant) => variant.versionOrPlan === version).map((variant) => {
      const variantStock = data.licences.filter((licence) => licence.variantId === variant.variantId);
      const available = variantStock.filter((licence) => licence.status === 'available').length;
      const isSalesId = variant.deliveryCodeType === 'sales-code';
      return <section key={variant.variantId} className={`rounded-xl border bg-white p-4 ${available < 3 ? 'border-amber-300' : 'border-slate-200'}`}><div className="flex items-start justify-between gap-3"><div><h4 className="font-black">{variant.os || 'All operating systems'}</h4><p className="font-mono text-[10px] text-slate-500">{variant.variantId}</p></div><div className="text-right"><p className="text-2xl font-black text-[#014040]">{available}</p><p className="text-[10px] font-bold uppercase text-slate-500">available {isSalesId ? 'Sales IDs' : 'licences'}</p></div></div>{available < 3 && <p className="mt-2 text-xs font-bold text-amber-700">{ADMIN_COPY.licences.lowStock}</p>}<textarea className={`${inputClass} mt-3 min-h-28 font-mono`} placeholder={`Paste one ${isSalesId ? 'Sales ID' : 'licence'} per line`} value={keysByVariant[variant.variantId] || ''} onChange={(e) => setKeysByVariant((old) => ({ ...old, [variant.variantId]: e.target.value }))} /><button className={`${primaryButton} mt-3 w-full`} disabled={busy || !(keysByVariant[variant.variantId] || '').trim()} onClick={() => importRows(variant)}><Plus className="h-4 w-4" />Add {isSalesId ? 'Sales IDs' : 'licences'} to stock</button>{variantStock.length > 0 && <div className="mt-4 divide-y rounded-lg border">{variantStock.map((licence) => <div key={licence.licenceId} className="grid gap-2 p-3 text-xs sm:grid-cols-[90px_1fr_auto] sm:items-center"><span className={`font-black ${licence.status === 'available' ? 'text-emerald-700' : 'text-slate-500'}`}>{licence.status}</span><span className="min-w-0 break-all font-mono">{revealed[licence.licenceId] || licence.maskedCode}{licence.assignedOrderId && <span className="mt-1 block font-sans text-slate-500">Order {licence.assignedOrderId}</span>}{licence.integrityWarning && <span className="mt-1 block font-sans font-bold text-rose-700"><AlertTriangle className="mr-1 inline h-3 w-3" />{licence.integrityWarning}</span>}</span><button className={secondaryButton} onClick={() => reveal(licence)}><Eye className="h-3.5 w-3.5" />Reveal</button></div>)}</div>}</section>;
    })}</div></details>)}</div></details>)}</div></details>)}</div>
    {message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}{errors.length > 0 && <ul className="rounded-xl bg-rose-50 p-4 text-xs text-rose-800">{errors.map((error, i) => <li key={i}>Row {error.row || '—'}: {error.message}</li>)}</ul>}
  </div>;
}

function emptyService(): Service {
  return { serviceId: '', name: '', tagline: '', description: '', categoryId: 'services', fields: [], ctaLabel: 'Request service', active: false, sortOrder: 100 };
}

const fieldTypes: ServiceFieldType[] = ['text', 'tel', 'email', 'number', 'textarea', 'select', 'radio', 'datetime', 'file'];

function ServicesSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<Service>(() => data.services[0] ? structuredClone(data.services[0]) : emptyService());
  const [errors, setErrors] = useState<ApiValidationError[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Service>(key: K, value: Service[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const updateField = (index: number, patch: Partial<ServiceField>) => set('fields', draft.fields.map((field, i) => i === index ? { ...field, ...patch } : field));
  const moveField = (index: number, direction: number) => { const next = [...draft.fields]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; set('fields', next); };
  const updateOption = (index: number, patch: Partial<ServiceOption>) => set('options', (draft.options || []).map((option, i) => i === index ? { ...option, ...patch } : option));
  const save = async () => {
    setBusy(true); setErrors([]); setMessage('');
    try {
      const path = data.services.some((service) => service.serviceId === draft.serviceId) ? `/services/${encodeURIComponent(draft.serviceId)}` : '/services';
      await adminRequest(user, path, { method: path === '/services' ? 'POST' : 'PUT', body: JSON.stringify(draft) });
      setMessage('Service saved. It is now reflected in the catalogue.'); await reload();
    } catch (err) { if (err instanceof AdminApiError) setErrors(err.validationErrors || []); setMessage(messageOf(err)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black text-[#014040]">{ADMIN_COPY.services.title}</h2><p className="text-sm text-slate-600">{ADMIN_COPY.services.subtitle}</p></div><button className={secondaryButton} onClick={() => setDraft(emptyService())}><Plus className="h-4 w-4" />{ADMIN_COPY.services.new}</button></div>
    <div className="grid gap-5 xl:grid-cols-[220px_1fr_360px]">
      <aside className="h-fit rounded-2xl border bg-white p-2">{data.services.map((service) => <button key={service.serviceId} onClick={() => setDraft(structuredClone(service))} className={`w-full rounded-xl p-3 text-left text-sm ${draft.serviceId === service.serviceId ? 'bg-[#edf5f3] font-black text-[#014040]' : 'hover:bg-slate-50'}`}>{service.name}<small className="block font-mono text-[10px] text-slate-500">{service.serviceId}</small></button>)}</aside>
      <section className="space-y-5 rounded-2xl border bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Service ID<input className={inputClass} value={draft.serviceId} onChange={(e) => set('serviceId', e.target.value)} /></label><label className={labelClass}>Name<input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} /></label><label className={labelClass}>Tagline<input className={inputClass} value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} /></label><label className={labelClass}>Category ID<input className={inputClass} value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)} /></label><label className={`${labelClass} sm:col-span-2`}>Description<textarea className={inputClass} value={draft.description} onChange={(e) => set('description', e.target.value)} /></label><label className={labelClass}>CTA label<input className={inputClass} value={draft.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} /></label><label className={labelClass}>Sort order<input className={inputClass} type="number" value={draft.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></label><label className={labelClass}>Minimum quantity<input className={inputClass} type="number" min="1" value={draft.minQty ?? 1} onChange={(e) => set('minQty', Number(e.target.value))} /></label><label className={labelClass}>Maximum quantity<input className={inputClass} type="number" min="1" value={draft.maxQty ?? 50} onChange={(e) => set('maxQty', Number(e.target.value))} /></label><label className={`${labelClass} sm:col-span-2`}>Disclaimer<textarea className={inputClass} value={draft.disclaimer || ''} onChange={(e) => set('disclaimer', e.target.value || undefined)} /></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} /> Published</label></div>
        <div><div className="flex justify-between"><h3 className="font-black">Form fields</h3><button className={secondaryButton} onClick={() => set('fields', [...draft.fields, { key: `field_${draft.fields.length + 1}`, label: 'New field', type: 'text', required: false }])}><Plus className="h-3 w-3" />{ADMIN_COPY.services.addField}</button></div><div className="mt-3 space-y-3">{draft.fields.map((field, i) => <div key={`${field.key}-${i}`} className="rounded-xl border p-3"><div className="grid gap-2 sm:grid-cols-3"><input className={inputClass} placeholder="Field key" value={field.key} onChange={(e) => updateField(i, { key: e.target.value })} /><input className={inputClass} placeholder="Label" value={field.label} onChange={(e) => updateField(i, { label: e.target.value })} /><select className={inputClass} value={field.type} onChange={(e) => updateField(i, { type: e.target.value as ServiceFieldType })}>{fieldTypes.map((type) => <option key={type}>{type}</option>)}</select><input className={inputClass} placeholder="Helper text" value={field.helper || ''} onChange={(e) => updateField(i, { helper: e.target.value || undefined })} /><input className={inputClass} placeholder="Placeholder" value={field.placeholder || ''} onChange={(e) => updateField(i, { placeholder: e.target.value || undefined })} /><input className={inputClass} placeholder="Options, comma separated" value={(field.options || []).join(', ')} onChange={(e) => updateField(i, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /><select className={inputClass} value={field.showIf?.field || ''} onChange={(e) => updateField(i, { showIf: e.target.value ? { field: e.target.value, equals: field.showIf?.equals || '' } : undefined })}><option value="">Always show</option>{draft.fields.filter((_, index) => index !== i).map((other) => <option key={other.key} value={other.key}>{ADMIN_COPY.services.showWhen} {other.label}</option>)}</select><input className={inputClass} placeholder={ADMIN_COPY.services.equals} disabled={!field.showIf} value={field.showIf?.equals || ''} onChange={(e) => updateField(i, { showIf: field.showIf ? { ...field.showIf, equals: e.target.value } : undefined })} /><label className="flex items-center gap-2 px-2 text-xs font-bold"><input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> Required</label></div><div className="mt-2 flex justify-end gap-1"><button className={secondaryButton} onClick={() => moveField(i, -1)}><ArrowUp className="h-3 w-3" /></button><button className={secondaryButton} onClick={() => moveField(i, 1)}><ArrowDown className="h-3 w-3" /></button><button className={secondaryButton} onClick={() => set('fields', draft.fields.filter((_, index) => index !== i))}><Trash2 className="h-3 w-3" /></button></div></div>)}</div></div>
        <div><div className="flex justify-between"><h3 className="font-black">Priced options</h3><button className={secondaryButton} onClick={() => set('options', [...(draft.options || []), { optionId: `option_${(draft.options || []).length + 1}`, name: 'New option', unitPriceGhs: 1 }])}><Plus className="h-3 w-3" />{ADMIN_COPY.services.addOption}</button></div>{!draft.options?.length && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{ADMIN_COPY.services.quoteOnly}</p>}<div className="mt-3 space-y-3">{draft.options?.map((option, i) => <div key={`${option.optionId}-${i}`} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-3"><input className={inputClass} placeholder="Option ID" value={option.optionId} onChange={(e) => updateOption(i, { optionId: e.target.value })} /><input className={inputClass} placeholder="Name" value={option.name} onChange={(e) => updateOption(i, { name: e.target.value })} /><label className={labelClass}>Unit price (GHS)<input className={inputClass} type="number" step="0.01" value={option.unitPriceGhs} onChange={(e) => updateOption(i, { unitPriceGhs: Number(e.target.value) })} /></label><label className={labelClass}>Bulk price (GHS)<input className={inputClass} type="number" step="0.01" value={option.bulkPriceGhs ?? ''} onChange={(e) => updateOption(i, { bulkPriceGhs: e.target.value ? Number(e.target.value) : undefined })} /></label><label className={labelClass}>Bulk from quantity<input className={inputClass} type="number" value={option.bulkFromQty ?? ''} onChange={(e) => updateOption(i, { bulkFromQty: e.target.value ? Number(e.target.value) : undefined })} /></label><button className={`${secondaryButton} self-end`} onClick={() => set('options', draft.options?.filter((_, index) => index !== i))}><Trash2 className="h-3 w-3" /></button></div>)}</div></div>
        {errors.length > 0 && <ul className="rounded-xl bg-rose-50 p-4 text-xs text-rose-800">{errors.map((error, i) => <li key={i}>{error.message}</li>)}</ul>}{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}<button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />{busy ? ADMIN_COPY.saving : ADMIN_COPY.save}</button>
      </section>
      <ServicePreview service={draft} />
    </div>
  </div>;
}

function ServicePreview({ service }: { service: Service }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return <aside className="h-fit rounded-2xl border border-[#cbdcd9] bg-white p-5 xl:sticky xl:top-5"><p className="text-xs font-black uppercase tracking-wider text-[#025656]">{ADMIN_COPY.services.livePreview}</p><h3 className="mt-2 text-xl font-black text-[#014040]">{service.name || 'Service name'}</h3><p className="mt-2 text-sm text-slate-600">{service.description || 'Service description'}</p><div className="mt-5 space-y-3">{service.fields.filter((field) => !field.showIf || answers[field.showIf.field] === field.showIf.equals).map((field) => <label key={field.key} className={labelClass}>{field.label}{field.required && ' *'}{field.type === 'textarea' ? <textarea className={inputClass} placeholder={field.placeholder} value={answers[field.key] || ''} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })} /> : field.type === 'select' || field.type === 'radio' ? <select className={inputClass} value={answers[field.key] || ''} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}><option value="">Choose…</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : <input className={inputClass} type={field.type === 'file' ? 'file' : field.type} placeholder={field.placeholder} value={field.type === 'file' ? undefined : answers[field.key] || ''} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })} />}{field.helper && <small className="block font-normal text-slate-500">{field.helper}</small>}</label>)}</div>{service.options?.length ? <div className="mt-5 space-y-2">{service.options.map((option) => <div key={option.optionId} className="rounded-xl border p-3 text-sm"><b>{option.name}</b><span className="float-right">GHS {option.unitPriceGhs.toFixed(2)}</span></div>)}</div> : <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs">{ADMIN_COPY.services.quoteOnly}</p>}{service.disclaimer && <p className="mt-4 text-xs text-slate-500">{service.disclaimer}</p>}<button className={`${primaryButton} mt-5 w-full`} type="button">{service.ctaLabel || 'Continue'}</button></aside>;
}

function emptyAnnouncement(): Announcement {
  return { announcementId: '', title: '', message: '', showOnce: true, active: false };
}

function dateInput(value?: string) { return value ? value.slice(0, 16) : ''; }

function AnnouncementsSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<Announcement>(() => data.announcements[0] ? { ...data.announcements[0] } : emptyAnnouncement());
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const set = <K extends keyof Announcement>(key: K, value: Announcement[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const save = async () => { setBusy(true); setMessage(''); try { const body = { ...draft, startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : undefined, endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : undefined }; const path = draft.announcementId ? `/announcements/${encodeURIComponent(draft.announcementId)}` : '/announcements'; await adminRequest(user, path, { method: draft.announcementId ? 'PUT' : 'POST', body: JSON.stringify(body) }); setMessage('Announcement saved.'); await reload(); } catch (err) { setMessage(messageOf(err)); } finally { setBusy(false); } };
  return <div className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-black text-[#014040]">{ADMIN_COPY.announcements.title}</h2><p className="text-sm text-slate-600">{ADMIN_COPY.announcements.subtitle}</p></div><button className={secondaryButton} onClick={() => setDraft(emptyAnnouncement())}><Plus className="h-4 w-4" />{ADMIN_COPY.announcements.new}</button></div><div className="grid gap-5 lg:grid-cols-[260px_1fr]"><aside className="h-fit rounded-2xl border bg-white p-2">{data.announcements.map((announcement) => <button key={announcement.announcementId} className={`w-full rounded-xl p-3 text-left ${draft.announcementId === announcement.announcementId ? 'bg-[#edf5f3]' : 'hover:bg-slate-50'}`} onClick={() => setDraft({ ...announcement })}><b className="block text-sm">{announcement.title}</b><small className={announcement.active ? 'text-emerald-700' : 'text-slate-500'}>{announcement.active ? 'Active' : 'Inactive'} · {announcement.updatedAt ? new Date(announcement.updatedAt).toLocaleDateString() : 'Not updated'}</small></button>)}</aside><section className="rounded-2xl border bg-white p-5"><div className="grid gap-4 sm:grid-cols-2"><label className={`${labelClass} sm:col-span-2`}>Title<input className={inputClass} value={draft.title} onChange={(e) => set('title', e.target.value)} /></label><label className={`${labelClass} sm:col-span-2`}>Message<textarea className={`${inputClass} min-h-32`} value={draft.message} onChange={(e) => set('message', e.target.value)} /></label><label className={labelClass}>Button text<input className={inputClass} value={draft.buttonText || ''} onChange={(e) => set('buttonText', e.target.value || undefined)} /></label><label className={labelClass}>Button URL<input className={inputClass} type="url" value={draft.buttonUrl || ''} onChange={(e) => set('buttonUrl', e.target.value || undefined)} /></label><label className={labelClass}>Starts at<input className={inputClass} type="datetime-local" value={dateInput(draft.startsAt)} onChange={(e) => set('startsAt', e.target.value || undefined)} /></label><label className={labelClass}>Ends at<input className={inputClass} type="datetime-local" value={dateInput(draft.endsAt)} onChange={(e) => set('endsAt', e.target.value || undefined)} /></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.showOnce} onChange={(e) => set('showOnce', e.target.checked)} />{ADMIN_COPY.announcements.showOnce}</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} />{ADMIN_COPY.announcements.active}</label></div><div className="mt-5 flex gap-2"><button className={secondaryButton} onClick={() => setPreview(true)}><Eye className="h-4 w-4" />{ADMIN_COPY.preview}</button><button className={primaryButton} disabled={busy || !draft.title.trim() || !draft.message.trim()} onClick={save}><Save className="h-4 w-4" />{busy ? ADMIN_COPY.saving : ADMIN_COPY.save}</button></div>{message && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</section></div>{preview && <AnnouncementModal preview announcement={{ ...draft, announcementId: draft.announcementId || 'preview' }} onClose={() => setPreview(false)} />}</div>;
}

function SoftwareConfigurationSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const [productId, setProductId] = useState(data.products[0]?.productId || '');
  const [draft, setDraft] = useState<Product>(() => structuredClone(data.products[0] || { productId: '', productName: '', categoryId: 'DATA', active: false, variants: [] }));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { const product = data.products.find((item) => item.productId === productId); if (product) setDraft(structuredClone(product)); }, [productId, data.products]);
  if (!draft) return <p>No software products found.</p>;
  const setVariant = (index: number, field: string, value: unknown) => setDraft((old) => ({ ...old, variants: old.variants.map((variant, i) => i === index ? { ...variant, [field]: value } : variant) }));
  const save = async () => { setBusy(true); setMessage(''); try { await adminRequest(user, `/products/${draft.productId}/configuration`, { method: 'PUT', body: JSON.stringify(draft) }); setMessage('Software configuration saved.'); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-[#014040]">Software setup</h2><p className="text-sm text-slate-600">Configure delivery behaviour, version-specific activation links and the resources customers receive after confirmation.</p></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save configuration'}</button></div>
    <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>{data.products.map((product) => <option key={product.productId} value={product.productId}>{product.productName}</option>)}</select>
    <div className="space-y-4">{draft.variants.map((variant, index) => {
      const isSalesId = variant.deliveryCodeType === 'sales-code';
      return <section key={variant.variantId} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-[#014040]">{variant.versionOrPlan} · {variant.os}</h3><p className="font-mono text-[11px] text-slate-500">{variant.variantId}</p></div><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={variant.autoFulfil} onChange={(e) => setVariant(index, 'autoFulfil', e.target.checked)} />{isSalesId ? 'Automatically assign Sales ID' : 'Automatically deliver licence'}</label></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><label className={labelClass}>Stock type<select className={inputClass} value={variant.deliveryCodeType || 'licence'} onChange={(e) => setVariant(index, 'deliveryCodeType', e.target.value)}><option value="licence">Customer licence</option><option value="sales-code">Sales ID (admin only)</option></select></label><label className={labelClass}>Customer activation detail<select className={inputClass} value={variant.customerInputRequired || ''} onChange={(e) => setVariant(index, 'customerInputRequired', e.target.value)}><option value="">None</option><option>Lock Code</option><option>Hardware ID</option></select></label><label className={labelClass}>Activation website URL<input className={inputClass} type="url" value={variant.activationWebsiteUrl || variant.activationLink || ''} onChange={(e) => setVariant(index, 'activationWebsiteUrl', e.target.value)} />{(variant.activationWebsiteUrl || variant.activationLink) && <a className="mt-1 block font-bold text-[#025656] hover:underline" href={variant.activationWebsiteUrl || variant.activationLink} target="_blank" rel="noreferrer">Open saved activation link</a>}</label><label className={labelClass}>Download Software URL<input className={inputClass} type="url" value={variant.windowsInstallerUrl || ''} onChange={(e) => setVariant(index, 'windowsInstallerUrl', e.target.value)} /></label><label className={labelClass}>Installation guide URL<input className={inputClass} type="url" value={variant.guideUrl || ''} onChange={(e) => setVariant(index, 'guideUrl', e.target.value)} /></label><label className={labelClass}>Learning Resources URL<input className={inputClass} type="url" value={variant.learningResourcesUrl || ''} onChange={(e) => setVariant(index, 'learningResourcesUrl', e.target.value)} /></label></div></section>;
    })}</div>
    {message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}
  </div>;
}

function LaptopPropertiesSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const empty = (): LaptopType => ({ laptopId: `LAP-${Date.now()}`, title: '', categoryId: 'LAPTOP', brand: '', model: '', processor: '', ram: '', storage: '', screen: '', colour: '', graphics: 'Integrated', ports: '', operatingSystem: '', picturesUrl: [], availability: 'Available', active: true, sortOrder: 100 });
  const [laptopId, setLaptopId] = useState(data.laptops[0]?.laptopId || 'new');
  const [draft, setDraft] = useState<LaptopType>(() => structuredClone(data.laptops[0] || empty()));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { if (laptopId === 'new') setDraft(empty()); else { const laptop = data.laptops.find((item) => item.laptopId === laptopId); if (laptop) setDraft(structuredClone(laptop)); } }, [laptopId]);
  const set = (field: keyof LaptopType, value: unknown) => setDraft((old) => ({ ...old, [field]: value }));
  const save = async () => { setBusy(true); setMessage(''); try { await adminRequest(user, `/laptops/${encodeURIComponent(draft.laptopId)}`, { method: 'PUT', body: JSON.stringify(draft) }); setMessage('Laptop properties saved.'); setLaptopId(draft.laptopId); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  const fields: Array<[keyof LaptopType, string]> = [['title','Laptop name'],['brand','Brand'],['model','Model'],['processor','Processor'],['ram','RAM'],['storage','Storage'],['screen','Screen size'],['colour','Colour'],['operatingSystem','Operating system'],['graphics','Graphics card'],['graphicsDetails','Dedicated graphics type and capacity'],['ports','Ports'],['freebies','Freebies included']];
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-[#014040]">Laptop properties</h2><p className="text-sm text-slate-600">Create or edit the specifications shown on laptop cards and detail pages.</p></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save laptop'}</button></div><select className={inputClass} value={laptopId} onChange={(e) => setLaptopId(e.target.value)}><option value="new">+ Add a laptop</option>{data.laptops.map((item) => <option key={item.laptopId} value={item.laptopId}>{item.title}</option>)}</select><section className="rounded-2xl border bg-white p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className={labelClass}>Laptop ID<input className={inputClass} value={draft.laptopId} onChange={(e) => set('laptopId', e.target.value)} /></label>{fields.map(([field,label]) => <label key={field} className={labelClass}>{label}<input className={inputClass} value={String(draft[field] || '')} onChange={(e) => set(field, e.target.value)} /></label>)}<label className={labelClass}>Price (GHS)<input className={inputClass} type="number" min="0" step="0.01" value={draft.priceGhs ?? ''} onChange={(e) => set('priceGhs', e.target.value === '' ? undefined : Number(e.target.value))} /></label><label className={labelClass}>Status<select className={inputClass} value={draft.availability} onChange={(e) => set('availability', e.target.value)}><option>Available</option><option>Pre-order</option></select></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} />Published</label></div><label className={`${labelClass} mt-4 block`}>Notes<textarea className={inputClass} rows={3} value={draft.notes || ''} onChange={(e) => set('notes', e.target.value)} /></label>{draft.availability === 'Pre-order' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">The storefront will tell customers that pre-orders take 2 to 4 weeks to arrive.</p>}</section>{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</div>;
}

function productMediaUrl(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return renderableProductImageUrl(value);
  if (value.startsWith('catalogue/')) return `/api/catalog/images?path=${encodeURIComponent(value)}`;
  return undefined;
}

async function resizeProductImage(file: File, role: 'icon' | 'card' | 'banner' | 'mobile-banner' | 'gallery'): Promise<Blob> {
  const source = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = source;
    await image.decode();
    const maxWidth = role === 'icon' ? 800 : role === 'card' ? 1200 : role === 'banner' ? 1600 : role === 'mobile-banner' ? 900 : 1400;
    const maxHeight = role === 'icon' ? 800 : role === 'card' ? 800 : role === 'banner' ? 1000 : role === 'mobile-banner' ? 1200 : 1050;
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(ADMIN_COPY.products.resizeError);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob) throw new Error(ADMIN_COPY.products.resizeError);
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}

function ProductMediaSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const [productId, setProductId] = useState(data.mediaItems[0]?.itemId || '');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const product = data.mediaItems.find((item) => item.itemId === productId) || data.mediaItems[0];

  useEffect(() => {
    if (productId && data.mediaItems.some((item) => item.itemId === productId)) return;
    setProductId(data.mediaItems[0]?.itemId || '');
  }, [data.mediaItems, productId]);

  const upload = async (role: 'icon' | 'card' | 'banner' | 'mobile-banner' | 'gallery', files?: FileList | null) => {
    if (!product || !files?.length) return;
    setBusy(role); setMessage('');
    try {
      const selected = role === 'gallery' ? Array.from(files) : Array.from(files).slice(0, 1);
      for (const file of selected) {
        const blob = await resizeProductImage(file, role);
        await adminRequest(user, `/catalogue/${product.kind}/${encodeURIComponent(product.itemId)}/images?role=${role}`, {
          method: 'POST', body: blob, headers: { 'Content-Type': blob.type }
        });
      }
      setMessage(ADMIN_COPY.products.uploaded);
      await reload();
    } catch (err) {
      setMessage(messageOf(err));
    } finally { setBusy(''); }
  };

  const remove = async (objectPath: string) => {
    if (!product || !window.confirm(ADMIN_COPY.products.confirmRemove)) return;
    setBusy(objectPath); setMessage('');
    try {
      await adminRequest(user, `/catalogue/${product.kind}/${encodeURIComponent(product.itemId)}/images`, {
        method: 'DELETE', body: JSON.stringify({ objectPath })
      });
      setMessage(ADMIN_COPY.products.removed);
      await reload();
    } catch (err) { setMessage(messageOf(err)); }
    finally { setBusy(''); }
  };

  if (!product) return <p className="rounded-2xl bg-white p-8 text-sm text-slate-500">{ADMIN_COPY.products.noGallery}</p>;
  const bannerUrl = productMediaUrl(product.bannerImagePath);
  const mobileBannerUrl = productMediaUrl(product.mobileBannerImagePath);

  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-black text-[#014040]">{ADMIN_COPY.products.title}</h2><p className="text-sm text-slate-600">{ADMIN_COPY.products.subtitle}</p></div>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-2xl border bg-white p-2">
          {data.mediaItems.map((item) => <button key={`${item.kind}-${item.itemId}`} onClick={() => { setProductId(item.itemId); setMessage(''); }} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm ${product.itemId === item.itemId ? 'bg-[#edf5f3] font-black text-[#014040]' : 'hover:bg-slate-50'}`}><ProductImage name={item.name} itemId={item.itemId} imageUrl={productMediaUrl(item.imagePath) || item.imageUrl} kind={item.kind === 'category' ? undefined : item.kind} size="sm" /><span>{item.name}<small className="block font-mono text-[10px] text-slate-500">{item.kind} · {item.itemId}</small></span></button>)}
        </aside>
        <section className="space-y-7 rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-3"><ProductImage name={product.name} itemId={product.itemId} imageUrl={productMediaUrl(product.imagePath) || product.imageUrl} kind={product.kind === 'category' ? undefined : product.kind} /><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{product.kind}</p><h3 className="text-xl font-black text-[#014040]">{product.name}</h3></div></div>

          <div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black text-[#014040]">{product.kind === 'category' ? 'Category card artwork' : 'Product icon'}</h4><p className="text-xs text-slate-500">Flexible square or landscape images are automatically resized for the storefront.</p></div><label className={secondaryButton}>{busy === (product.kind === 'category' ? 'card' : 'icon') ? ADMIN_COPY.products.uploading : 'Choose image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload(product.kind === 'category' ? 'card' : 'icon', event.target.files); event.currentTarget.value = ''; }} /></label></div>{product.imagePath && <div className="relative aspect-[3/2] max-w-md overflow-hidden rounded-2xl bg-[#014040]"><img src={productMediaUrl(product.imagePath)} alt="" className="h-full w-full object-cover" /><button className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-rose-700" onClick={() => void remove(product.imagePath!)}><Trash2 className="h-4 w-4" /></button></div>}</div>

          {product.kind !== 'category' && <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h4 className="font-black text-[#014040]">{ADMIN_COPY.products.banner}</h4><label className={secondaryButton}>{busy === 'banner' ? ADMIN_COPY.products.uploading : ADMIN_COPY.products.chooseBanner}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload('banner', event.target.files); event.currentTarget.value = ''; }} /></label></div>
            {bannerUrl ? <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-[#014040]"><img src={bannerUrl} alt="" width="1200" height="525" className="h-full w-full object-cover" />{product.bannerImagePath?.startsWith('catalogue/') && <button className="absolute right-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-rose-700" disabled={Boolean(busy)} onClick={() => void remove(product.bannerImagePath!)}><Trash2 className="mr-1 inline h-3.5 w-3.5" />{ADMIN_COPY.products.remove}</button>}</div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">{ADMIN_COPY.products.noBanner}</p>}
          </div>}

          {product.kind !== 'category' && <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black text-[#014040]">Mobile card image</h4><p className="text-xs text-slate-500">Portrait artwork recommended: 900 × 1200 px.</p></div><label className={secondaryButton}>{busy === 'mobile-banner' ? ADMIN_COPY.products.uploading : 'Choose mobile image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload('mobile-banner', event.target.files); event.currentTarget.value = ''; }} /></label></div>
            {mobileBannerUrl ? <div className="relative aspect-[3/4] max-w-xs overflow-hidden rounded-2xl bg-[#014040]"><img src={mobileBannerUrl} alt="" className="h-full w-full object-cover" />{product.mobileBannerImagePath?.startsWith('catalogue/') && <button className="absolute right-3 top-3 rounded-xl bg-white/90 p-2 text-rose-700" onClick={() => void remove(product.mobileBannerImagePath!)}><Trash2 className="h-4 w-4" /></button>}</div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">The large-screen image is used until a mobile image is uploaded.</p>}
          </div>}

          {product.kind !== 'category' && <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h4 className="font-black text-[#014040]">{ADMIN_COPY.products.gallery}</h4><label className={secondaryButton}>{busy === 'gallery' ? ADMIN_COPY.products.uploading : ADMIN_COPY.products.chooseGallery}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload('gallery', event.target.files); event.currentTarget.value = ''; }} /></label></div>
            {product.screenshots?.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{product.screenshots.map((image, index) => <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><img src={productMediaUrl(image)} alt="" width="480" height="360" loading="lazy" className="h-full w-full object-cover" />{image.startsWith('catalogue/') && <button className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-rose-700" aria-label={ADMIN_COPY.products.remove} disabled={Boolean(busy)} onClick={() => void remove(image)}><Trash2 className="h-3.5 w-3.5" /></button>}</div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">{ADMIN_COPY.products.noGallery}</p>}
          </div>}
          {message && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}
        </section>
      </div>
    </div>
  );
}

async function resizeBannerExact(file: File, width: number, height: number): Promise<Blob> {
  const source = URL.createObjectURL(file);
  try {
    const image = new window.Image(); image.src = source; await image.decode();
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale; const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2; const sourceY = (image.naturalHeight - sourceHeight) / 2;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Unable to resize this image.');
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob) throw new Error('Unable to resize this image.'); return blob;
  } finally { URL.revokeObjectURL(source); }
}

function LandingBannersSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(''); const [message, setMessage] = useState('');
  const upload = async (role: 'desktop' | 'mobile', files?: FileList | null) => {
    const file = files?.[0]; if (!file) return; setBusy(role); setMessage('');
    try {
      const blob = await resizeBannerExact(file, role === 'desktop' ? 1800 : 768, role === 'desktop' ? 900 : 1024);
      await adminRequest(user, `/landing/images?role=${role}`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
      setMessage(`${role === 'desktop' ? 'Large-screen' : 'Mobile'} banner uploaded.`); await reload();
    } catch (error) { setMessage(messageOf(error)); } finally { setBusy(''); }
  };
  const rows = [
    { role: 'desktop' as const, title: 'Large-screen banner', size: '1800 × 900 px', path: data.landing.desktopImagePath, aspect: 'aspect-[2/1]' },
    { role: 'mobile' as const, title: 'Mobile banner', size: '768 × 1024 px', path: data.landing.mobileImagePath, aspect: 'aspect-[3/4]' }
  ];
  return <div className="space-y-5"><div><h2 className="text-2xl font-black text-[#014040]">Landing page banners</h2><p className="text-sm text-slate-600">Upload separate artwork for phones and larger screens. Images are centre-cropped to the exact displayed dimensions.</p></div><div className="grid gap-5 lg:grid-cols-2">{rows.map((row) => <section key={row.role} className="rounded-2xl border bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-[#014040]">{row.title}</h3><p className="text-xs font-bold text-slate-500">{row.size}</p></div><label className={secondaryButton}>{busy === row.role ? 'Uploading…' : 'Choose image'}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(row.role, event.target.files); event.currentTarget.value = ''; }} /></label></div><div className={`mt-4 overflow-hidden rounded-2xl bg-[#014040] ${row.aspect}`}>{row.path ? <img src={productMediaUrl(row.path)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-white/70">Using the default banner</div>}</div></section>)}</div>{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</div>;
}

function CatalogueOrderSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const catalogueItems = data.mediaItems.filter((item) => item.kind !== 'category');
  const [values, setValues] = useState(() => Object.fromEntries(catalogueItems.map((item) => [`${item.kind}:${item.itemId}`, { sortOrder: item.sortOrder ?? 0, featuredOrder: item.featuredOrder }])));
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); setMessage(''); try { await adminRequest(user, '/catalogue/order', { method: 'POST', body: JSON.stringify({ updates: catalogueItems.map((item) => ({ kind: item.kind, itemId: item.itemId, ...values[`${item.kind}:${item.itemId}`] })) }) }); setMessage('Catalogue order saved.'); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-[#014040]">Catalogue order</h2><p className="text-sm text-slate-600">Lower display numbers appear first inside each category. A featured number includes software on the homepage, in that order.</p></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save order'}</button></div>{data.categories.map((category) => { const items = catalogueItems.filter((item) => item.categoryId === category.categoryId); if (!items.length) return null; return <section key={category.categoryId} className="rounded-2xl border bg-white p-5"><h3 className="mb-3 text-lg font-black text-[#014040]">{category.name}</h3><div className="space-y-2">{items.map((item) => { const key = `${item.kind}:${item.itemId}`; const value = values[key] || { sortOrder: 0 }; return <div key={key} className="grid items-center gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_110px_130px]"><div><b className="text-sm">{item.name}</b><small className="block text-[10px] uppercase text-slate-500">{item.kind}</small></div><label className="text-[11px] font-bold text-slate-600">Display order<input className={inputClass} type="number" min="0" value={value.sortOrder} onChange={(event) => setValues((old) => ({ ...old, [key]: { ...value, sortOrder: Number(event.target.value) } }))} /></label>{item.kind === 'product' ? <label className="text-[11px] font-bold text-slate-600">Featured order<input className={inputClass} type="number" min="0" placeholder="Not featured" value={value.featuredOrder ?? ''} onChange={(event) => setValues((old) => ({ ...old, [key]: { ...value, featuredOrder: event.target.value === '' ? undefined : Number(event.target.value) } }))} /></label> : <span />}</div>; })}</div></section>; })}{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</div>;
}

export default function AdminPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState<Section>('orders');
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => onAuthStateChanged(adminAuth, async (next) => {
    if (next) {
      const claims = await next.getIdTokenResult().catch(() => null);
      if (claims?.claims.admin !== true) { await signOut(adminAuth); setUser(null); setChecking(false); return; }
    }
    setUser(next); setChecking(false);
  }), []);

  const reload = async () => {
    if (!user) return;
    setLoading(true); setError('');
    try { setData(await loadAdminData(user)); }
    catch (err) { setError(messageOf(err)); if (err instanceof AdminApiError && err.status === 401) await signOut(adminAuth); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user) void reload(); }, [user]);

  if (checking) return <div className="min-h-screen bg-[#f7faf9] p-8 text-[#014040]">{ADMIN_COPY.loading}</div>;
  if (!user) return <SignIn />;
  const nav: Array<{ id: Section; icon: React.ReactNode }> = [{ id: 'orders', icon: <ClipboardList /> }, { id: 'licences', icon: <Boxes /> }, { id: 'software', icon: <KeyRound /> }, { id: 'laptops', icon: <Settings2 /> }, { id: 'services', icon: <Settings2 /> }, { id: 'products', icon: <Images /> }, { id: 'landing', icon: <ImagePlus /> }, { id: 'ordering', icon: <ArrowUp /> }, { id: 'announcements', icon: <Bell /> }];
  return <div className="min-h-screen bg-[#f7faf9] text-slate-900"><header className="border-b border-[#cbdcd9] bg-[#014040] text-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6"><div><p className="text-lg font-black">{ADMIN_COPY.brand}</p><p className="text-xs text-slate-300">{user.email}</p></div><div className="flex gap-2"><button className="rounded-xl border border-white/20 p-2 hover:bg-white/10" onClick={reload} aria-label={ADMIN_COPY.refresh}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button><button className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10" onClick={() => signOut(adminAuth)}><LogOut className="h-4 w-4" />{ADMIN_COPY.signOut}</button></div></div></header><div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[210px_1fr]"><nav className="flex h-fit gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 lg:flex-col">{nav.map((item) => <button key={item.id} onClick={() => setSection(item.id)} className={`inline-flex min-w-fit items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-black ${section === item.id ? 'bg-[#014040] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{React.cloneElement(item.icon as React.ReactElement, { className: 'h-4 w-4' })}{ADMIN_COPY.sections[item.id]}</button>)}</nav><main>{error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p>}{!data ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">{ADMIN_COPY.loading}</div> : section === 'orders' ? <OrdersSection data={data} user={user} reload={reload} /> : section === 'licences' ? <LicencesSection data={data} user={user} reload={reload} /> : section === 'software' ? <SoftwareConfigurationSection data={data} user={user} reload={reload} /> : section === 'laptops' ? <LaptopPropertiesSection data={data} user={user} reload={reload} /> : section === 'services' ? <ServicesSection data={data} user={user} reload={reload} /> : section === 'products' ? <ProductMediaSection data={data} user={user} reload={reload} /> : section === 'landing' ? <LandingBannersSection data={data} user={user} reload={reload} /> : section === 'ordering' ? <CatalogueOrderSection data={data} user={user} reload={reload} /> : <AnnouncementsSection data={data} user={user} reload={reload} />}</main></div></div>;
}
