import React, { useState } from 'react';
import { Phone, CheckCircle2, AlertCircle, Key, ShieldCheck, Copy, Check } from 'lucide-react';
import { OrderProgressBar } from './OrderProgressBar';
import { MachineCodeType } from '../types';
import { STORE_COPY } from '../config/storeCopy';

interface SimulatedOrder {
  orderId: string;
  phone: string;
  customerName: string;
  productName: string;
  variantName: string;
  categoryName: string;
  date: string;
  amountGhs: number;
  status: 'payment_received' | 'awaiting_machine_code' | 'completed';
  machineCodeType: MachineCodeType;
  currentStep: number;
  lockCodeOrHardwareId?: string;
  licenseDetails?: string;
}

export const FindOrderView: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeOrder, setActiveOrder] = useState<SimulatedOrder | null>(null);
  const [submittedCode, setSubmittedCode] = useState('');
  const [codeSubmissionSuccess, setCodeSubmissionSuccess] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  // Lookup handler
  const handleFindOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setIsSearching(true);
    setHasSearched(false);
    setCodeSubmissionSuccess(false);

    setTimeout(() => {
      setIsSearching(false);
      setHasSearched(true);

      const cleanPhone = phoneNumber.replace(/\s+/g, '');

      if (cleanPhone.length >= 7) {
        const isLockCodeDemo = cleanPhone.endsWith('2') || cleanPhone.endsWith('4') || cleanPhone.endsWith('8') || cleanPhone.includes('54');
        const isHardwareIdDemo = cleanPhone.endsWith('1') || cleanPhone.endsWith('3') || cleanPhone.endsWith('7');

        if (isLockCodeDemo) {
          setActiveOrder({
            orderId: `HK-${Math.floor(100000 + Math.random() * 900000)}`,
            phone: phoneNumber,
            customerName: 'Customer',
            productName: 'IBM SPSS Statistics',
            variantName: 'v29.0 - Windows',
            categoryName: 'Statistical & Data-Analysis Software',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            amountGhs: 240,
            status: 'awaiting_machine_code',
            machineCodeType: 'lock-code',
            currentStep: 4, // Step 4: Submit Lock Code
          });
        } else if (isHardwareIdDemo) {
          setActiveOrder({
            orderId: `HK-${Math.floor(100000 + Math.random() * 900000)}`,
            phone: phoneNumber,
            customerName: 'Customer',
            productName: 'MAXQDA Pro',
            variantName: '2024 Edition - Mac',
            categoryName: 'Statistical & Data-Analysis Software',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            amountGhs: 290,
            status: 'awaiting_machine_code',
            machineCodeType: 'hardware-id',
            currentStep: 4, // Step 4: Submit Hardware ID
          });
        } else {
          setActiveOrder({
            orderId: `HK-${Math.floor(100000 + Math.random() * 900000)}`,
            phone: phoneNumber,
            customerName: 'Customer',
            productName: 'Turnitin Originality Report',
            variantName: 'Single Document Check',
            categoryName: 'Research Services',
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            amountGhs: 35,
            status: 'completed',
            machineCodeType: 'service',
            currentStep: 4,
            licenseDetails: 'Report sent directly via WhatsApp to your phone.'
          });
        }
      } else {
        setActiveOrder(null);
      }
    }, 400);
  };

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedCode.trim() || !activeOrder) return;

    setCodeSubmissionSuccess(true);
    setActiveOrder({
      ...activeOrder,
      currentStep: 5,
      status: 'completed',
      lockCodeOrHardwareId: submittedCode,
      licenseDetails: '4A29-881F-E902-771B-943C'
    });
  };

  const handleCopyOrderId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Simple Initial View Heading & Instructions */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#edf5f3] text-[#014040] flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Phone className="w-6 h-6 text-[#014040]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#014040] tracking-tight">
          {STORE_COPY.findOrder.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 font-medium mt-1.5 max-w-md mx-auto">
          {STORE_COPY.findOrder.subtitle}
        </p>
      </div>

      {/* Lookup Card */}
      <div className="bg-white rounded-2xl border border-[#d8e7e4] p-6 sm:p-8 shadow-xs mb-8">
        <form onSubmit={handleFindOrder} className="space-y-4">
          <div>
            <label
              htmlFor="order-phone-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
            >
              {STORE_COPY.findOrder.phoneLabel}
            </label>
            <div className="relative">
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
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="w-full py-3.5 px-4 bg-[#05ef28] hover:bg-[#04d824] active:scale-98 text-[#014040] font-black text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSearching ? STORE_COPY.findOrder.searching : STORE_COPY.findOrder.submitButton}
          </button>
        </form>
      </div>

      {/* Lookup Results */}
      {hasSearched && (
        <div className="space-y-6">
          {activeOrder ? (
            <div className="bg-white rounded-2xl border border-[#d8e7e4] p-6 sm:p-8 shadow-sm space-y-6">
              {/* Customer Greeting */}
              <div className="border-b border-[#edf4f3] pb-4">
                <h2 className="text-xl font-black text-[#014040]">
                  {STORE_COPY.findOrder.resultsGreeting(activeOrder.customerName)}
                </h2>
                <p className="text-xs text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
                  {STORE_COPY.findOrder.resultsSub}
                </p>
              </div>

              {/* Order Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-[#014040]">
                    {activeOrder.productName} {activeOrder.variantName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>Order {activeOrder.orderId}</span>
                    <span>•</span>
                    <span>{activeOrder.date}</span>
                    <button
                      onClick={() => handleCopyOrderId(activeOrder.orderId)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#014040] hover:underline ml-1 cursor-pointer"
                    >
                      {copiedOrderId ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedOrderId ? 'Copied' : 'Copy ID'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 block">Total Paid</span>
                  <span className="text-base font-black text-[#014040]">
                    ₵{activeOrder.amountGhs.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Persistent 5-step or 4-step progress bar matching exact terminology */}
              <div className="pt-2">
                <OrderProgressBar
                  machineCodeType={activeOrder.machineCodeType}
                  currentStep={activeOrder.currentStep}
                />
              </div>

              {/* Conditional Reveal Step 4: Submit Hardware ID / Lock Code */}
              {activeOrder.status === 'awaiting_machine_code' && !codeSubmissionSuccess && (
                <div className="p-5 sm:p-6 rounded-2xl bg-[#fbfdfc] border-2 border-[#014040] space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-[#014040]">
                      {activeOrder.machineCodeType === 'hardware-id'
                        ? STORE_COPY.findOrder.hardwareId.title
                        : STORE_COPY.findOrder.lockCode.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {activeOrder.machineCodeType === 'hardware-id'
                        ? STORE_COPY.findOrder.hardwareId.instruction
                        : STORE_COPY.findOrder.lockCode.instruction}
                    </p>
                  </div>

                  <form onSubmit={handleSubmitCode} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={submittedCode}
                        onChange={(e) => setSubmittedCode(e.target.value)}
                        placeholder={
                          activeOrder.machineCodeType === 'hardware-id'
                            ? STORE_COPY.findOrder.hardwareId.placeholder
                            : STORE_COPY.findOrder.lockCode.placeholder
                        }
                        required
                        className="w-full font-mono text-sm px-4 py-3 bg-white border border-[#cbdcd9] rounded-xl text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#05ef28]/40 uppercase tracking-wider"
                      />
                    </div>

                    <div className="text-xs text-slate-500">
                      {STORE_COPY.findOrder.inputHelper(
                        activeOrder.machineCodeType === 'hardware-id' ? 'Hardware ID' : 'Lock Code'
                      )}
                    </div>

                    {/* Exact Warning */}
                    <div className="p-3 bg-[#fffaf0] border-l-4 border-[#e0a800] rounded-r-xl text-xs text-[#8a5b00]">
                      {STORE_COPY.findOrder.inputWarn}
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 px-4 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
                    >
                      {activeOrder.machineCodeType === 'hardware-id'
                        ? STORE_COPY.findOrder.hardwareId.button
                        : STORE_COPY.findOrder.lockCode.button}
                    </button>
                  </form>
                </div>
              )}

              {/* Already Submitted Status Block */}
              {activeOrder.lockCodeOrHardwareId && (
                <div className="p-4 bg-[#edf5f3] rounded-xl border border-[#cbe3dd] space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {STORE_COPY.findOrder.submittedStatus(
                      activeOrder.machineCodeType === 'hardware-id' ? 'Hardware ID' : 'Lock Code'
                    )}
                  </span>
                  <div className="font-mono font-bold text-sm text-[#014040] break-all">
                    {activeOrder.lockCodeOrHardwareId}
                  </div>
                  <p className="text-xs text-slate-500 pt-1">
                    {STORE_COPY.findOrder.receivedWaiting}
                  </p>
                </div>
              )}

              {/* Licence / Delivery Box */}
              {activeOrder.licenseDetails && (
                <div className="p-5 rounded-xl bg-[#014040] text-white space-y-2 shadow-xs">
                  <span className="text-xs text-white/70 font-semibold block">
                    Licence / activation code
                  </span>
                  <div className="font-mono text-lg font-black text-[#05ef28] break-all tracking-wider">
                    {activeOrder.licenseDetails}
                  </div>
                </div>
              )}

              {/* Device lock disclaimer (Past Tense) */}
              <div className="p-4 bg-[#fffaf0] border-l-4 border-[#e0a800] rounded-r-xl text-xs text-[#8a5b00] leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-[#8a5b00] shrink-0 mt-0.5" />
                <span>{STORE_COPY.deviceLock.after}</span>
              </div>
            </div>
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
