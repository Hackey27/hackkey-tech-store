import React, { useState } from 'react';
import {
  Phone,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Download,
  BookOpen,
  CreditCard,
  RefreshCw,
  Clock
} from 'lucide-react';
import { OrderProgressBar } from './OrderProgressBar';
import { Order } from '../types';
import { STORE_COPY } from '../config/storeCopy';
import { formatCurrencyGHS } from '../utils/pricingEngine';

/** The stored statuses are kebab-case; these are what the customer reads. */
const FULFILMENT_LABELS: Record<string, string> = {
  'pending-payment': 'Pending payment',
  'awaiting-customer-input': 'Awaiting your details',
  'awaiting-document': 'Awaiting your document',
  'awaiting-licence': 'Awaiting licence',
  'awaiting-seller-activation': 'Being prepared',
  ready: 'Ready'
};

const fulfilmentLabel = (status: string) => FULFILMENT_LABELS[status] || status;

/**
 * A WhatsApp link with the order reference already in the message, so the
 * document arrives identifying the order it belongs to rather than as an
 * anonymous file.
 */
function whatsAppSubmissionLink(orderId: string, productName: string): string {
  const text = `Order ${orderId} — ${productName}. Here is my document.`;
  return `${STORE_COPY.brand.whatsAppUrl}?text=${encodeURIComponent(text)}`;
}

export const FindOrderView: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Per-order customer input form state: { [orderId]: string }
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isSubmittingInput, setIsSubmittingInput] = useState<Record<string, boolean>>({});
  const [actionSuccessMessage, setActionSuccessMessage] = useState<Record<string, string>>({});
  const [actionErrorMessage, setActionErrorMessage] = useState<Record<string, string>>({});

  // Per-order licence saving state
  const [returnedLicenceValues, setReturnedLicenceValues] = useState<Record<string, string>>({});

  // Copied states
  const [copiedKeys, setCopiedKeys] = useState<Record<string, boolean>>({});

  const handleCopy = (keyId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeys((prev) => ({ ...prev, [keyId]: true }));
    setTimeout(() => {
      setCopiedKeys((prev) => ({ ...prev, [keyId]: false }));
    }, 2000);
  };

  const executeLookup = async (phoneToSearch: string) => {
    if (!phoneToSearch.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);
    setHasSearched(false);

    try {
      const res = await fetch(`/api/orders/lookup?phone=${encodeURIComponent(phoneToSearch.trim())}`);
      if (res.status === 429) {
        throw new Error('Too many search requests. Please wait a moment before trying again.');
      }
      if (!res.ok) {
        throw new Error(`Failed to lookup orders. Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrders(data.orders || []);
      setHasSearched(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error looking up orders');
      setHasSearched(true);
      setOrders([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFindOrder = (e: React.FormEvent) => {
    e.preventDefault();
    executeLookup(phoneNumber);
  };

  const handleSubmitCustomerInput = async (order: Order) => {
    const val = inputValues[order.orderId];
    if (!val || !val.trim()) return;

    setIsSubmittingInput((prev) => ({ ...prev, [order.orderId]: true }));
    setActionErrorMessage((prev) => ({ ...prev, [order.orderId]: '' }));
    setActionSuccessMessage((prev) => ({ ...prev, [order.orderId]: '' }));

    try {
      const res = await fetch(`/api/orders/${order.orderId}/customer-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputValue: val.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit input.');
      }

      setActionSuccessMessage((prev) => ({ ...prev, [order.orderId]: data.message }));
      // Refresh order in list
      if (data.order) {
        setOrders((prev) => prev.map((o) => (o.orderId === order.orderId ? data.order : o)));
      }
    } catch (err: any) {
      setActionErrorMessage((prev) => ({ ...prev, [order.orderId]: err.message }));
    } finally {
      setIsSubmittingInput((prev) => ({ ...prev, [order.orderId]: false }));
    }
  };

  const handleSaveLicenceCode = async (order: Order) => {
    const val = returnedLicenceValues[order.orderId];
    if (!val || !val.trim()) return;

    setActionErrorMessage((prev) => ({ ...prev, [order.orderId]: '' }));
    setActionSuccessMessage((prev) => ({ ...prev, [order.orderId]: '' }));

    try {
      const res = await fetch(`/api/orders/${order.orderId}/save-licence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenceCode: val.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save licence.');
      }

      setActionSuccessMessage((prev) => ({ ...prev, [order.orderId]: data.message }));
      if (data.order) {
        setOrders((prev) => prev.map((o) => (o.orderId === order.orderId ? data.order : o)));
      }
    } catch (err: any) {
      setActionErrorMessage((prev) => ({ ...prev, [order.orderId]: err.message }));
    }
  };

  // Maps order state to numeric step for progress bar
  const getOrderCurrentStep = (order: Order): number => {
    if (order.paymentStatus !== 'paid') return 2; // Step 2: Payment Received / Pending
    if (order.fulfilmentStatus === 'ready') return 5;
    if (order.salesCode) return 4;
    if (order.customerInputValue) return 4;
    if (order.customerInputType) return 3;
    return 3;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Heading & Search Instructions */}
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#edf5f3] text-[#014040] flex items-center justify-center mx-auto mb-3 shadow-2xs">
          <Phone className="w-6 h-6 text-[#014040]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#014040] tracking-tight">
          {STORE_COPY.findOrder.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1.5 max-w-md mx-auto">
          {STORE_COPY.findOrder.subtitle}
        </p>
      </div>

      {/* Phone Lookup Card */}
      <div className="bg-white rounded-2xl border border-[#d8e7e4] p-6 sm:p-8 shadow-xs">
        <form onSubmit={handleFindOrder} className="space-y-4">
          <div>
            <label
              htmlFor="order-phone-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
            >
              {STORE_COPY.findOrder.phoneLabel}
            </label>
            <input
              id="order-phone-input"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={STORE_COPY.findOrder.phonePlaceholder}
              className="w-full px-4 py-3 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-base font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#05ef28]/40 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="w-full py-3.5 px-4 bg-[#05ef28] hover:bg-[#04d824] active:scale-98 text-[#014040] font-black text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSearching ? STORE_COPY.findOrder.searching : STORE_COPY.findOrder.submitButton}
          </button>
        </form>

        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Lookup Results */}
      {hasSearched && !errorMessage && (
        <div className="space-y-6">
          {orders.length > 0 ? (
            orders.map((order) => {
              const inputType = order.customerInputType || 'Lock Code';
              const isHardwareId = inputType === 'Hardware ID';
              const machineTypeForProgress = isHardwareId
                ? 'hardware-id'
                : order.customerInputType
                ? 'lock-code'
                : 'none';
              const currentStep = getOrderCurrentStep(order);

              return (
                <div
                  key={order.orderId}
                  className="bg-white rounded-2xl border border-[#d8e7e4] p-6 sm:p-8 shadow-sm space-y-6"
                >
                  {/* Header / Customer Greeting */}
                  <div className="border-b border-[#edf4f3] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-black text-[#014040]">
                        {STORE_COPY.findOrder.resultsGreeting(order.customerName)}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Order #{order.orderId} · Placed on {order.orderDate} · {order.deliveryOs}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs font-bold text-slate-500 block">Total Amount</span>
                      <span className="text-base font-black text-[#014040]">
                        {formatCurrencyGHS(order.amountGhs)}
                      </span>
                    </div>
                  </div>

                  {/* Product Title */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f8fbfa] p-4 rounded-xl border border-[#e1ece9]">
                    <div>
                      <h3 className="text-base font-bold text-[#014040]">
                        {order.productName}
                      </h3>
                      <span className="text-xs text-slate-600">
                        {order.versionOrPlan}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          order.paymentStatus === 'paid'
                            ? 'bg-[#d9ffe0] text-[#0d6520]'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.paymentStatus === 'paid' ? 'paid' : 'Unpaid'}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          order.fulfilmentStatus === 'ready'
                            ? 'bg-[#014040] text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {fulfilmentLabel(order.fulfilmentStatus)}
                      </span>
                    </div>
                  </div>

                  {/* Paid, but nothing received yet. The customer either
                      uploads, or sends it on WhatsApp with the reference
                      already filled in. */}
                  {order.fulfilmentStatus === 'awaiting-document' && (
                    <div className="p-3.5 rounded-xl bg-[#f0f9f7] border border-[#cbdcd9] space-y-2">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        We have your payment. Send us your document and we will get started.
                      </p>
                      <a
                        href={whatsAppSubmissionLink(order.orderId, order.productName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25d366] hover:bg-[#1fb855] text-white text-xs font-bold transition-colors"
                      >
                        Send it on WhatsApp
                      </a>
                    </div>
                  )}

                  {/* Stepped Progress Bar matching exact specification */}
                  <div className="pt-1">
                    <OrderProgressBar
                      machineCodeType={machineTypeForProgress}
                      currentStep={currentStep}
                    />
                  </div>

                  {/* STATE 1: UNPAID (Section 7) -> Show Pay button & MoMo transfer info */}
                  {order.paymentStatus !== 'paid' && (
                    <div className="p-5 rounded-2xl bg-[#fffaf0] border border-amber-200 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-amber-900">
                            Payment Pending: {formatCurrencyGHS(order.amountGhs)}
                          </h4>
                          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                            This order is awaiting payment confirmation. You can pay securely online or transfer via MTN Mobile Money.
                          </p>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* STATE 2: PAID, AWAITING CUSTOMER INPUT (Lock Code / Hardware ID) (Section 4.3 & 7) */}
                  {order.paymentStatus === 'paid' &&
                    order.customerInputType &&
                    !order.customerInputValue && (
                      <div className="p-5 sm:p-6 rounded-2xl bg-[#fbfdfc] border-2 border-[#014040] space-y-4">
                        <div>
                          <h4 className="text-base font-bold text-[#014040]">
                            {isHardwareId
                              ? STORE_COPY.findOrder.hardwareId.title
                              : STORE_COPY.findOrder.lockCode.title}
                          </h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {isHardwareId
                              ? STORE_COPY.findOrder.hardwareId.instruction
                              : STORE_COPY.findOrder.lockCode.instruction}
                          </p>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSubmitCustomerInput(order);
                          }}
                          className="space-y-3"
                        >
                          <div>
                            <input
                              type="text"
                              value={inputValues[order.orderId] || ''}
                              onChange={(e) =>
                                setInputValues((prev) => ({
                                  ...prev,
                                  [order.orderId]: e.target.value
                                }))
                              }
                              placeholder={
                                isHardwareId
                                  ? STORE_COPY.findOrder.hardwareId.placeholder
                                  : STORE_COPY.findOrder.lockCode.placeholder
                              }
                              required
                              className="w-full font-mono text-sm px-4 py-3 bg-white border border-[#cbdcd9] rounded-xl text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#05ef28]/40 uppercase tracking-wider"
                            />
                          </div>

                          <div className="text-xs text-slate-500">
                            {STORE_COPY.findOrder.inputHelper(
                              isHardwareId ? 'Hardware ID' : 'Lock Code'
                            )}
                          </div>

                          {/* Verbatim Warning from Section 4.3 */}
                          <div className="p-3 bg-[#fffaf0] border-l-4 border-[#e0a800] rounded-r-xl text-xs text-[#8a5b00]">
                            {STORE_COPY.findOrder.inputWarn}
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmittingInput[order.orderId]}
                            className="w-full py-3.5 px-4 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isSubmittingInput[order.orderId]
                              ? 'Submitting...'
                              : isHardwareId
                              ? STORE_COPY.findOrder.hardwareId.button
                              : STORE_COPY.findOrder.lockCode.button}
                          </button>
                        </form>
                      </div>
                    )}

                  {/* Confirmation / Error Alerts for Customer Input */}
                  {actionSuccessMessage[order.orderId] && (
                    <div className="p-4 bg-[#d9ffe0] border border-[#b2f0bf] text-[#0d6520] rounded-xl text-xs space-y-1">
                      <div className="font-bold">Input Confirmed</div>
                      <div>{actionSuccessMessage[order.orderId]}</div>
                    </div>
                  )}

                  {actionErrorMessage[order.orderId] && (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs space-y-1">
                      <div className="font-bold">Action Alert</div>
                      <div>{actionErrorMessage[order.orderId]}</div>
                    </div>
                  )}

                  {/* Display Submitted Customer Input (Section 4.3: cannot be changed) */}
                  {order.customerInputValue && (
                    <div className="p-4 bg-[#edf5f3] rounded-xl border border-[#cbe3dd] space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        {STORE_COPY.findOrder.submittedStatus(inputType)}
                      </span>
                      <div className="font-mono font-bold text-sm text-[#014040] break-all">
                        {order.customerInputValue}
                      </div>
                      <p className="text-xs text-slate-500 pt-1">
                        {STORE_COPY.findOrder.receivedWaiting}
                      </p>
                    </div>
                  )}

                  {/* STATE 3: SALES CODE ISSUED (Section 4 & 7) -> Sales code with Copy button, activation link, and input to save licence */}
                  {order.salesCode && (
                    <div className="p-5 sm:p-6 rounded-2xl bg-[#f0f7f6] border border-[#b8ded6] space-y-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#014040]">
                          Sales Code Issued for Activation
                        </span>
                        <p className="text-xs text-slate-600 mt-1">
                          Use this sales code alongside your {inputType} on the vendor&apos;s activation website to generate your permanent licence key.
                        </p>
                      </div>

                      {/* Sales code display box with Copy */}
                      <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#cbdcd9]">
                        <span className="font-mono text-base font-black text-[#014040] tracking-wider">
                          {order.salesCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`sc-${order.orderId}`, order.salesCode!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#edf5f3] hover:bg-[#dcefe9] text-xs font-bold text-[#014040] transition-colors cursor-pointer"
                        >
                          {copiedKeys[`sc-${order.orderId}`] ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Code</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Link to activation website */}
                      {order.activationWebsiteUrl && (
                        <div>
                          <a
                            href={order.activationWebsiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#014040] hover:bg-[#025656] text-white font-bold text-xs transition-colors shadow-2xs"
                          >
                            <span>Open the activation website</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}

                      {/* Field to save the licence returned by the vendor */}
                      {!order.activationCodeOrKey && (
                        <div className="pt-3 border-t border-[#d8e7e4] space-y-2">
                          <label className="block text-xs font-bold text-[#014040]">
                            Paste the licence key returned by the activation website:
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={returnedLicenceValues[order.orderId] || ''}
                              onChange={(e) =>
                                setReturnedLicenceValues((prev) => ({
                                  ...prev,
                                  [order.orderId]: e.target.value
                                }))
                              }
                              placeholder="e.g. 4A29-881F-E902-771B-943C"
                              className="flex-1 px-3 py-2 bg-white border border-[#cbdcd9] rounded-xl text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveLicenceCode(order)}
                              className="px-4 py-2 bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-xs rounded-xl transition-colors cursor-pointer"
                            >
                              Save my licence code
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STATE 4: READY (Section 4 & 7) -> Licence code with Copy button and Resource Links */}
                  {order.fulfilmentStatus === 'ready' && order.activationCodeOrKey && (
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl bg-[#014040] text-white space-y-2 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/70 font-semibold uppercase tracking-wider">
                            Licence / Activation Code
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(`lic-${order.orderId}`, order.activationCodeOrKey!)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            {copiedKeys[`lic-${order.orderId}`] ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#05ef28]" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Licence</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="font-mono text-lg sm:text-xl font-black text-[#05ef28] break-all tracking-wider pt-1">
                          {order.activationCodeOrKey}
                        </div>
                      </div>

                      {/* Resource links (Section 9.7 verbatim) */}
                      <div className="p-4 bg-[#f8fbfa] rounded-2xl border border-[#d8e7e4] space-y-2">
                        <span className="text-xs font-bold text-[#014040] uppercase tracking-wider block">
                          Resource Links
                        </span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {order.macViaParallels ? (
                            <>
                              <a
                                href={order.windowsInstallerUrl || '#'}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#cbdcd9] text-xs font-bold text-[#014040] hover:bg-[#edf5f3] shadow-2xs"
                              >
                                <Download className="w-3.5 h-3.5 text-[#014040]" />
                                <span>Download Parallels Desktop Software</span>
                              </a>
                              <a
                                href="#"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#cbdcd9] text-xs font-bold text-[#014040] hover:bg-[#edf5f3] shadow-2xs"
                              >
                                <Download className="w-3.5 h-3.5 text-[#014040]" />
                                <span>Download Windows 11 File</span>
                              </a>
                              <a
                                href="https://download.teamviewer.com/download/TeamViewer_Setup.exe"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#cbdcd9] text-xs font-bold text-[#014040] hover:bg-[#edf5f3] shadow-2xs"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-[#014040]" />
                                <span>Download TeamViewer for Remote Setup</span>
                              </a>
                            </>
                          ) : (
                            <>
                              <a
                                href={order.windowsInstallerUrl || '#'}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#cbdcd9] text-xs font-bold text-[#014040] hover:bg-[#edf5f3] shadow-2xs"
                              >
                                <Download className="w-3.5 h-3.5 text-[#014040]" />
                                <span>Download Software</span>
                              </a>
                              <a
                                href={order.guideUrl || '#'}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#cbdcd9] text-xs font-bold text-[#014040] hover:bg-[#edf5f3] shadow-2xs"
                              >
                                <BookOpen className="w-3.5 h-3.5 text-[#014040]" />
                                <span>Installation / Activation Instructions</span>
                              </a>
                              {order.learningResourcesUrl && (
                                <a
                                  href={order.learningResourcesUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#cbdcd9] text-xs font-bold text-[#014040] hover:bg-[#edf5f3] shadow-2xs"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-[#014040]" />
                                  <span>Learning Resources</span>
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Device Lock Warning (Past tense, Section 9.3) */}
                  <div className="p-4 bg-[#fffaf0] border-l-4 border-[#e0a800] rounded-r-xl text-xs text-[#8a5b00] leading-relaxed flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-[#8a5b00] shrink-0 mt-0.5" />
                    <span>{STORE_COPY.deviceLock.after}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-[#d8e7e4] shadow-xs space-y-3">
              <h3 className="text-lg font-bold text-[#014040]">
                {STORE_COPY.findOrder.emptyNotFoundTitle}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {STORE_COPY.findOrder.emptyNotFoundDesc(STORE_COPY.brand.phoneRaw)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
