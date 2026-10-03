import React, { RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Minus, PackagePlus, Plus, Trash2, X } from 'lucide-react';
import { formatPesewas } from '../../../shared/money';
import { STORE_COPY } from '../../config/storeCopy';
import { PreorderCartLine } from '../../utils/usePreorderCart';
import { PreorderDelivery } from '../../../shared/types';

interface PreorderCartFlyoutProps {
  open: boolean;
  lines: PreorderCartLine[];
  totalPesewas: number;
  triggerRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
  onBrowse: () => void;
  onRemoveLine: (id: string) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onSetDelivery: (id: string, delivery: PreorderDelivery) => void;
  onSubmitDetails: () => void;
}

/**
 * The pre-order basket panel.
 *
 * Deliberately the same panel behaviour as the software cart's `CartFlyout`:
 * portalled to the body, a backdrop that closes it, Escape to close, focus
 * moved in and trapped, body scroll locked while it is open, focus returned to
 * the button that opened it, and kept mounted for 220ms after closing so it
 * can slide out rather than vanish. Two carts that behave differently would
 * teach a customer two sets of habits for what looks like the same control.
 *
 * What differs is what is inside it: different lines, its own total, its own
 * icon, and no checkout button — submitting a pre-order is a later pass, and a
 * button that goes nowhere is worse than no button.
 */
export const PreorderCartFlyout: React.FC<PreorderCartFlyoutProps> = ({
  open,
  lines,
  totalPesewas,
  triggerRef,
  onClose,
  onBrowse,
  onRemoveLine,
  onSetQuantity,
  onSetDelivery,
  onSubmitDetails,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const timer = window.setTimeout(() => setRendered(false), 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, triggerRef]);

  if (!rendered) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label={STORE_COPY.preorder.cart.closeLabel}
        className={`hk-cart-backdrop fixed inset-0 z-[80] cursor-default bg-[#012f2e]/35 backdrop-blur-sm transition-opacity duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id="preorder-cart-flyout"
        data-testid="preorder-cart-flyout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preorder-cart-flyout-title"
        aria-hidden={!open}
        className={`hk-cart-flyout fixed inset-y-0 right-0 z-[81] flex h-dvh w-full max-w-md flex-col overflow-hidden border-l border-[#cbdcd9] bg-white shadow-2xl ${
          open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-100'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e2ecea] px-4 py-3.5">
          <div>
            <h2
              id="preorder-cart-flyout-title"
              className="text-base font-black text-[#014040]"
            >
              {STORE_COPY.preorder.cart.title}
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              {lines.length
                ? STORE_COPY.preorder.cart.lineCount(lines.length)
                : STORE_COPY.preorder.cart.empty}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={STORE_COPY.preorder.cart.closeLabel}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#014040]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf5f3] text-[#014040]">
              <PackagePlus className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-bold text-[#014040]">
              {STORE_COPY.preorder.cart.empty}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {STORE_COPY.preorder.cart.emptyDescription}
            </p>
            <button
              type="button"
              onClick={onBrowse}
              className="hk-pressable mt-5 rounded-xl bg-[#014040] px-5 py-2.5 text-xs font-black text-white hover:bg-[#025656]"
            >
              {STORE_COPY.preorder.cart.browse}
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 divide-y divide-[#edf4f3] overflow-y-auto px-4">
              {lines.map((line) => (
                <div
                  key={line.id}
                  data-testid="preorder-cart-line"
                  className="flex items-start justify-between gap-4 py-3.5"
                >
                  {/* The resolved image, so a basket of three variants of the
                      same product is tellable apart at a glance. */}
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt=""
                      data-testid="preorder-cart-line-image"
                      className="h-14 w-14 shrink-0 rounded-lg border border-[#e2ecea] object-cover"
                    />
                  ) : (
                    <span className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-[#e2ecea]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#014040]">{line.productName}</p>
                    {line.selectionLabel && (
                      <p className="truncate text-[11px] text-slate-500">{line.selectionLabel}</p>
                    )}
                    {/* Per item, not per cart: some products are Two months
                        only, so one control for the whole basket could not
                        represent what is actually orderable. */}
                    <select
                      data-testid="preorder-cart-line-delivery"
                      aria-label={STORE_COPY.preorder.delivery.label}
                      value={line.delivery}
                      onChange={(event) => onSetDelivery(line.id, event.target.value as PreorderDelivery)}
                      className="mt-1 w-full rounded-lg border border-[#d0e4e0] bg-white px-2 py-1 text-[11px] font-bold text-[#025656]"
                    >
                      {line.availableDeliveries.map((delivery) => (
                        <option
                          key={delivery}
                          value={delivery}
                          disabled={typeof line.pricesPesewas[delivery] !== 'number'}
                        >
                          {delivery === 'express'
                            ? STORE_COPY.preorder.delivery.express
                            : STORE_COPY.preorder.delivery.twoMonths}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[#d0e4e0]">
                      <button
                        type="button"
                        aria-label={STORE_COPY.preorder.cart.decrease}
                        onClick={() => onSetQuantity(line.id, line.quantity - 1)}
                        className="hk-pressable rounded-l-lg px-2 py-1 text-[#014040] hover:bg-[#edf5f3]"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-6 text-center text-xs font-black text-[#014040]">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={STORE_COPY.preorder.cart.increase}
                        onClick={() => onSetQuantity(line.id, line.quantity + 1)}
                        className="hk-pressable rounded-r-lg px-2 py-1 text-[#014040] hover:bg-[#edf5f3]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="text-xs font-black text-[#014040]">
                      {line.pricingUnavailable ? 'Price unavailable' : formatPesewas(line.pricePesewas * line.quantity)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onRemoveLine(line.id)}
                      aria-label={STORE_COPY.preorder.cart.remove(line.productName)}
                      className="hk-pressable rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#e2ecea] bg-[#f8fbfa] p-4">
              <div className="mb-1 flex items-center justify-between text-sm font-black text-[#014040]">
                <span>{STORE_COPY.preorder.cart.total}</span>
                <span data-testid="preorder-cart-total">{formatPesewas(totalPesewas)}</span>
              </div>
              <p className="mb-3 text-[11px] text-slate-500">{STORE_COPY.preorder.cart.note}</p>
              <button
                type="button"
                data-testid="preorder-submit-details"
                disabled={lines.some(line => line.pricingUnavailable)}
                onClick={onSubmitDetails}
                className="hk-pressable flex w-full items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-4 py-3 text-sm font-black text-[#014040] hover:bg-[#04d824]"
              >
                {STORE_COPY.preorder.cart.submitDetails}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onBrowse}
                className="hk-pressable mt-2 w-full rounded-xl border border-[#014040] px-4 py-2.5 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]"
              >
                {STORE_COPY.preorder.cart.continue}
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
};
