import React, { useState } from 'react';
import { Product, ProductVariant } from '../types';
import { ShoppingBag, Trash2, ChevronRight, Check } from 'lucide-react';
import { OrderProgressBar } from './OrderProgressBar';
import { STORE_COPY } from '../config/storeCopy';

export interface CartItem {
  id: string;
  product: Product;
  variant?: ProductVariant;
  selectedOs?: string;
  quantity: number;
}

interface CartViewProps {
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onContinueShopping: () => void;
}

export const CartView: React.FC<CartViewProps> = ({
  items,
  onRemoveItem,
  onClearCart,
  onContinueShopping
}) => {
  const [showCheckout, setShowCheckout] = useState(false);
  const [cFirst, setCFirst] = useState('');
  const [cLast, setCLast] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const totalGhs = items.reduce((sum, item) => {
    const price = item.variant?.priceGhs ?? item.product.priceGhs ?? item.product.minPriceGhs ?? 0;
    return sum + price * item.quantity;
  }, 0);

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cFirst || !cLast || !cPhone || !cEmail) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOrderComplete(true);
    }, 600);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Title */}
      <div className="border-b border-[#d8e7e4] pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#014040] tracking-tight">
            {STORE_COPY.cart.title}
          </h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold transition-colors cursor-pointer"
          >
            Clear Cart
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#d8e7e4] p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#edf5f3] text-[#014040] flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8 text-[#014040]" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">{STORE_COPY.cart.emptyTitle}</h2>
          <div>
            <button
              onClick={onContinueShopping}
              className="px-6 py-3 rounded-xl bg-[#014040] hover:bg-[#025656] text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
            >
              {STORE_COPY.cart.browseSoftwareBtn}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Item List */}
          <div className="lg:col-span-8 space-y-3">
            {items.map((item) => {
              const itemPrice = item.variant?.priceGhs ?? item.product.priceGhs ?? item.product.minPriceGhs ?? 0;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#d8e7e4] p-4 sm:p-5 flex items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#edf5f3] text-[#014040] font-black flex items-center justify-center text-sm shrink-0 border border-[#cbe3dd]">
                      {item.product.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#014040]">
                        {item.product.name}
                      </h3>
                      <div className="text-xs text-slate-600 flex flex-wrap gap-2 mt-0.5">
                        {item.variant && (
                          <span className="font-semibold text-slate-800">
                            {item.variant.version}
                          </span>
                        )}
                        {item.selectedOs && (
                          <span className="text-slate-500">
                            · {item.selectedOs}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm sm:text-base font-black text-[#014040]">
                        ₵{(itemPrice * item.quantity).toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Order Progress Line */}
            <div className="bg-[#f8fbfa] rounded-2xl border border-[#d8e7e4] p-4 sm:p-5 mt-4">
              <OrderProgressBar
                machineCodeType={items[0]?.product.machineCodeType || 'none'}
                currentStep={showCheckout ? 2 : 1}
              />
            </div>
          </div>

          {/* Checkout Summary Panel */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-[#d8e7e4] p-6 shadow-xs space-y-5 sticky top-24">
            <h2 className="text-base font-bold text-[#014040] border-b border-[#edf4f3] pb-3">
              Summary
            </h2>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{STORE_COPY.cart.subtotal(items.length)}</span>
                <span className="font-bold text-slate-800">₵{totalGhs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-black text-[#014040] pt-2 border-t border-[#edf4f3]">
                <span>{STORE_COPY.cart.total}</span>
                <span>₵{totalGhs.toLocaleString()}</span>
              </div>
            </div>

            {!showCheckout ? (
              <button
                type="button"
                onClick={() => setShowCheckout(true)}
                className="w-full py-3.5 px-4 bg-[#05ef28] hover:bg-[#04d824] active:scale-98 text-[#014040] font-black text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{STORE_COPY.cart.proceedToCheckout}</span>
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </button>
            ) : !orderComplete ? (
              <form onSubmit={handleCheckoutSubmit} className="space-y-3 pt-2 border-t border-[#edf4f3]">
                <div>
                  <h3 className="text-sm font-bold text-[#014040]">
                    {STORE_COPY.cart.checkoutTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {STORE_COPY.cart.checkoutSubtitle}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#014040] mb-1">
                    {STORE_COPY.cart.firstName}
                  </label>
                  <input
                    type="text"
                    value={cFirst}
                    onChange={(e) => setCFirst(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#014040] mb-1">
                    {STORE_COPY.cart.lastName}
                  </label>
                  <input
                    type="text"
                    value={cLast}
                    onChange={(e) => setCLast(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#014040] mb-1">
                    {STORE_COPY.cart.phone}
                  </label>
                  <input
                    type="tel"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    required
                    placeholder="e.g. 0542638979"
                    className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#014040] mb-1">
                    {STORE_COPY.cart.email}
                  </label>
                  <input
                    type="email"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                  />
                </div>

                <div className="text-[11px] text-slate-500 text-center pt-1">
                  {STORE_COPY.cart.afterPaymentNotice}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-[#05ef28] hover:bg-[#04d824] active:scale-98 text-[#014040] font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : STORE_COPY.cart.submitAndPay}
                </button>
              </form>
            ) : (
              <div className="p-4 bg-[#d9ffe0] text-[#0d6520] rounded-xl text-xs space-y-2 text-center">
                <div className="flex justify-center">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div className="font-bold text-sm">Order Created</div>
                <div>Reference generated. Proceeding to payment and licence retrieval.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
