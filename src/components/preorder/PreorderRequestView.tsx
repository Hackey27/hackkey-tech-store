import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, Send, Trash2 } from 'lucide-react';
import { STORE_COPY } from '../../config/storeCopy';

interface PreorderRequestViewProps {
  /** Prefilled from the search that found nothing. */
  initialProductName?: string;
  onBack: () => void;
  onBrowse: () => void;
}

/** The spec's ceiling. The server enforces it too — this is the courtesy. */
const MAX_IMAGES = 5;

const inputClass =
  'w-full rounded-xl border border-[#d0e4e0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#014040]/10';
const labelClass = 'block space-y-1 text-xs font-bold text-[#025656]';

/**
 * "We do not have it — can you get it?"
 *
 * Offered where the customer hits the wall: a search that found nothing. The
 * product name is carried over from that search, because retyping what you
 * just typed is the fastest way to lose someone.
 *
 * A link OR a picture is required, not merely encouraged. A name alone is
 * rarely enough to source a specific item, and a request the seller cannot act
 * on wastes the customer's wait as well as the seller's time.
 */
export const PreorderRequestView: React.FC<PreorderRequestViewProps> = ({
  initialProductName = '',
  onBack,
  onBrowse,
}) => {
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    productName: initialProductName,
    link: '',
    notes: '',
  });
  const [images, setImages] = useState<Array<{ path: string; preview: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const identified = Boolean(form.link.trim()) || images.length > 0;
  const complete =
    Boolean(form.customerName.trim()) && Boolean(form.phone.trim()) && Boolean(form.productName.trim()) && identified;

  const addImages = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      const room = MAX_IMAGES - images.length;
      for (const file of Array.from(files).slice(0, room)) {
        const blob = new Blob([await file.arrayBuffer()], { type: file.type });
        const response = await fetch('/api/requests/preorder-product/images', {
          method: 'POST',
          headers: { 'Content-Type': blob.type },
          body: blob,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || STORE_COPY.preorder.request.uploadFailed);
        setImages((current) => [...current, { path: body.objectPath, preview: URL.createObjectURL(file) }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : STORE_COPY.preorder.request.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/requests/preorder-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          notes: form.notes.trim() || undefined,
          productName: form.productName.trim(),
          link: form.link.trim(),
          images: images.map((image) => image.path),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || STORE_COPY.preorder.request.failed);
      setReference(body.requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : STORE_COPY.preorder.request.failed);
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#05ef28]/15 text-[#014040]">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-2xl font-black text-[#014040]">{STORE_COPY.preorder.request.doneTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{STORE_COPY.preorder.request.doneBody}</p>
        <p data-testid="preorder-request-reference" className="mt-4 rounded-xl bg-[#edf5f3] px-4 py-2 font-mono text-sm font-black text-[#014040]">
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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="hk-pressable mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]"
      >
        <ArrowLeft className="h-4 w-4" />
        {STORE_COPY.preorder.back}
      </button>

      <h1 className="text-2xl font-black tracking-tight text-[#014040] sm:text-3xl">
        {STORE_COPY.preorder.request.title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{STORE_COPY.preorder.request.lead}</p>

      <div className="mt-6 space-y-3 rounded-2xl border border-[#d8e7e4] bg-white p-4">
        <label className={labelClass}>
          {STORE_COPY.preorder.request.productName}
          <input
            data-testid="request-field-product"
            className={inputClass}
            value={form.productName}
            onChange={(event) => setForm({ ...form, productName: event.target.value })}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            {STORE_COPY.preorder.checkout.name}
            <input
              data-testid="request-field-name"
              className={inputClass}
              value={form.customerName}
              onChange={(event) => setForm({ ...form, customerName: event.target.value })}
            />
          </label>
          <label className={labelClass}>
            {STORE_COPY.preorder.checkout.phone}
            <input
              data-testid="request-field-phone"
              className={inputClass}
              inputMode="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
        </div>

        <label className={labelClass}>
          {STORE_COPY.preorder.request.emailOptional}
          <input
            data-testid="request-field-email"
            className={inputClass}
            inputMode="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </label>

        {/* A link or a picture — the server requires one of them too. */}
        <div className="rounded-xl bg-[#f8fbfa] p-3">
          <p className="text-xs font-black text-[#014040]">{STORE_COPY.preorder.request.identifyTitle}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{STORE_COPY.preorder.request.identifyBody}</p>

          <label className={`${labelClass} mt-3`}>
            {STORE_COPY.preorder.request.link}
            <input
              data-testid="request-field-link"
              className={inputClass}
              placeholder="https://…"
              value={form.link}
              onChange={(event) => setForm({ ...form, link: event.target.value })}
            />
          </label>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold text-[#025656]">
              {STORE_COPY.preorder.request.imageCount(images.length, MAX_IMAGES)}
            </span>
            <label
              className={`hk-pressable inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 ${
                images.length >= MAX_IMAGES || uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white'
              }`}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? STORE_COPY.preorder.request.uploading : STORE_COPY.preorder.request.addImages}
              <input
                data-testid="request-images"
                type="file"
                className="sr-only"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={images.length >= MAX_IMAGES || uploading}
                onChange={(event) => {
                  if (event.target.files?.length) void addImages(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((image) => (
                <div key={image.path} data-testid="request-image" className="relative aspect-square overflow-hidden rounded-lg border border-[#d8e7e4]">
                  <img src={image.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={STORE_COPY.preorder.request.removeImage}
                    onClick={() => setImages((current) => current.filter((entry) => entry.path !== image.path))}
                    className="absolute right-1 top-1 rounded bg-white/90 p-1 text-rose-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className={labelClass}>
          {STORE_COPY.preorder.request.notes}
          <textarea
            data-testid="request-field-notes"
            className={inputClass}
            rows={3}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </label>

        {error && (
          <p role="alert" data-testid="request-error" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">
            {error}
          </p>
        )}

        <button
          type="button"
          data-testid="request-submit"
          disabled={!complete || submitting || uploading}
          onClick={() => void submit()}
          className={`hk-pressable flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ${
            complete && !submitting && !uploading
              ? 'bg-[#05ef28] text-[#014040] hover:bg-[#04d824]'
              : 'cursor-not-allowed bg-[#dfe9e7] text-slate-400'
          }`}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? STORE_COPY.preorder.request.submitting : STORE_COPY.preorder.request.submit}
        </button>
        <p className="text-[11px] leading-4 text-slate-500">{STORE_COPY.preorder.request.promise}</p>
      </div>
    </div>
  );
};
