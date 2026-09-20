import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  BadgePercent,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  KeyRound,
  ImagePlus,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import { ADMIN_COPY } from '../config/storeCopy';
import { Announcement, Bundle, Category, CustomerRequest, Laptop as LaptopType, Order, PricingConfig, Product, Service, ServiceField, ServiceFieldType, ServiceOption, Variant } from '../types';
import { formatPesewas } from '../utils/money';
import { defaultCustomerInputType, defaultDeliveryCodeType, effectiveActivationWebsiteUrl } from '../utils/softwareFulfilment';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { ProductImage, renderableProductImageUrl } from '../components/ProductImage';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import { adminAuth } from './firebase';
import { AdminApiError, adminRequest, loadAdminData } from './api';
import { AdminData, AdminLicence, AdminMediaItem, ApiValidationError } from './types';
import { isTurnitinOrder } from '../utils/orderProgress';
import { documentContentType } from '../utils/documentFiles';
import { newestOrderFirst } from '../utils/orderSorting';
import { adminOrderMatchesSearch } from '../utils/adminOrderSearch';

type Section = 'orders' | 'requests' | 'categories' | 'services' | 'announcements' | 'landing' | 'pricing';

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
  const [filter, setFilter] = useState<'action' | 'all' | Order['fulfilmentStatus']>('all');
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
  const [reportLabel, setReportLabel] = useState('Turnitin report');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportProgress, setReportProgress] = useState(0);
  const [copiedPreviewValue, setCopiedPreviewValue] = useState('');
  const [quickLicenceOrderId, setQuickLicenceOrderId] = useState('');
  const [quickLicenceValue, setQuickLicenceValue] = useState('');
  const [quickLicenceMessage, setQuickLicenceMessage] = useState('');

  const selectedProduct = selected
    ? data.products.find((product) => product.productId === selected.productId || product.variants.some((variant) => variant.variantId === selected.variantId))
    : undefined;
  const selectedVariant = selectedProduct?.variants.find((variant) => variant.variantId === selected?.variantId);
  const productId = String(selected?.productId || selectedProduct?.productId || '').toUpperCase();
  const selectedIsTurnitin = Boolean(selected && isTurnitinOrder(selected));
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
    setReportFile(null);
    setReportProgress(0);
    setStep(0);
  }, [selected?.orderId, selected?.salesCode, selected?.customerInputValue, selected?.paymentStatus, selected?.fulfilmentStatus, selected?.amountPesewas]);

  const rows = useMemo(() => data.orders.filter((order) => {
    if (filter === 'action' && ['ready', 'pending-payment'].includes(order.fulfilmentStatus)) return false;
    if (filter !== 'action' && filter !== 'all' && order.fulfilmentStatus !== filter) return false;
    return adminOrderMatchesSearch(order, search);
  }).sort(newestOrderFirst), [data.orders, filter, search]);

  const copyPreviewValue = async (event: React.MouseEvent, key: string, value: string) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPreviewValue(key);
      window.setTimeout(() => setCopiedPreviewValue((current) => current === key ? '' : current), 2000);
    } catch {
      setMessage('Could not copy that value. Select it and copy it manually.');
    }
  };

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

  const assignQuickLicence = async (event: React.MouseEvent, order: Order, licenceId?: string) => {
    event.stopPropagation();
    const manualKey = quickLicenceValue.trim();
    if (!manualKey && !licenceId) { setQuickLicenceMessage('Paste a licence or choose the next available licence in stock.'); return; }
    setBusy(`quick-licence-${order.orderId}`); setQuickLicenceMessage(''); setMessage('');
    try {
      await adminRequest(user, `/orders/${encodeURIComponent(order.orderId)}/assign-licence`, { method: 'POST', body: JSON.stringify(manualKey ? { manualKey } : { licenceId }) });
      setQuickLicenceOrderId(''); setQuickLicenceValue(''); setMessage(`Licence added to ${order.orderId}.`);
      await reload();
    } catch (error) { setQuickLicenceMessage(messageOf(error)); }
    finally { setBusy(''); }
  };

  const openWhatsAppNotification = async (event: React.MouseEvent, order: Order, purpose: 'complete' | 'turnitin-document' | 'turnitin-report') => {
    event.stopPropagation();
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusy(`whatsapp-${order.orderId}`); setMessage('');
    try {
      const result = await adminRequest<{ whatsappUrl: string }>(user, `/orders/${encodeURIComponent(order.orderId)}/whatsapp-link`, { method: 'POST', body: JSON.stringify({ purpose }) });
      if (popup) popup.location.replace(result.whatsappUrl);
      else setMessage('WhatsApp is ready, but the browser blocked the new tab. Allow pop-ups and try again.');
    } catch (error) {
      popup?.close();
      setMessage(messageOf(error));
    } finally { setBusy(''); }
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

  const downloadReport = async (reportId: string) => {
    if (!selected) return;
    setBusy(`report-download-${reportId}`); setMessage('');
    try {
      const result = await adminRequest<{ url: string }>(user, `/orders/${encodeURIComponent(selected.orderId)}/reports/${encodeURIComponent(reportId)}`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) { setMessage(messageOf(err)); }
    finally { setBusy(''); }
  };

  const uploadReport = async () => {
    if (!selected || !reportFile || !reportLabel.trim()) return;
    const contentType = documentContentType(reportFile);
    if (!contentType) { setMessage('Choose a PDF or Word report (.pdf, .doc, or .docx).'); return; }
    setBusy('report-upload'); setMessage(''); setReportProgress(0);
    try {
      const authorization = await adminRequest<{ uploadUrl: string; objectPath: string; originalName: string; label: string }>(user, `/orders/${encodeURIComponent(selected.orderId)}/reports/upload-url`, {
        method: 'POST', body: JSON.stringify({ contentType, sizeBytes: reportFile.size, originalName: reportFile.name, label: reportLabel })
      });
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('PUT', authorization.uploadUrl);
        request.setRequestHeader('Content-Type', contentType);
        request.upload.onprogress = (event) => { if (event.lengthComputable) setReportProgress(Math.min(99, Math.round(event.loaded / event.total * 100))); };
        request.onerror = () => reject(new Error('The report upload was interrupted.'));
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Cloud Storage rejected the report upload.'));
        request.send(reportFile);
      });
      await adminRequest(user, `/orders/${encodeURIComponent(selected.orderId)}/reports`, {
        method: 'POST', body: JSON.stringify({ contentType, objectPath: authorization.objectPath, originalName: authorization.originalName, label: authorization.label })
      });
      setReportProgress(100); setReportFile(null); setReportLabel('Turnitin report'); setMessage('Report uploaded. The order is now Ready and the report is available to the customer.');
      await reload();
    } catch (err) { setMessage(messageOf(err)); }
    finally { setBusy(''); }
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
      <div className="space-y-3">
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">{ADMIN_COPY.orders.empty}</p>}
        {rows.map((order) => {
          const orderProduct = data.products.find((product) => product.productId === order.productId || product.variants.some((variant) => variant.variantId === order.variantId));
          const orderVariant = orderProduct?.variants.find((variant) => variant.variantId === order.variantId);
          const orderInputType = order.customerInputType || orderVariant?.customerInputRequired || defaultCustomerInputType(order.productId || orderProduct?.productId);
          const orderActivationUrl = effectiveActivationWebsiteUrl(orderVariant);
          const hasSavedLicence = Boolean(order.activationCodeOrKey || order.licenceId);
          const quickLicenceOpen = quickLicenceOrderId === order.orderId;
          const nextAvailableLicence = data.licences
            .filter((licence) => licence.variantId === order.variantId && licence.status === 'available')
            .sort((a, b) => (a.dateAdded || '').localeCompare(b.dateAdded || ''))[0];
          const orderIsTurnitin = isTurnitinOrder(order);
          const turnitinHasDocument = Boolean(order.documentPath || order.documentReceivedAt || order.documentUploadedAt || order.documentUploadStatus === 'uploaded' || order.documentSubmissionMethod === 'whatsapp');
          const whatsAppPurpose = orderIsTurnitin && order.fulfilmentStatus === 'ready' && Boolean(order.reportDocuments?.length)
            ? 'turnitin-report'
            : orderIsTurnitin && order.paymentStatus === 'paid' && !turnitinHasDocument
              ? 'turnitin-document'
              : !orderIsTurnitin && order.fulfilmentStatus === 'ready'
                ? 'complete'
                : null;
          const whatsAppLabel = whatsAppPurpose === 'turnitin-document'
            ? 'Notify customer on WhatsApp to submit their document'
            : whatsAppPurpose === 'turnitin-report'
              ? 'Notify customer on WhatsApp that their Turnitin report is ready'
              : 'Notify customer on WhatsApp that their order is complete';
          return <div key={order.orderId} role="button" tabIndex={0} onClick={() => { setSelected(order); setMessage(''); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(order); }} className="grid w-full cursor-pointer gap-3 rounded-2xl border border-[#cbdcd9] border-b-4 border-b-[#014040] bg-white p-4 text-left shadow-sm hover:bg-[#f3faf8] md:grid-cols-[140px_1fr_1fr_140px] md:items-center">
            <span className="font-mono text-xs font-bold text-[#014040]">{order.orderId}<small className="mt-1 block font-sans font-normal text-slate-500">{new Date(order.orderDate).toLocaleString()}</small></span>
            <span><strong className="block text-sm text-slate-900">{order.customerName}</strong><small className="text-slate-500">{order.phone}</small></span>
            <span><strong className="block text-sm text-slate-800">{order.productName}</strong><small className="text-slate-500">{order.versionOrPlan}</small></span>
            <span className="text-xs font-bold text-amber-700">{bucketLabel[order.fulfilmentStatus]}</span>
            {(order.customerInputValue || order.salesCode) && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#edf5f3] p-3 md:col-span-4">
              {order.customerInputValue && <span className="inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1 text-xs"><span><b>{orderInputType || 'Machine detail'}:</b> <span className="font-mono">{order.customerInputValue}</span></span><button type="button" onClick={(event) => void copyPreviewValue(event, `${order.orderId}-input`, order.customerInputValue!)} className="rounded-md p-1 text-[#014040] hover:bg-[#edf5f3]" aria-label={`Copy ${orderInputType || 'machine detail'}`}>{copiedPreviewValue === `${order.orderId}-input` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button></span>}
              {order.salesCode && <span className="inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1 text-xs"><span><b>Sales code:</b> <span className="font-mono">{order.salesCode}</span></span><button type="button" onClick={(event) => void copyPreviewValue(event, `${order.orderId}-sales`, order.salesCode!)} className="rounded-md p-1 text-[#014040] hover:bg-[#edf5f3]" aria-label="Copy Sales code" title="Copy Sales code">{copiedPreviewValue === `${order.orderId}-sales` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button></span>}
              {orderActivationUrl && <a href={orderActivationUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="rounded-lg bg-[#014040] px-3 py-1.5 text-xs font-black text-white">Activation link</a>}
            </div>}
            {(orderProduct || whatsAppPurpose) && <div className="flex flex-wrap items-center gap-2 border-t border-[#e4efed] pt-3 md:col-span-4" onClick={(event) => event.stopPropagation()}>
              {orderProduct && <button type="button" disabled={order.paymentStatus !== 'paid' || hasSavedLicence} title={order.paymentStatus !== 'paid' ? 'The order must be paid first.' : hasSavedLicence ? 'A licence is already attached.' : 'Add a licence without opening the full order.'} onClick={() => { setQuickLicenceOrderId((current) => current === order.orderId ? '' : order.orderId); setQuickLicenceValue(''); setQuickLicenceMessage(''); }} className={secondaryButton}><KeyRound className="h-4 w-4" />{hasSavedLicence ? 'Licence added' : 'Add license'}</button>}
              {whatsAppPurpose && <button type="button" disabled={busy === `whatsapp-${order.orderId}`} onClick={(event) => void openWhatsAppNotification(event, order, whatsAppPurpose)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#25d366] text-[#014040] shadow-sm transition hover:scale-105 disabled:opacity-50" aria-label={whatsAppLabel} title={whatsAppLabel}><WhatsAppIcon className={`h-5 w-5 ${busy === `whatsapp-${order.orderId}` ? 'animate-pulse' : ''}`} /></button>}
            </div>}
            {quickLicenceOpen && <section aria-label={`Add licence for ${order.orderId}`} onClick={(event) => event.stopPropagation()} className="rounded-2xl border border-[#9dbbb5] bg-[#f3faf8] p-4 md:col-span-4">
              <div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-black text-[#014040]">Add license</h4><p className="mt-1 text-xs text-slate-500">{order.productName} · {order.versionOrPlan}</p></div><button type="button" className="rounded-full p-1 text-slate-500 hover:bg-white" onClick={() => setQuickLicenceOrderId('')} aria-label="Close licence entry"><X className="h-4 w-4" /></button></div>
              <div className="mt-3 rounded-xl border border-[#cbdcd9] bg-white p-3"><p className="text-xs font-bold text-slate-700">Next available licence in stock</p>{nextAvailableLicence ? <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="font-mono text-xs text-slate-600">{nextAvailableLicence.maskedCode}</span><button type="button" disabled={busy === `quick-licence-${order.orderId}`} onClick={(event) => void assignQuickLicence(event, order, nextAvailableLicence.licenceId)} className={primaryButton}><KeyRound className="h-4 w-4" />{busy === `quick-licence-${order.orderId}` ? 'Adding…' : 'Use next available'}</button></div> : <p className="mt-2 text-xs text-amber-700">No available licence is in stock for this version.</p>}</div>
              <div className="my-3 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200" />or paste a licence<span className="h-px flex-1 bg-slate-200" /></div>
              <textarea className={`${inputClass} min-h-24 font-mono`} value={quickLicenceValue} onChange={(event) => setQuickLicenceValue(event.target.value)} placeholder="Paste a licence code" />
              {quickLicenceMessage && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{quickLicenceMessage}</p>}
              <button type="button" disabled={busy === `quick-licence-${order.orderId}` || !quickLicenceValue.trim()} onClick={(event) => void assignQuickLicence(event, order)} className={`${primaryButton} mt-3 w-full sm:w-auto`}><Plus className="h-4 w-4" />{busy === `quick-licence-${order.orderId}` ? 'Adding…' : 'Add pasted licence'}</button>
            </section>}
          </div>;
        })}
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
              {selected.customerInputValue && <div><b>{effectiveInputType || 'Machine detail'}</b><p className="break-all font-mono text-xs">{selected.customerInputValue}</p></div>}
              {selected.customerInputValue && selected.salesCode && <div><b>Sales ID</b><p className="break-all font-mono text-xs">{selected.salesCode}</p></div>}
              {selected.customerInputValue && activationUrl && <div className="flex items-end"><a className={secondaryButton} href={activationUrl} target="_blank" rel="noreferrer">Activation link</a></div>}
              {selected.activationCodeOrKey && <div className="md:col-span-3"><b>Attached licence / activation code</b><p className="break-all font-mono text-xs">{selected.activationCodeOrKey}</p></div>}
              {selected.serviceAnswers && <div className="md:col-span-3"><b>Service answers</b><pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">{JSON.stringify(selected.serviceAnswers, null, 2)}</pre></div>}
              {(selected.documentReceivedAt || selected.documentSubmissionMethod === 'whatsapp' || selected.documentUploadStatus === 'uploaded' || selected.documentUploadedAt) && <div className="md:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><b className="text-emerald-900">Document received: Yes</b><p className="mt-1 text-xs text-emerald-900">Method: {selected.documentSubmissionMethod === 'whatsapp' ? 'WhatsApp' : 'Website upload'}<br />{selected.documentSubmissionMethod !== 'whatsapp' && <>File name: {selected.documentOriginalName || 'Uploaded document'}<br /></>}Received: {selected.documentReceivedAt || selected.documentUploadedAt ? new Date(selected.documentReceivedAt || selected.documentUploadedAt!).toLocaleString() : 'Recorded'}</p></div>}
            </div>

            {selectedIsTurnitin && <section className="mt-5 rounded-2xl border border-[#cbdcd9] bg-[#f8fbfa] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-[#014040]">Turnitin documents and reports</h3><p className="mt-1 text-xs text-slate-600">Download the submitted document, then upload any number of labelled reports for the customer. Uploading a report automatically marks the order Ready.</p></div>{selected.documentPath && <button className={secondaryButton} disabled={Boolean(busy)} onClick={downloadDocument}><Download className="h-4 w-4" />Download submitted document</button>}</div>
              {!selected.documentPath && selected.documentSubmissionMethod === 'whatsapp' && <p className="mt-4 rounded-xl bg-white p-3 text-xs text-slate-600">The customer submitted this document through WhatsApp, so no portal file is available to download.</p>}
              {selected.reportDocuments?.length ? <div className="mt-4 space-y-2">{selected.reportDocuments.map((report) => <div key={report.reportId} className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><b className="block text-sm text-slate-900">{report.label}</b><p className="truncate text-xs text-slate-500">{report.originalName} · {new Date(report.uploadedAt).toLocaleString()}</p></div><button className={secondaryButton} disabled={Boolean(busy)} onClick={() => void downloadReport(report.reportId)}><Download className="h-4 w-4" />{busy === `report-download-${report.reportId}` ? 'Preparing…' : 'Download report'}</button></div>)}</div> : <p className="mt-4 rounded-xl bg-white p-3 text-xs text-slate-500">No reports have been uploaded yet.</p>}
              <div className="mt-4 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className={labelClass}>Report label<input className={inputClass} value={reportLabel} placeholder="e.g. Similarity report" onChange={(event) => setReportLabel(event.target.value)} /></label><label className={labelClass}>PDF or Word report<input className={inputClass} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setReportFile(event.target.files?.[0] || null)} /></label><button className={primaryButton} disabled={Boolean(busy) || selected.paymentStatus !== 'paid' || !reportFile || !reportLabel.trim()} onClick={() => void uploadReport()}><UploadCloud className="h-4 w-4" />{busy === 'report-upload' ? `Uploading ${reportProgress}%` : 'Upload labelled report'}</button>{busy === 'report-upload' && <div className="h-2 overflow-hidden rounded-full bg-slate-200 md:col-span-3"><div className="h-full bg-[#05ef28]" style={{ width: `${reportProgress}%` }} /></div>}</div>
            </section>}

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
              {selected.fulfilmentStatus === 'awaiting-document' && <div className="rounded-2xl border p-4"><button className={primaryButton} disabled={!!busy} onClick={() => act('received', `/orders/${selected.orderId}/mark-document-received`)}><FileText className="h-4 w-4" />{selectedIsTurnitin ? 'Mark WhatsApp document received' : ADMIN_COPY.orders.documentReceived}</button></div>}
              {selected.fulfilmentStatus === 'awaiting-customer-input' && <div className="rounded-2xl border p-4"><button className={secondaryButton} disabled={!!busy} onClick={() => act('nudge', `/orders/${selected.orderId}/nudge`)}><Send className="h-4 w-4" />{ADMIN_COPY.orders.nudgeCustomer}</button></div>}
              {selected.documentPath && !selectedIsTurnitin && <div className="rounded-2xl border p-4"><button className={secondaryButton} disabled={!!busy} onClick={downloadDocument}><Download className="h-4 w-4" />{ADMIN_COPY.orders.downloadDocument}</button></div>}
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

function RequestsSection({ requests }: { requests: CustomerRequest[] }) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const visible = requests.filter((request) => !normalized || [request.requestId, request.kind, request.customerName, request.phone, request.email, request.notes, JSON.stringify(request.details)].some((value) => String(value || '').toLowerCase().includes(normalized)));
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-black text-[#014040]">Customer requests</h2><p className="text-sm text-slate-600">Laptop, software, custom-bundle and quote enquiries submitted from the storefront.</p></div>
    <label className="relative block max-w-2xl"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, email, request reference or submitted details" /></label>
    <div className="space-y-3">{visible.map((request) => <details key={request.requestId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-[#014040]">{request.customerName}</h3><p className="mt-1 text-xs font-bold text-slate-500">{request.kind.replaceAll('-', ' ')} · {request.requestId}</p></div><div className="text-right text-xs text-slate-500"><span className="rounded-full bg-[#edf5f3] px-2.5 py-1 font-black uppercase text-[#014040]">{request.status || 'new'}</span><time className="mt-2 block">{request.requestDate ? new Date(request.requestDate).toLocaleString() : ''}</time></div></div></summary><div className="space-y-4 border-t bg-slate-50 p-4 sm:p-5"><div className="grid gap-3 text-sm sm:grid-cols-2"><div><b className="block text-xs uppercase tracking-wider text-slate-500">Phone</b><a className="font-bold text-[#014040] hover:underline" href={`tel:${request.phone}`}>{request.phone}</a></div><div><b className="block text-xs uppercase tracking-wider text-slate-500">Email</b>{request.email ? <a className="break-all font-bold text-[#014040] hover:underline" href={`mailto:${request.email}`}>{request.email}</a> : <span>—</span>}</div></div>{request.notes && <div><b className="text-xs uppercase tracking-wider text-slate-500">Notes</b><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{request.notes}</p></div>}<dl className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">{Object.entries(request.details || {}).map(([key, value]) => <div key={key}><dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-800">{typeof value === 'string' ? value || '—' : JSON.stringify(value, null, 2)}</dd></div>)}</dl></div></details>)}</div>
    {!visible.length && <p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">No requests match this search.</p>}
  </div>;
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
        <label className="block rounded-xl border border-amber-200 bg-[#fffaf0] p-4"><span className="flex items-center gap-2 text-sm font-black text-[#014040]"><input type="checkbox" checked={draft.showDeliveryNotice === true} onChange={(e) => set('showDeliveryNotice', e.target.checked)} />Show delivery-window notice</span><small className="mt-1 block font-normal text-slate-600">Show the 20–40 minute fulfilment estimate, delivery hours and outside-hours confirmation for this service.</small></label>
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
    <section className="rounded-2xl border border-amber-200 bg-[#fffaf0] p-5"><h3 className="font-black text-[#014040]">Delivery-time notices</h3><p className="mt-1 text-xs text-slate-600">Show the 20–40 minute fulfilment estimate and delivery-hours information to customers for this version.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{draft.variants.map((variant, index) => <label key={variant.variantId} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm font-bold"><span>{variant.versionOrPlan} · {variant.os}<small className="mt-0.5 block font-normal text-slate-500">Show delivery-time notice</small></span><span className="inline-flex items-center gap-2"><input type="checkbox" checked={variant.showDeliveryNotice === true} onChange={(e) => setVariant(index, 'showDeliveryNotice', e.target.checked)} />{variant.showDeliveryNotice ? 'On' : 'Off'}</span></label>)}</div></section>
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
  // Canvas conversion would flatten an animated GIF to its first frame.
  if (file.type === 'image/gif') return file;
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
  const mediaKey = (item: AdminData['mediaItems'][number]) => `${item.kind}:${item.itemId}`;
  const [selectionKey, setSelectionKey] = useState(data.mediaItems[0] ? mediaKey(data.mediaItems[0]) : '');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => ({ [data.categories[0]?.categoryId || '']: true }));
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const product = data.mediaItems.find((item) => mediaKey(item) === selectionKey) || data.mediaItems[0];
  const mediaGroups = useMemo(() => {
    const categories = data.categories.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const productMediaItems = data.mediaItems.filter((item) => item.kind !== 'category') as Array<AdminData['mediaItems'][number] & { kind: 'product' | 'bundle' | 'service' | 'laptop' }>;
    const groups = categories.map((category) => ({
      category,
      categoryMedia: data.mediaItems.find((item) => item.kind === 'category' && item.itemId === category.categoryId),
      items: productMediaItems.filter((item) => item.categoryId === category.categoryId)
    }));
    const known = new Set(categories.map((category) => category.categoryId));
    const uncategorized = productMediaItems.filter((item) => !known.has(item.categoryId || ''));
    if (uncategorized.length) groups.push({ category: { categoryId: 'OTHER', name: 'Other', tagline: '', icon: '', sortOrder: 999, active: true }, categoryMedia: undefined, items: uncategorized });
    return groups;
  }, [data.categories, data.mediaItems]);

  useEffect(() => {
    if (selectionKey && data.mediaItems.some((item) => mediaKey(item) === selectionKey)) return;
    setSelectionKey(data.mediaItems[0] ? mediaKey(data.mediaItems[0]) : '');
  }, [data.mediaItems, selectionKey]);

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
  const iconUrl = productMediaUrl(product.kind === 'category' ? product.iconImagePath : product.imagePath) || product.imageUrl;
  const cardUrl = productMediaUrl(product.kind === 'category' ? product.imagePath : product.cardImagePath);
  const bannerUrl = productMediaUrl(product.bannerImagePath);
  const mobileBannerUrl = productMediaUrl(product.mobileBannerImagePath);

  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-black text-[#014040]">{ADMIN_COPY.products.title}</h2><p className="text-sm text-slate-600">{ADMIN_COPY.products.subtitle}</p></div>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-2xl border bg-white p-2">
          <div className="space-y-2">{mediaGroups.map(({ category, categoryMedia, items }) => <section key={category.categoryId} className="overflow-hidden rounded-xl border border-slate-200"><div className="flex items-stretch bg-[#f8fbfa]">{categoryMedia ? <button type="button" onClick={() => { setSelectionKey(mediaKey(categoryMedia)); setMessage(''); }} className={`flex min-w-0 flex-1 items-center gap-3 p-3 text-left ${selectionKey === mediaKey(categoryMedia) ? 'bg-[#014040] text-white' : 'hover:bg-[#edf5f3]'}`}><ProductImage name={category.name} itemId={category.categoryId} imageUrl={productMediaUrl(categoryMedia.iconImagePath) || productMediaUrl(categoryMedia.imagePath)} size="sm" /><span className="min-w-0"><b className="block truncate text-sm">{category.name}</b><small className={selectionKey === mediaKey(categoryMedia) ? 'text-white/70' : 'text-slate-500'}>Category card media</small></span></button> : <div className="min-w-0 flex-1 p-3 text-sm font-black">{category.name}</div>}<button type="button" onClick={() => setExpandedCategories((old) => ({ ...old, [category.categoryId]: !old[category.categoryId] }))} className="border-l px-3 text-xs font-black text-[#014040]" aria-expanded={Boolean(expandedCategories[category.categoryId])}>{expandedCategories[category.categoryId] ? '−' : '+'}<span className="sr-only"> {expandedCategories[category.categoryId] ? 'Collapse' : 'Expand'} products</span></button></div>{expandedCategories[category.categoryId] && <div className="space-y-1 border-t p-2">{items.length ? items.map((item) => <button key={mediaKey(item)} onClick={() => { setSelectionKey(mediaKey(item)); setMessage(''); }} className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm ${selectionKey === mediaKey(item) ? 'bg-[#edf5f3] font-black text-[#014040]' : 'hover:bg-slate-50'}`}><ProductImage name={item.name} itemId={item.itemId} imageUrl={productMediaUrl(item.imagePath) || item.imageUrl} kind={item.kind} size="sm" /><span className="min-w-0 truncate">{item.name}<small className="block font-mono text-[10px] text-slate-500">{item.kind} · {item.itemId}</small></span></button>) : <p className="p-3 text-xs text-slate-500">No products in this category.</p>}</div>}</section>)}</div>
        </aside>
        <section className="space-y-7 rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-3"><ProductImage name={product.name} itemId={product.itemId} imageUrl={iconUrl} kind={product.kind === 'category' ? undefined : product.kind} /><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{product.kind}</p><h3 className="text-xl font-black text-[#014040]">{product.name}</h3></div></div>

          <div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black text-[#014040]">{product.kind === 'category' ? 'Category icon' : 'Product icon'}</h4><p className="text-xs text-slate-500">Recommended: {product.kind === 'category' ? '512 × 512 px. GIF is supported and appears only while customers hover over the category.' : '800 × 800 px, square PNG or WebP.'}</p></div><label className={secondaryButton}>{busy === 'icon' ? ADMIN_COPY.products.uploading : 'Choose icon'}<input type="file" accept={product.kind === 'category' ? 'image/gif,image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp'} className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload('icon', event.target.files); event.currentTarget.value = ''; }} /></label></div>{(product.kind === 'category' ? product.iconImagePath : product.imagePath) && <div className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl bg-[#edf5f3] p-3"><img src={iconUrl} alt="" className="h-full w-full object-contain" /><button className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-rose-700" onClick={() => void remove((product.kind === 'category' ? product.iconImagePath : product.imagePath)!)}><Trash2 className="h-4 w-4" /></button></div>}</div>

          <div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black text-[#014040]">{product.kind === 'category' ? 'Image clipped into the category card' : 'Card image'}</h4><p className="text-xs text-slate-500">Recommended: 1200 × 800 px (3:2 landscape).</p></div><label className={secondaryButton}>{busy === 'card' ? ADMIN_COPY.products.uploading : 'Choose card image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload('card', event.target.files); event.currentTarget.value = ''; }} /></label></div>{cardUrl ? <div className="relative aspect-[3/2] max-w-md overflow-hidden rounded-2xl bg-[#014040]"><img src={cardUrl} alt="" className="h-full w-full object-cover" /><button className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-rose-700" onClick={() => void remove((product.kind === 'category' ? product.imagePath : product.cardImagePath)!)}><Trash2 className="h-4 w-4" /></button></div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No card image uploaded yet.</p>}</div>

          {product.kind !== 'category' && <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black text-[#014040]">Web banner</h4><p className="text-xs text-slate-500">Recommended: 1600 × 1000 px (16:10 landscape).</p></div><label className={secondaryButton}>{busy === 'banner' ? ADMIN_COPY.products.uploading : ADMIN_COPY.products.chooseBanner}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload('banner', event.target.files); event.currentTarget.value = ''; }} /></label></div>
            {bannerUrl ? <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#014040]"><img src={bannerUrl} alt="" width="1600" height="1000" className="h-full w-full object-cover" />{product.bannerImagePath?.startsWith('catalogue/') && <button className="absolute right-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-rose-700" disabled={Boolean(busy)} onClick={() => void remove(product.bannerImagePath!)}><Trash2 className="mr-1 inline h-3.5 w-3.5" />{ADMIN_COPY.products.remove}</button>}</div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">{ADMIN_COPY.products.noBanner}</p>}
          </div>}

          {product.kind !== 'category' && <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black text-[#014040]">Mobile card image</h4><p className="text-xs text-slate-500">Portrait artwork recommended: 900 × 1200 px.</p></div><label className={secondaryButton}>{busy === 'mobile-banner' ? ADMIN_COPY.products.uploading : 'Choose mobile image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload('mobile-banner', event.target.files); event.currentTarget.value = ''; }} /></label></div>
            {mobileBannerUrl ? <div className="relative aspect-[3/4] max-w-xs overflow-hidden rounded-2xl bg-[#014040]"><img src={mobileBannerUrl} alt="" className="h-full w-full object-cover" />{product.mobileBannerImagePath?.startsWith('catalogue/') && <button className="absolute right-3 top-3 rounded-xl bg-white/90 p-2 text-rose-700" onClick={() => void remove(product.mobileBannerImagePath!)}><Trash2 className="h-4 w-4" /></button>}</div> : <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">The large-screen image is used until a mobile image is uploaded.</p>}
          </div>}

          {product.kind !== 'category' && <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black text-[#014040]">{ADMIN_COPY.products.gallery}</h4><p className="text-xs text-slate-500">Recommended: 1400 × 1050 px (4:3). Up to 12 images.</p></div><label className={secondaryButton}>{busy === 'gallery' ? ADMIN_COPY.products.uploading : ADMIN_COPY.products.chooseGallery}<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(busy)} onChange={(event) => { void upload('gallery', event.target.files); event.currentTarget.value = ''; }} /></label></div>
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

function pricingTargetId(item: AdminData['mediaItems'][number]): string {
  return item.kind === 'service' ? `SERVICE:${item.itemId}` : item.itemId;
}

function dateTimeLocal(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function PricingPromotionsSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const catalogueItems = data.mediaItems.filter((item) => item.kind !== 'category');
  const [pricing, setPricing] = useState<PricingConfig>(() => structuredClone(data.pricing));
  const [silentDirection, setSilentDirection] = useState<'increase' | 'decrease'>(() => data.pricing.silentAdjustment.percent < 0 ? 'decrease' : 'increase');
  const [fixedDirections, setFixedDirections] = useState<Record<string, 'increase' | 'decrease'>>(() => Object.fromEntries(
    Object.entries(data.pricing.silentAdjustment.fixedAdjustmentsGhs || {}).map(([targetId, amount]) => [targetId, amount < 0 ? 'decrease' : 'increase'])
  ));
  const [selectedItemId, setSelectedItemId] = useState(() => catalogueItems[0] ? pricingTargetId(catalogueItems[0]) : '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const itemRules = pricing.itemSpecificPromotions || [];
  const selectedRule = itemRules.find((rule) => rule.targetId === selectedItemId) || {
    targetId: selectedItemId,
    active: false,
    percent: 0,
    label: '',
    targetIds: [selectedItemId]
  };

  const setSelectedRule = (patch: Partial<typeof selectedRule>) => {
    const next = { ...selectedRule, ...patch, targetId: selectedItemId, targetIds: [selectedItemId] };
    setPricing((old) => ({
      ...old,
      itemSpecificPromotions: [...(old.itemSpecificPromotions || []).filter((rule) => rule.targetId !== selectedItemId), next]
    }));
  };

  const toggleGlobalTarget = (targetId: string) => setPricing((old) => {
    const targets = old.globalPromotion.targetIds.includes(targetId)
      ? old.globalPromotion.targetIds.filter((id) => id !== targetId)
      : [...old.globalPromotion.targetIds, targetId];
    return { ...old, globalPromotion: { ...old.globalPromotion, targetIds: targets } };
  });

  const toggleSilentCategory = (categoryId: string) => setPricing((old) => {
    const targetId = `CATEGORY:${categoryId}`;
    const targets = old.silentAdjustment.targetIds.includes(targetId)
      ? old.silentAdjustment.targetIds.filter((id) => id !== targetId)
      : [...old.silentAdjustment.targetIds, targetId];
    return { ...old, silentAdjustment: { ...old.silentAdjustment, targetIds: targets } };
  });

  const setFixedAdjustment = (targetId: string, amount: number) => setPricing((old) => ({
    ...old,
    silentAdjustment: {
      ...old.silentAdjustment,
      fixedAdjustmentsGhs: { ...(old.silentAdjustment.fixedAdjustmentsGhs || {}), [targetId]: amount }
    }
  }));

  const save = async () => {
    setBusy(true); setMessage('');
    try {
      await adminRequest(user, '/pricing', { method: 'PUT', body: JSON.stringify(pricing) });
      setMessage('Pricing and promotion rules saved. Store prices have been refreshed.');
      await reload();
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-[#014040]">Pricing & promotions</h2><p className="text-sm text-slate-600">Adjust live prices, schedule promotions, and choose exactly where each rule applies.</p></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save pricing rules'}</button></div>

    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-black text-[#014040]">Global promotion</h3><p className="text-xs text-slate-500">Customers see the promotion and a live countdown. Leave every item unchecked to apply it store-wide.</p></div><label className="inline-flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={pricing.globalPromotion.active} onChange={(event) => setPricing((old) => ({ ...old, globalPromotion: { ...old.globalPromotion, active: event.target.checked } }))} />{pricing.globalPromotion.active ? 'On' : 'Off'}</label></div>
      <div className="grid gap-3 md:grid-cols-3"><label className={labelClass}>Discount (%)<input className={inputClass} type="number" min="0" max="100" value={pricing.globalPromotion.percent} onChange={(event) => setPricing((old) => ({ ...old, globalPromotion: { ...old.globalPromotion, percent: Number(event.target.value) } }))} /></label><label className={labelClass}>Promotion description<input className={inputClass} value={pricing.globalPromotion.label} placeholder="Back to school promo" onChange={(event) => setPricing((old) => ({ ...old, globalPromotion: { ...old.globalPromotion, label: event.target.value } }))} /></label><label className={labelClass}>End date and time<input className={inputClass} type="datetime-local" value={dateTimeLocal(pricing.globalPromotion.endsAt)} onChange={(event) => setPricing((old) => ({ ...old, globalPromotion: { ...old.globalPromotion, endsAt: event.target.value ? new Date(event.target.value).toISOString() : undefined } }))} /></label></div>
      <details className="rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-black text-[#014040]">Choose products and services ({pricing.globalPromotion.targetIds.length || 'all'})</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><label className="flex items-center gap-2 rounded-lg bg-white p-2 text-xs font-bold"><input type="checkbox" checked={pricing.globalPromotion.targetIds.length === 0} onChange={() => setPricing((old) => ({ ...old, globalPromotion: { ...old.globalPromotion, targetIds: [] } }))} />All catalogue items</label>{catalogueItems.map((item) => { const targetId = pricingTargetId(item); return <label key={`${item.kind}:${item.itemId}`} className="flex items-center gap-2 rounded-lg bg-white p-2 text-xs"><input type="checkbox" checked={pricing.globalPromotion.targetIds.includes(targetId)} onChange={() => toggleGlobalTarget(targetId)} /><span><b>{item.name}</b><small className="ml-1 uppercase text-slate-400">{item.kind}</small></span></label>; })}</div></details>
    </section>

    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-black text-[#014040]">Item-specific promotions</h3><p className="text-xs text-slate-500">An active item promotion overrides the global promotion for that item.</p></div><label className="inline-flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={pricing.itemSpecificPromotion.active} onChange={(event) => setPricing((old) => ({ ...old, itemSpecificPromotion: { ...old.itemSpecificPromotion, active: event.target.checked } }))} />{pricing.itemSpecificPromotion.active ? 'On' : 'Off'}</label></div>
      <label className={labelClass}>Product or service<select className={inputClass} value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>{catalogueItems.map((item) => <option key={`${item.kind}:${item.itemId}`} value={pricingTargetId(item)}>{item.name} · {item.kind}</option>)}</select></label>
      <div className="grid gap-3 md:grid-cols-[110px_1fr_1fr_1fr]"><label className={labelClass}>This promo<label className="flex h-[38px] items-center gap-2 rounded-xl border px-3"><input type="checkbox" checked={selectedRule.active} onChange={(event) => setSelectedRule({ active: event.target.checked })} />{selectedRule.active ? 'On' : 'Off'}</label></label><label className={labelClass}>Discount (%)<input className={inputClass} type="number" min="0" max="100" value={selectedRule.percent} onChange={(event) => setSelectedRule({ percent: Number(event.target.value) })} /></label><label className={labelClass}>Description<input className={inputClass} value={selectedRule.label} placeholder="Special offer" onChange={(event) => setSelectedRule({ label: event.target.value })} /></label><label className={labelClass}>End date and time<input className={inputClass} type="datetime-local" value={dateTimeLocal(selectedRule.endsAt)} onChange={(event) => setSelectedRule({ endsAt: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></label></div>
    </section>

    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-black text-[#014040]">Silent price adjustment</h3><p className="text-xs text-slate-500">Changes the selling price without showing a promotion badge. Percentage and fixed adjustments can be combined.</p></div><label className="inline-flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={pricing.silentAdjustment.active} onChange={(event) => setPricing((old) => ({ ...old, silentAdjustment: { ...old.silentAdjustment, active: event.target.checked } }))} />{pricing.silentAdjustment.active ? 'On' : 'Off'}</label></div>
      <div className="grid gap-3 md:grid-cols-[180px_180px_1fr]"><label className={labelClass}>Direction<select className={inputClass} value={silentDirection} onChange={(event) => { const direction = event.target.value as 'increase' | 'decrease'; setSilentDirection(direction); setPricing((old) => ({ ...old, silentAdjustment: { ...old.silentAdjustment, percent: Math.abs(old.silentAdjustment.percent) * (direction === 'decrease' ? -1 : 1) } })); }}><option value="increase">Increase</option><option value="decrease">Decrease</option></select></label><label className={labelClass}>Global adjustment (%)<input className={inputClass} type="number" min="0" max="1000" value={Math.abs(pricing.silentAdjustment.percent)} onChange={(event) => setPricing((old) => ({ ...old, silentAdjustment: { ...old.silentAdjustment, percent: Number(event.target.value) * (silentDirection === 'decrease' ? -1 : 1) } }))} /></label><div><p className="mb-1 text-xs font-bold text-slate-700">Categories</p><div className="flex flex-wrap gap-2"><label className="rounded-lg border px-3 py-2 text-xs font-bold"><input className="mr-2" type="checkbox" checked={pricing.silentAdjustment.targetIds.length === 0} onChange={() => setPricing((old) => ({ ...old, silentAdjustment: { ...old.silentAdjustment, targetIds: [] } }))} />All</label>{data.categories.map((category) => <label key={category.categoryId} className="rounded-lg border px-3 py-2 text-xs font-bold"><input className="mr-2" type="checkbox" checked={pricing.silentAdjustment.targetIds.includes(`CATEGORY:${category.categoryId}`)} onChange={() => toggleSilentCategory(category.categoryId)} />{category.name}</label>)}</div></div></div>
      <details className="rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-black text-[#014040]">Fixed adjustments by product or service</summary><p className="mt-2 text-xs text-slate-500">Choose Increase or Decrease and enter a cedi amount. Set the amount to 0 to disable the fixed adjustment.</p><div className="mt-3 space-y-4">{data.categories.map((category) => { const items = catalogueItems.filter((item) => item.categoryId === category.categoryId); if (!items.length) return null; return <div key={category.categoryId}><h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#014040]">{category.name}</h4><div className="space-y-2">{items.map((item) => { const targetId = pricingTargetId(item); const signed = pricing.silentAdjustment.fixedAdjustmentsGhs?.[targetId] || 0; const direction = fixedDirections[targetId] || (signed < 0 ? 'decrease' : 'increase'); return <div key={`${item.kind}:${item.itemId}`} className="grid items-center gap-2 rounded-lg bg-white p-2 sm:grid-cols-[1fr_130px_150px]"><span className="text-xs font-bold">{item.name}<small className="ml-1 uppercase text-slate-400">{item.kind}</small></span><select className={inputClass} value={direction} onChange={(event) => { const nextDirection = event.target.value as 'increase' | 'decrease'; setFixedDirections((old) => ({ ...old, [targetId]: nextDirection })); setFixedAdjustment(targetId, Math.abs(signed) * (nextDirection === 'decrease' ? -1 : 1)); }}><option value="increase">Increase</option><option value="decrease">Decrease</option></select><label className="flex items-center gap-2 text-xs font-bold">GHS<input className={inputClass} type="number" min="0" step="0.01" value={Math.abs(signed)} onChange={(event) => setFixedAdjustment(targetId, Number(event.target.value) * (direction === 'decrease' ? -1 : 1))} /></label></div>; })}</div></div>; })}</div></details>
    </section>
    {message && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}
  </div>;
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

type SetupSelection =
  | { kind: 'category'; id: string }
  | { kind: 'product' | 'bundle' | 'service' | 'laptop'; id: string }
  | { kind: 'variant'; id: string; productId: string };

function PublishedControl({ checked, onChange, version = false }: { checked: boolean; onChange: (value: boolean) => void; version?: boolean }) {
  return <label className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${checked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}><span><b className="block text-sm text-slate-800">{version ? 'Show this OS/version on the storefront' : 'Published on storefront'}</b><small className="text-slate-500">{checked ? 'Customers can see this item.' : 'Hidden while you configure it.'}</small></span><span className="inline-flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{checked ? 'On' : 'Off'}</span></label>;
}

function SetupMediaEditor({ media, user, reload }: { media?: AdminMediaItem; user: User; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  if (!media) return null;
  const isCategory = media.kind === 'category';
  const upload = async (role: 'icon' | 'card' | 'banner' | 'mobile-banner' | 'gallery', files?: FileList | null) => {
    if (!files?.length) return;
    setBusy(role); setMessage('');
    try {
      const selected = role === 'gallery' ? Array.from(files) : Array.from(files).slice(0, 1);
      for (const file of selected) {
        const blob = await resizeProductImage(file, role);
        await adminRequest(user, `/catalogue/${media.kind}/${encodeURIComponent(media.itemId)}/images?role=${role}`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
      }
      setMessage('Media saved.');
      await reload();
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(''); }
  };
  const remove = async (path: string) => {
    if (!window.confirm('Remove this image?')) return;
    setBusy(path); setMessage('');
    try {
      await adminRequest(user, `/catalogue/${media.kind}/${encodeURIComponent(media.itemId)}/images`, { method: 'DELETE', body: JSON.stringify({ objectPath: path }) });
      setMessage('Image removed.'); await reload();
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(''); }
  };
  const rows = [
    { role: 'icon' as const, title: isCategory ? 'Category icon' : 'Product icon', help: isCategory ? '512 × 512 px. GIF supported; animation plays on hover.' : '800 × 800 px, square.', path: isCategory ? media.iconImagePath : media.imagePath },
    { role: 'card' as const, title: isCategory ? 'Clipped category-card image' : 'Preview card image', help: '1200 × 800 px (3:2).', path: isCategory ? media.imagePath : media.cardImagePath },
    ...(!isCategory ? [
      { role: 'banner' as const, title: 'Web banner', help: '1600 × 1000 px (16:10).', path: media.bannerImagePath },
      { role: 'mobile-banner' as const, title: 'Mobile banner', help: '900 × 1200 px (3:4).', path: media.mobileBannerImagePath }
    ] : [])
  ];
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div><h3 className="font-black text-[#014040]">Images</h3><p className="text-xs text-slate-500">Artwork is attached directly to this {isCategory ? 'category' : 'product'}.</p></div><div className="grid gap-4 xl:grid-cols-2">{rows.map((row) => <div key={row.role} className="rounded-xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><b className="text-sm">{row.title}</b><p className="text-[11px] text-slate-500">Recommended: {row.help}</p></div><label className={secondaryButton}>{busy === row.role ? 'Uploading…' : 'Choose'}<input className="sr-only" type="file" accept={isCategory && row.role === 'icon' ? 'image/gif,image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp'} disabled={Boolean(busy)} onChange={(event) => { void upload(row.role, event.target.files); event.currentTarget.value = ''; }} /></label></div>{row.path ? <div className="relative mt-3 aspect-[3/2] overflow-hidden rounded-xl bg-[#edf5f3]"><img src={productMediaUrl(row.path)} alt="" className="h-full w-full object-contain" /><button type="button" onClick={() => void remove(row.path!)} className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button></div> : <p className="mt-3 rounded-lg border border-dashed p-4 text-center text-xs text-slate-400">Not uploaded</p>}</div>)}</div>{!isCategory && <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><b className="text-sm">Gallery</b><p className="text-[11px] text-slate-500">1400 × 1050 px (4:3), up to 12 images.</p></div><label className={secondaryButton}>{busy === 'gallery' ? 'Uploading…' : 'Add images'}<input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={(event) => { void upload('gallery', event.target.files); event.currentTarget.value = ''; }} /></label></div>{media.screenshots?.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{media.screenshots.map((path) => <div key={path} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white"><img src={productMediaUrl(path)} alt="" className="h-full w-full object-contain" />{path.startsWith('catalogue/') && <button type="button" onClick={() => void remove(path)} className="absolute right-1 top-1 rounded bg-white/90 p-1.5 text-rose-700"><Trash2 className="h-3 w-3" /></button>}</div>)}</div> : <p className="mt-3 text-xs text-slate-400">No gallery images yet.</p>}</div>}{message && <p role="status" className="rounded-xl bg-slate-100 p-3 text-xs font-bold">{message}</p>}</section>;
}

function CategorySetupEditor({ category, media, user, reload }: { category: Category; media?: AdminMediaItem; user: User; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(category));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const set = <K extends keyof Category>(key: K, value: Category[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const save = async () => { setBusy(true); setMessage(''); try { await adminRequest(user, `/categories/${encodeURIComponent(draft.categoryId)}`, { method: 'PUT', body: JSON.stringify(draft) }); setMessage('Category saved.'); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  return <div className="space-y-5"><section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Category card</p><h3 className="text-xl font-black text-[#014040]">{draft.name}</h3></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />Save category</button></div><PublishedControl checked={draft.active} onChange={(value) => set('active', value)} /><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Category name<input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} /></label><label className={labelClass}>Icon label / fallback<input className={inputClass} value={draft.icon} onChange={(e) => set('icon', e.target.value)} /></label><label className={`${labelClass} sm:col-span-2`}>Tagline<input className={inputClass} value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} /></label><label className={labelClass}>Display order<input className={inputClass} type="number" min="0" value={draft.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></label></div>{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</section><SetupMediaEditor media={media} user={user} reload={reload} /></div>;
}

function ProductSetupEditor({ product, media, data, user, reload }: { product: Product; media?: AdminMediaItem; data: AdminData; user: User; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(product));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const set = <K extends keyof Product>(key: K, value: Product[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const categoryName = data.categories.find((category) => category.categoryId === draft.categoryId)?.name || '';
  const supportsSingleLicenceNotice = /(data|analysis|visuali[sz]ation|design|engineering)/i.test(`${draft.categoryId} ${categoryName}`);
  const allVariantsShowDeliveryNotice = draft.variants.length > 0 && draft.variants.every((variant) => variant.showDeliveryNotice === true);
  const setDeliveryNoticeForAllVersions = (checked: boolean) => setDraft((old) => ({ ...old, variants: old.variants.map((variant) => ({ ...variant, showDeliveryNotice: checked })) }));
  const windowsOnlyVariants = draft.variants.filter((variant) => /win/i.test(variant.os || '') && !/mac/i.test(variant.os || ''));
  const parallelsEnabled = windowsOnlyVariants.length > 0 && windowsOnlyVariants.every((variant) => variant.macViaParallels === true);
  const parallelsInstallerUrl = windowsOnlyVariants.find((variant) => variant.parallelsInstallerUrl)?.parallelsInstallerUrl || '';
  const windows11DownloadUrl = windowsOnlyVariants.find((variant) => variant.windows11DownloadUrl)?.windows11DownloadUrl || '';
  const updateWindowsOnlyVariants = (patch: Partial<Variant>) => setDraft((old) => ({
    ...old,
    variants: old.variants.map((variant) => /win/i.test(variant.os || '') && !/mac/i.test(variant.os || '') ? { ...variant, ...patch } : variant)
  }));
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      await adminRequest(user, `/products/${encodeURIComponent(draft.productId)}/configuration`, { method: 'PUT', body: JSON.stringify(draft) });
      setMessage('Software preview saved.'); await reload();
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Software preview</p><h3 className="text-xl font-black text-[#014040]">{draft.productName}</h3></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />Save product</button></div>
      <PublishedControl checked={draft.active} onChange={(value) => set('active', value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Product name<input className={inputClass} value={draft.productName} onChange={(e) => set('productName', e.target.value)} /></label>
        <label className={labelClass}>Licence term<input className={inputClass} value={draft.licenceTerm || ''} placeholder="e.g. Permanent Licence or 1 Year" onChange={(e) => set('licenceTerm', e.target.value || undefined)} /><small className="block font-normal text-slate-500">Applies to this software as a whole, not to an individual version.</small></label>
        <label className={labelClass}>Category<select className={inputClass} value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{data.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}</select></label>
        <label className={`${labelClass} sm:col-span-2`}>About this software<textarea className={inputClass} rows={5} value={draft.description || ''} onChange={(e) => set('description', e.target.value)} /></label>
        <label className={labelClass}>Display order<input className={inputClass} type="number" min="0" value={draft.sortOrder ?? 0} onChange={(e) => set('sortOrder', Number(e.target.value))} /></label>
        <label className={labelClass}>Featured order<input className={inputClass} type="number" min="0" placeholder="Leave blank if not featured" value={draft.featuredOrder ?? ''} onChange={(e) => set('featuredOrder', e.target.value === '' ? undefined : Number(e.target.value))} /></label>
        <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm font-bold"><input className="mt-1" type="checkbox" checked={allVariantsShowDeliveryNotice} onChange={(e) => setDeliveryNoticeForAllVersions(e.target.checked)} /><span>Show delivery-window notice on every version<small className="mt-1 block font-normal text-slate-500">Controls the storefront notice and outside-hours confirmation.</small></span></label>
        {supportsSingleLicenceNotice && <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm font-bold"><input className="mt-1" type="checkbox" checked={draft.showSingleLicenceDisclaimer === true} onChange={(e) => set('showSingleLicenceDisclaimer', e.target.checked)} /><span>Show single-licence, single-version and single-laptop disclaimer<small className="mt-1 block font-normal text-slate-500">For Data Analysis, Visualisation, Design and Engineering software.</small></span></label>}
      </div>
      {windowsOnlyVariants.length > 0 && <div className="space-y-3 rounded-2xl border border-[#cbdcd9] bg-[#f8fbfa] p-4">
        <label className="flex items-start gap-2 text-sm font-black text-[#014040]"><input className="mt-1" type="checkbox" checked={parallelsEnabled} onChange={(e) => updateWindowsOnlyVariants({ macViaParallels: e.target.checked })} /><span>Offer Mac via Parallels at no extra cost<small className="mt-1 block font-normal text-slate-500">Adds the option to all Windows-only versions of this software.</small></span></label>
        {parallelsEnabled && <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Parallels download URL<input className={inputClass} type="url" value={parallelsInstallerUrl} onChange={(e) => updateWindowsOnlyVariants({ parallelsInstallerUrl: e.target.value || undefined })} /></label><label className={labelClass}>Windows 11 download URL<input className={inputClass} type="url" value={windows11DownloadUrl} onChange={(e) => updateWindowsOnlyVariants({ windows11DownloadUrl: e.target.value || undefined })} /></label></div>}
      </div>}
      {message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}
    </section>
    <SetupMediaEditor media={media} user={user} reload={reload} />
  </div>;
}

function BundleSetupEditor({ bundle, media, data, user, reload }: { bundle: Bundle; media?: AdminMediaItem; data: AdminData; user: User; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(bundle));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const set = <K extends keyof Bundle>(key: K, value: Bundle[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const save = async () => { setBusy(true); setMessage(''); try { await adminRequest(user, `/bundles/${encodeURIComponent(draft.bundleId)}`, { method: 'PUT', body: JSON.stringify(draft) }); setMessage('Bundle saved.'); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  return <div className="space-y-5"><section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Bundle preview</p><h3 className="text-xl font-black text-[#014040]">{draft.name}</h3></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />Save bundle</button></div><PublishedControl checked={draft.active} onChange={(value) => set('active', value)} /><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Bundle name<input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} /></label><label className={labelClass}>Category<select className={inputClass} value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{data.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}</select></label><label className={`${labelClass} sm:col-span-2`}>About this bundle<textarea className={inputClass} rows={5} value={draft.description} onChange={(e) => set('description', e.target.value)} /></label><label className={labelClass}>Price (GHS)<input className={inputClass} type="number" min="0" step="0.01" value={draft.priceGhs} onChange={(e) => set('priceGhs', Number(e.target.value))} /></label><label className={labelClass}>Display order<input className={inputClass} type="number" min="0" value={draft.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></label></div><div className="rounded-xl bg-slate-50 p-4"><b className="text-sm">Included software</b><ul className="mt-2 space-y-1 text-xs text-slate-600">{draft.items.map((item) => <li key={item.itemId}>{item.productId} · {item.variantId}{item.altGroup ? ` · Choice: ${item.altLabel || item.altGroup}` : ''}</li>)}</ul></div>{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</section><SetupMediaEditor media={media} user={user} reload={reload} /></div>;
}

function ServiceSetupEditor({ service, media, data, user, reload }: { service: Service; media?: AdminMediaItem; data: AdminData; user: User; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(service));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const set = <K extends keyof Service>(key: K, value: Service[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const save = async () => { setBusy(true); setMessage(''); try { await adminRequest(user, `/services/${encodeURIComponent(draft.serviceId)}`, { method: 'PUT', body: JSON.stringify(draft) }); setMessage('Service preview saved. Use the Services tab for form fields and priced options.'); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  return <div className="space-y-5"><section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Service preview</p><h3 className="text-xl font-black text-[#014040]">{draft.name}</h3></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />Save service</button></div><PublishedControl checked={draft.active} onChange={(value) => set('active', value)} /><div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>Service name<input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} /></label><label className={labelClass}>Category<select className={inputClass} value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{data.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}</select></label><label className={`${labelClass} sm:col-span-2`}>Preview tagline<input className={inputClass} value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} /></label><label className={`${labelClass} sm:col-span-2`}>About this service<textarea className={inputClass} rows={5} value={draft.description} onChange={(e) => set('description', e.target.value)} /></label><label className={labelClass}>Display order<input className={inputClass} type="number" min="0" value={draft.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></label><label className={labelClass}>Button label<input className={inputClass} value={draft.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} /></label></div>{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</section><SetupMediaEditor media={media} user={user} reload={reload} /></div>;
}

function LaptopSetupEditor({ laptop, media, data, user, reload }: { laptop: LaptopType; media?: AdminMediaItem; data: AdminData; user: User; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(laptop));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const set = (field: keyof LaptopType, value: unknown) => setDraft((old) => ({ ...old, [field]: value }));
  const save = async () => { setBusy(true); setMessage(''); try { await adminRequest(user, `/laptops/${encodeURIComponent(draft.laptopId)}`, { method: 'PUT', body: JSON.stringify(draft) }); setMessage('Laptop saved.'); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  const specs: Array<[keyof LaptopType, string]> = [['brand','Brand'],['model','Model'],['processor','Processor'],['ram','RAM'],['storage','Storage'],['screen','Screen size'],['colour','Colour'],['operatingSystem','Operating system'],['graphics','Graphics card'],['graphicsDetails','Dedicated graphics type and capacity'],['ports','Ports'],['freebies','Freebies included']];
  return <div className="space-y-5"><section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Laptop preview and specifications</p><h3 className="text-xl font-black text-[#014040]">{draft.title}</h3></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />Save laptop</button></div><PublishedControl checked={draft.active} onChange={(value) => set('active', value)} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><label className={labelClass}>Laptop name<input className={inputClass} value={draft.title} onChange={(e) => set('title', e.target.value)} /></label><label className={labelClass}>Category<select className={inputClass} value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{data.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}</select></label>{specs.map(([field, label]) => <label key={field} className={labelClass}>{label}<input className={inputClass} value={String(draft[field] || '')} onChange={(e) => set(field, e.target.value)} /></label>)}<label className={labelClass}>Price (GHS)<input className={inputClass} type="number" min="0" step="0.01" value={draft.priceGhs ?? ''} onChange={(e) => set('priceGhs', e.target.value === '' ? undefined : Number(e.target.value))} /></label><label className={labelClass}>Availability<select className={inputClass} value={draft.availability} onChange={(e) => set('availability', e.target.value)}><option>Available</option><option>Pre-order</option></select></label><label className={labelClass}>Display order<input className={inputClass} type="number" min="0" value={draft.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></label><label className={`${labelClass} sm:col-span-2 xl:col-span-3`}>About this laptop<textarea className={inputClass} rows={5} value={draft.description || ''} onChange={(e) => set('description', e.target.value)} /></label><label className={`${labelClass} sm:col-span-2 xl:col-span-3`}>Internal / specification notes<textarea className={inputClass} rows={3} value={draft.notes || ''} onChange={(e) => set('notes', e.target.value)} /></label></div>{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</section><SetupMediaEditor media={media} user={user} reload={reload} /></div>;
}

function VariantSetupEditor({ product, variant, data, user, reload }: { product: Product; variant: Variant; data: AdminData; user: User; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(variant));
  const [stock, setStock] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [revealed, setRevealed] = useState<Record<string, string>>({});
  const set = <K extends keyof Variant>(key: K, value: Variant[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const save = async () => { setBusy(true); setMessage(''); try { const updated = { ...product, variants: product.variants.map((item) => item.variantId === draft.variantId ? draft : item) }; await adminRequest(user, `/products/${encodeURIComponent(product.productId)}/configuration`, { method: 'PUT', body: JSON.stringify(updated) }); setMessage('Version configuration saved.'); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  const addStock = async () => { const rows = stock.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).map((licenceCode, index) => ({ row: index + 1, variantId: draft.variantId, licenceCode, codeType: draft.deliveryCodeType === 'sales-code' ? 'sales-code' : 'licence' })); setBusy(true); setMessage(''); try { const result = await adminRequest<{ imported: number }>(user, '/licences/import', { method: 'POST', body: JSON.stringify({ rows }) }); setStock(''); setMessage(`${result.imported} ${draft.deliveryCodeType === 'sales-code' ? 'Sales IDs' : 'licences'} added.`); await reload(); } catch (error) { setMessage(messageOf(error)); } finally { setBusy(false); } };
  const entries = data.licences.filter((entry) => entry.variantId === draft.variantId);
  const reveal = async (entry: AdminLicence) => { const result = await adminRequest<{ licenceCode: string }>(user, `/licences/${encodeURIComponent(entry.licenceId)}/reveal`); setRevealed((old) => ({ ...old, [entry.licenceId]: result.licenceCode })); };
  const isSales = draft.deliveryCodeType === 'sales-code';
  return <div className="space-y-5"><section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">{product.productName}</p><h3 className="text-xl font-black text-[#014040]">{draft.versionOrPlan} · {draft.os}</h3><p className="font-mono text-[10px] text-slate-400">{draft.variantId}</p></div><button className={primaryButton} disabled={busy} onClick={save}><Save className="h-4 w-4" />Save version</button></div><PublishedControl version checked={draft.available} onChange={(value) => set('available', value)} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><label className={labelClass}>Version<input className={inputClass} value={draft.versionOrPlan} onChange={(e) => set('versionOrPlan', e.target.value)} /></label><label className={labelClass}>Operating system<input className={inputClass} value={draft.os} onChange={(e) => set('os', e.target.value)} /></label><label className={labelClass}>Price (GHS)<input className={inputClass} type="number" min="0" step="0.01" value={draft.priceGhs} onChange={(e) => set('priceGhs', Number(e.target.value))} /></label><label className={labelClass}>Stock type<select className={inputClass} value={draft.deliveryCodeType || 'licence'} onChange={(e) => set('deliveryCodeType', e.target.value as Variant['deliveryCodeType'])}><option value="licence">Customer licence</option><option value="sales-code">Sales ID (admin only)</option></select></label><label className={labelClass}>Customer activation detail<select className={inputClass} value={draft.customerInputRequired || ''} onChange={(e) => set('customerInputRequired', e.target.value)}><option value="">None</option><option>Lock Code</option><option>Hardware ID</option></select></label><label className={labelClass}>Activation website URL<input className={inputClass} type="url" value={draft.activationWebsiteUrl || draft.activationLink || ''} onChange={(e) => set('activationWebsiteUrl', e.target.value)} /></label><label className={labelClass}>Download software URL<input className={inputClass} type="url" value={draft.windowsInstallerUrl || ''} onChange={(e) => set('windowsInstallerUrl', e.target.value)} /></label><label className={labelClass}>Installation guide URL<input className={inputClass} type="url" value={draft.guideUrl || ''} onChange={(e) => set('guideUrl', e.target.value)} /></label><label className={labelClass}>Learning resources URL<input className={inputClass} type="url" value={draft.learningResourcesUrl || ''} onChange={(e) => set('learningResourcesUrl', e.target.value)} /></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.latest} onChange={(e) => set('latest', e.target.checked)} />Recommended latest version</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.autoFulfil} onChange={(e) => set('autoFulfil', e.target.checked)} />{isSales ? 'Automatically assign Sales ID' : 'Automatically deliver licence'}</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.showDeliveryNotice === true} onChange={(e) => set('showDeliveryNotice', e.target.checked)} />Show delivery-time notice</label></div></section><section className="rounded-2xl border bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-[#014040]">{isSales ? 'Sales ID' : 'Licence'} stock</h3><p className="text-xs text-slate-500">{entries.filter((entry) => entry.status === 'available').length} available for this exact version and OS.</p></div></div><textarea className={`${inputClass} mt-4 min-h-28 font-mono`} placeholder={`Paste one ${isSales ? 'Sales ID' : 'licence'} per line`} value={stock} onChange={(e) => setStock(e.target.value)} /><button className={`${primaryButton} mt-3`} disabled={busy || !stock.trim()} onClick={addStock}><Plus className="h-4 w-4" />Add to stock</button>{entries.length > 0 && <div className="mt-4 divide-y rounded-xl border">{entries.map((entry) => <div key={entry.licenceId} className="flex items-center justify-between gap-3 p-3 text-xs"><span className="min-w-0 break-all font-mono">{revealed[entry.licenceId] || entry.maskedCode}<small className="block font-sans text-slate-500">{entry.status}{entry.assignedOrderId ? ` · ${entry.assignedOrderId}` : ''}</small></span><button className={secondaryButton} onClick={() => void reveal(entry)}><Eye className="h-3.5 w-3.5" />Reveal</button></div>)}</div>}</section>{message && <p className="rounded-xl bg-slate-100 p-3 text-sm font-bold">{message}</p>}</div>;
}

function CategorySetupSection({ data, user, reload }: { data: AdminData; user: User; reload: () => Promise<void> }) {
  const sortedCategories = useMemo(() => data.categories.slice().sort((a, b) => a.sortOrder - b.sortOrder), [data.categories]);
  const [selection, setSelection] = useState<SetupSelection>(() => ({ kind: 'category', id: sortedCategories[0]?.categoryId || '' }));
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => ({ [sortedCategories[0]?.categoryId || '']: true }));
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const mediaFor = (kind: AdminMediaItem['kind'], id: string) => data.mediaItems.find((item) => item.kind === kind && item.itemId === id);
  const itemsFor = (categoryId: string) => data.mediaItems.filter((item) => item.kind !== 'category' && item.categoryId === categoryId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const selectedKey = selection.kind === 'variant' ? `variant:${selection.productId}:${selection.id}` : `${selection.kind}:${selection.id}`;
  const editor = (() => {
    if (selection.kind === 'category') { const item = data.categories.find((value) => value.categoryId === selection.id); return item ? <CategorySetupEditor key={selectedKey} category={item} media={mediaFor('category', item.categoryId)} user={user} reload={reload} /> : null; }
    if (selection.kind === 'product') { const item = data.products.find((value) => value.productId === selection.id); return item ? <ProductSetupEditor key={selectedKey} product={item} media={mediaFor('product', item.productId)} data={data} user={user} reload={reload} /> : null; }
    if (selection.kind === 'bundle') { const item = data.bundles.find((value) => value.bundleId === selection.id); return item ? <BundleSetupEditor key={selectedKey} bundle={item} media={mediaFor('bundle', item.bundleId)} data={data} user={user} reload={reload} /> : null; }
    if (selection.kind === 'service') { const item = data.services.find((value) => value.serviceId === selection.id); return item ? <ServiceSetupEditor key={selectedKey} service={item} media={mediaFor('service', item.serviceId)} data={data} user={user} reload={reload} /> : null; }
    if (selection.kind === 'laptop') { const item = data.laptops.find((value) => value.laptopId === selection.id); return item ? <LaptopSetupEditor key={selectedKey} laptop={item} media={mediaFor('laptop', item.laptopId)} data={data} user={user} reload={reload} /> : null; }
    if (selection.kind !== 'variant') return null;
    const product = data.products.find((value) => value.productId === selection.productId); const variant = product?.variants.find((value) => value.variantId === selection.id); return product && variant ? <VariantSetupEditor key={selectedKey} product={product} variant={variant} data={data} user={user} reload={reload} /> : null;
  })();
  return <div className="space-y-5"><div><h2 className="text-2xl font-black text-[#014040]">Category setup</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">Select a category to edit its card. Expand it to select a product, then expand software to configure a specific version and operating system.</p></div><div className="grid items-start gap-5 xl:grid-cols-[330px_minmax(0,1fr)]"><aside className="max-h-[calc(100vh-8rem)] space-y-2 overflow-y-auto rounded-2xl border bg-white p-2 xl:sticky xl:top-5">{sortedCategories.map((category) => { const categoryKey = `category:${category.categoryId}`; const items = itemsFor(category.categoryId); const open = expandedCategories[category.categoryId]; return <section key={category.categoryId} className="overflow-hidden rounded-xl border border-slate-200"><div className="flex bg-[#f8fbfa]"><button className={`min-w-0 flex-1 p-3 text-left ${selectedKey === categoryKey ? 'bg-[#014040] text-white' : 'hover:bg-[#edf5f3]'}`} onClick={() => setSelection({ kind: 'category', id: category.categoryId })}><b className="block truncate text-sm">{category.name}</b><small className={selectedKey === categoryKey ? 'text-white/70' : 'text-slate-500'}>{category.active ? 'Published' : 'Hidden'} · category card</small></button><button type="button" className="border-l px-3 text-[#014040]" onClick={() => setExpandedCategories((old) => ({ ...old, [category.categoryId]: !open }))} aria-label={`${open ? 'Collapse' : 'Expand'} ${category.name}`}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></div>{open && <div className="space-y-1 border-t p-2">{items.length ? items.map((item) => { const itemKey = `${item.kind}:${item.itemId}`; const product = item.kind === 'product' ? data.products.find((value) => value.productId === item.itemId) : undefined; const productOpen = Boolean(expandedProducts[item.itemId]); return <div key={itemKey}><div className="flex"><button className={`min-w-0 flex-1 rounded-lg p-2.5 text-left ${selectedKey === itemKey ? 'bg-[#edf5f3] font-black text-[#014040]' : 'hover:bg-slate-50'}`} onClick={() => setSelection({ kind: item.kind, id: item.itemId })}><span className="block truncate text-sm">{item.name}</span><small className="block text-[10px] uppercase text-slate-400">{item.kind}</small></button>{product && <button type="button" className="px-2 text-[#014040]" onClick={() => setExpandedProducts((old) => ({ ...old, [item.itemId]: !productOpen }))} aria-label={`${productOpen ? 'Collapse' : 'Expand'} versions`}>{productOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>}</div>{product && productOpen && <div className="ml-3 space-y-1 border-l-2 border-[#cbdcd9] pl-2">{product.variants.map((variant) => { const variantKey = `variant:${product.productId}:${variant.variantId}`; return <button key={variant.variantId} type="button" onClick={() => setSelection({ kind: 'variant', id: variant.variantId, productId: product.productId })} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${selectedKey === variantKey ? 'bg-[#014040] font-black text-white' : 'hover:bg-slate-50'}`}><span className="block truncate">{variant.versionOrPlan} · {variant.os || 'All OS'}</span><small className={selectedKey === variantKey ? 'text-white/70' : variant.available ? 'text-emerald-700' : 'text-slate-400'}>{variant.available ? 'Visible' : 'Hidden'}</small></button>; })}</div>}</div>; }) : <p className="p-3 text-xs text-slate-500">No items in this category.</p>}</div>}</section>; })}</aside><main>{editor || <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Choose a category or product to configure it.</div>}</main></div></div>;
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

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try { setData(await loadAdminData(user)); }
    catch (err) { setError(messageOf(err)); if (err instanceof AdminApiError && err.status === 401) await signOut(adminAuth); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { if (user) void reload(); }, [user, reload]);
  useEffect(() => {
    if (!user || section !== 'orders') return;
    const timer = window.setInterval(() => { void reload(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [user, section, reload]);

  if (checking) return <div className="min-h-screen bg-[#f7faf9] p-8 text-[#014040]">{ADMIN_COPY.loading}</div>;
  if (!user) return <SignIn />;
  const nav: Array<{ id: Section; icon: React.ReactNode }> = [{ id: 'orders', icon: <ClipboardList /> }, { id: 'requests', icon: <FileText /> }, { id: 'categories', icon: <Settings2 /> }, { id: 'services', icon: <Settings2 /> }, { id: 'pricing', icon: <BadgePercent /> }, { id: 'landing', icon: <ImagePlus /> }, { id: 'announcements', icon: <Bell /> }];
  const content = !data ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">{ADMIN_COPY.loading}</div>
    : section === 'orders' ? <OrdersSection data={data} user={user} reload={reload} />
    : section === 'requests' ? <RequestsSection requests={data.requests} />
    : section === 'categories' ? <CategorySetupSection data={data} user={user} reload={reload} />
    : section === 'services' ? <ServicesSection data={data} user={user} reload={reload} />
    : section === 'pricing' ? <PricingPromotionsSection data={data} user={user} reload={reload} />
    : section === 'landing' ? <LandingBannersSection data={data} user={user} reload={reload} />
    : <AnnouncementsSection data={data} user={user} reload={reload} />;
  return <div className="min-h-screen bg-[#f7faf9] text-slate-900"><header className="border-b border-[#cbdcd9] bg-[#014040] text-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6"><div><p className="text-lg font-black">{ADMIN_COPY.brand}</p><p className="text-xs text-slate-300">{user.email}</p></div><div className="flex gap-2"><button className="rounded-xl border border-white/20 p-2 hover:bg-white/10" onClick={reload} aria-label={ADMIN_COPY.refresh}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button><button className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10" onClick={() => signOut(adminAuth)}><LogOut className="h-4 w-4" />{ADMIN_COPY.signOut}</button></div></div></header><div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[210px_1fr]"><label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-600 lg:hidden">Admin section<select className={inputClass} value={section} onChange={(event) => setSection(event.target.value as Section)}>{nav.map((item) => <option key={item.id} value={item.id}>{ADMIN_COPY.sections[item.id]}</option>)}</select></label><nav className="hidden h-fit gap-2 rounded-2xl border border-slate-200 bg-white p-2 lg:flex lg:flex-col">{nav.map((item) => <button key={item.id} onClick={() => setSection(item.id)} className={`inline-flex min-w-fit items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-black ${section === item.id ? 'bg-[#014040] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{React.cloneElement(item.icon as React.ReactElement, { className: 'h-4 w-4' })}{ADMIN_COPY.sections[item.id]}</button>)}</nav><main className="min-w-0">{error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p>}{content}</main></div></div>;
}
