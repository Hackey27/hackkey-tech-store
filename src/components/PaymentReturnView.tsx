import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { Order } from '../types';
import { formatPesewas } from '../utils/money';
import { STORE_COPY } from '../config/storeCopy';

/**
 * Where Paystack sends the customer back to.
 *
 * Landing here is a navigation, not proof of payment — the URL can be edited —
 * so this asks the server to verify the reference and then renders whatever the
 * database says. It never reports failure just because verification has not
 * caught up: the webhook frequently lands first, and a customer told their
 * successful payment failed will pay twice.
 */
export const PaymentReturnView: React.FC<{ onDone: (order?: Order) => void }> = ({ onDone }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const reference =
    new URLSearchParams(window.location.search).get('reference') ||
    new URLSearchParams(window.location.search).get('trxref') ||
    '';

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/return?reference=${encodeURIComponent(reference)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'We could not confirm this payment.');
      setOrder(data.order);
      setConfirmed(Boolean(data.confirmed));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (reference) check();
    else {
      setChecking(false);
      setError('No payment reference was supplied.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  return (
    <div className="max-w-xl mx-auto px-4 py-10 sm:py-16">
      <div className="rounded-2xl bg-white border border-[#d8e7e4] shadow-xs p-6 sm:p-8 space-y-5">
        {checking && (
          <div className="flex items-center gap-3 text-slate-700">
            <RefreshCw className="w-5 h-5 animate-spin text-[#014040]" />
            <span className="text-sm font-semibold">Checking your payment…</span>
          </div>
        )}

        {!checking && error && (
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-lg font-black text-[#014040]">We could not confirm this yet</h1>
              <p className="text-sm text-slate-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {!checking && order && (
          <>
            <div className="flex gap-3">
              {confirmed ? (
                <CheckCircle className="w-6 h-6 text-[#0d6520] shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              )}
              <div>
                <h1 className="text-xl font-black text-[#014040]">
                  {confirmed ? 'Payment received' : "We haven't received confirmation yet"}
                </h1>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {confirmed
                    ? 'Thank you. A receipt is on its way to your email.'
                    : 'This can take a moment. Your payment may still be going through — please refresh rather than paying again.'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#f7faf9] border border-[#d8e7e4] space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Order reference
              </div>
              <div className="text-lg font-black text-[#014040]">{order.orderId}</div>
              <div className="text-sm text-slate-700 pt-1">
                {order.productName} — {order.versionOrPlan}
                {order.quantity && order.quantity > 1 ? ` ×${order.quantity}` : ''}
              </div>
              <div className="text-sm font-bold text-[#014040]">
                {formatPesewas(order.amountPesewas)}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Keep this reference — it is how we find your order. Questions:{' '}
              {STORE_COPY.brand.phone}
            </p>

            <div className="flex flex-wrap gap-3">
              {!confirmed && (
                <button
                  onClick={check}
                  className="px-4 py-2.5 rounded-xl bg-[#014040] hover:bg-[#025656] text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              )}
              <button
                onClick={() => onDone(confirmed ? order : undefined)}
                className="px-4 py-2.5 rounded-xl border border-[#cbdcd9] bg-white hover:bg-[#edf4f3] text-[#014040] text-xs font-bold transition-colors cursor-pointer"
              >
                {confirmed ? 'See next steps' : 'Back to the store'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
