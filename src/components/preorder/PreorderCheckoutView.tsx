import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, PackageCheck } from 'lucide-react';
import { PreorderDelivery } from '../../../shared/types';
import { formatPesewas } from '../../../shared/money';
import { STORE_COPY } from '../../config/storeCopy';
import { PreorderCartLine } from '../../utils/usePreorderCart';

interface PreorderCheckoutViewProps {
  lines: PreorderCartLine[];
  onBack: () => void;
  /** Clears the basket once the order is safely recorded. */
  onSubmitted: () => void;
  onBrowse: () => void;
}

interface DetailsForm {
  name: string;
  phone: string;
  email: string;
  location: string;
}

const inputClass =
  'w-full rounded-xl border border-[#d0e4e0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#014040]/10';
const labelClass = 'block space-y-1 text-xs font-bold text-[#025656]';

const DELIVERY_ORDER: PreorderDelivery[] = ['express', 'two-months'];

/**
 * The pre-order checkout.
 *
 * GROUPED BY DELIVERY SPEED, not by product. A basket can hold things arriving
 * in weeks and things arriving in two months, and the one thing a customer most
 * needs to see before committing is which is which. Grouping by product would
 * bury that in a column.
 *
 * Nothing here computes a total the server will rely on. The figures shown are
 * the prices the customer already agreed to in the cart; the server reprices
 * every line from the stored combination when it writes the order.
 */
export const PreorderCheckoutView: React.FC<PreorderCheckoutViewProps> = ({
  lines,
  onBack,
  onSubmitted,
  onBrowse,
}) => {
  const [form, setForm] = useState<DetailsForm>({ name: '', phone: '', email: '', location: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      DELIVERY_ORDER.map((delivery) => ({
        delivery,
        rows: lines.filter((line) => line.delivery === delivery),
      })).filter((group) => group.rows.length > 0),
    [lines]
  );

  const totalPesewas = lines.reduce((sum, line) => sum + line.pricePesewas * line.quantity, 0);
  const complete = Object.values(form).every((value) => value.trim().length > 0);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/preorder/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            location: form.location.trim(),
          },
          // What was chosen, never what it costs.
          items: lines.map((line) => ({
            productId: line.productId,
            combinationId: line.combinationId,
            delivery: line.delivery,
            quantity: line.quantity,
          })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || STORE_COPY.preorder.checkout.failed);
      setReference(body.preorderId);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : STORE_COPY.preorder.checkout.failed);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- acknowledgement ---------- */
  if (reference) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#05ef28]/15 text-[#014040]">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-2xl font-black text-[#014040]">
          {STORE_COPY.preorder.checkout.doneTitle}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {STORE_COPY.preorder.checkout.doneBody}
        </p>
        <p
          data-testid="preorder-reference"
          className="mt-4 rounded-xl bg-[#edf5f3] px-4 py-2 font-mono text-sm font-black text-[#014040]"
        >
          {reference}
        </p>
        <button
          type="button"
          onClick={onBrowse}
          className="hk-pressable mt-6 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white"
        >
          {STORE_COPY.preorder.cart.browse}
        </button>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center">
        <p className="text-sm font-bold text-[#014040]">{STORE_COPY.preorder.cart.empty}</p>
        <button
          type="button"
          onClick={onBrowse}
          className="hk-pressable mt-5 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white"
        >
          {STORE_COPY.preorder.cart.browse}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="hk-pressable mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]"
      >
        <ArrowLeft className="h-4 w-4" />
        {STORE_COPY.preorder.back}
      </button>

      <h1 className="text-2xl font-black tracking-tight text-[#014040] sm:text-3xl">
        {STORE_COPY.preorder.checkout.title}
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Summary, grouped by when it arrives. */}
        <section className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.delivery}
              data-testid={`preorder-summary-${group.delivery}`}
              className="overflow-hidden rounded-2xl border border-[#d8e7e4] bg-white"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[#e2ecea] bg-[#f8fbfa] px-4 py-3">
                <h2 className="text-sm font-black text-[#014040]">
                  {group.delivery === 'express'
                    ? STORE_COPY.preorder.delivery.express
                    : STORE_COPY.preorder.delivery.twoMonths}
                </h2>
                <span className="text-[11px] font-bold text-[#025656]">
                  {group.delivery === 'express'
                    ? STORE_COPY.preorder.checkout.expressWhen
                    : STORE_COPY.preorder.checkout.twoMonthsWhen}
                </span>
              </div>
              <div className="divide-y divide-[#edf4f3]">
                {group.rows.map((line) => (
                  <div key={line.id} className="flex items-start gap-3 px-4 py-3">
                    {line.imageUrl && (
                      <img src={line.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-[#e2ecea] object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#014040]">{line.productName}</p>
                      {line.selectionLabel && (
                        <p className="truncate text-[11px] text-slate-500">{line.selectionLabel}</p>
                      )}
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                        {STORE_COPY.preorder.cart.quantity}: {line.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-black text-[#014040]">
                      {formatPesewas(line.pricePesewas * line.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Details. */}
        <section className="space-y-3 rounded-2xl border border-[#d8e7e4] bg-white p-4 lg:sticky lg:top-5 lg:self-start">
          <h2 className="text-sm font-black text-[#014040]">
            {STORE_COPY.preorder.checkout.detailsTitle}
          </h2>

          <label className={labelClass}>
            {STORE_COPY.preorder.checkout.name}
            <input
              data-testid="preorder-field-name"
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className={labelClass}>
            {STORE_COPY.preorder.checkout.phone}
            <input
              data-testid="preorder-field-phone"
              className={inputClass}
              inputMode="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
          <label className={labelClass}>
            {STORE_COPY.preorder.checkout.email}
            <input
              data-testid="preorder-field-email"
              className={inputClass}
              inputMode="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label className={labelClass}>
            {STORE_COPY.preorder.checkout.location}
            <input
              data-testid="preorder-field-location"
              className={inputClass}
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
            />
          </label>

          <div className="flex items-center justify-between border-t border-[#e2ecea] pt-3 text-sm font-black text-[#014040]">
            <span>{STORE_COPY.preorder.cart.total}</span>
            <span data-testid="preorder-checkout-total">{formatPesewas(totalPesewas)}</span>
          </div>

          {error && (
            <p role="alert" data-testid="preorder-checkout-error" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">
              {error}
            </p>
          )}

          <button
            type="button"
            data-testid="preorder-submit"
            disabled={!complete || submitting}
            onClick={() => void submit()}
            className={`hk-pressable flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ${
              complete && !submitting
                ? 'bg-[#05ef28] text-[#014040] hover:bg-[#04d824]'
                : 'cursor-not-allowed bg-[#dfe9e7] text-slate-400'
            }`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            {submitting ? STORE_COPY.preorder.checkout.submitting : STORE_COPY.preorder.checkout.submit}
          </button>
          <p className="text-[11px] leading-4 text-slate-500">
            {STORE_COPY.preorder.checkout.note}
          </p>
        </section>
      </div>
    </div>
  );
};
