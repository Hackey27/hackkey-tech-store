import React, { RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ShoppingBag, Trash2, X } from 'lucide-react';
import { CartItem } from './CartView';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { STORE_COPY } from '../config/storeCopy';

interface CartFlyoutProps {
  open: boolean;
  items: CartItem[];
  triggerRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
  onCheckout: () => void;
  onBrowse: () => void;
  onRemoveItem: (id: string) => void;
}

export const CartFlyout: React.FC<CartFlyoutProps> = ({
  open,
  items,
  triggerRef,
  onClose,
  onCheckout,
  onBrowse,
  onRemoveItem,
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
    window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button, a')?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])'),
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

  const totalPesewas = items.reduce(
    (sum, item) => sum + resolveLinePricePesewas({
      item: item.product,
      variant: item.variant,
      serviceOption: item.serviceOption,
      quantity: item.quantity,
    }).totalPesewas,
    0,
  );

  return createPortal(
    <>
      <button
        type="button"
        aria-label={STORE_COPY.cart.flyout.closeLabel}
        className={`hk-cart-backdrop fixed inset-0 z-[80] cursor-default bg-[#012f2e]/35 backdrop-blur-sm transition-opacity duration-[220ms] ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id="header-cart-flyout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="header-cart-flyout-title"
        aria-hidden={!open}
        className={`hk-cart-flyout fixed inset-y-0 right-0 z-[81] flex h-dvh w-full max-w-md flex-col overflow-hidden border-l border-[#cbdcd9] bg-white shadow-2xl ${
          open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-100'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e2ecea] px-4 py-3.5">
          <div>
            <h2 id="header-cart-flyout-title" className="text-base font-black text-[#014040]">{STORE_COPY.cart.title}</h2>
            <p className="text-[11px] font-medium text-slate-500">
              {items.length ? STORE_COPY.cart.flyout.lineCount(items.length) : STORE_COPY.cart.flyout.ready}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={STORE_COPY.cart.flyout.closeLabel}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#014040]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf5f3] text-[#014040]">
              <ShoppingBag className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-bold text-[#014040]">{STORE_COPY.cart.emptyTitle}</p>
            <p className="mt-1 text-xs text-slate-500">{STORE_COPY.cart.flyout.emptyDescription}</p>
            <button
              type="button"
              onClick={onBrowse}
              className="mt-5 rounded-xl bg-[#014040] px-5 py-2.5 text-xs font-black text-white hover:bg-[#025656]"
            >
              {STORE_COPY.cart.flyout.browseProducts}
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 divide-y divide-[#edf4f3] overflow-y-auto px-4">
              {items.map((item) => {
                const total = resolveLinePricePesewas({
                  item: item.product,
                  variant: item.variant,
                  serviceOption: item.serviceOption,
                  quantity: item.quantity,
                }).totalPesewas;
                const option = item.serviceOption?.name || item.variant?.versionOrPlan || item.selectedOs;
                return (
                  <div key={item.id} className="flex items-start justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#014040]">{item.product.name}</p>
                      {option && <p className="truncate text-[11px] text-slate-500">{option}</p>}
                      <p className="mt-1 text-[11px] font-semibold text-slate-600">{STORE_COPY.cart.flyout.quantity(item.quantity)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2"><p className="text-xs font-black text-[#014040]">{formatPesewas(total)}</p><button type="button" onClick={() => onRemoveItem(item.id)} aria-label={`Remove ${item.product.name} from cart`} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-[#e2ecea] bg-[#f8fbfa] p-4">
              <div className="mb-3 flex items-center justify-between text-sm font-black text-[#014040]">
                <span>{STORE_COPY.cart.total}</span>
                <span>{formatPesewas(totalPesewas)}</span>
              </div>
              <button
                type="button"
                onClick={onCheckout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-4 py-3 text-sm font-black text-[#014040] transition-colors hover:bg-[#04d824]"
              >
                {STORE_COPY.cart.proceedToCheckout} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
};
