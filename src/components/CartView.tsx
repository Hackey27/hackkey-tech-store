import React, { useState } from 'react';
import { CatalogueItem, Variant, ServiceOption } from '../types';
import { ShoppingBag, Trash2, ChevronRight, Check } from 'lucide-react';
import { OrderProgressBar } from './OrderProgressBar';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, priceServiceLine } from '../utils/money';

export interface CartItem {
  id: string;
  product: CatalogueItem;
  variant?: Variant;
  selectedOs?: string;
  quantity: number;
  /** Set when the line is a purchasable service rather than software. */
  serviceOption?: ServiceOption;
}

interface CartViewProps {
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onContinueShopping: () => void;
  onNavigateToFindOrder?: () => void;
}

export const CartView: React.FC<CartViewProps> = ({
  items,
  onRemoveItem,
  onClearCart,
  onContinueShopping,
  onNavigateToFindOrder
}) => {
  const [showCheckout, setShowCheckout] = useState(false);
  const [cFirst, setCFirst] = useState('');
  const [cLast, setCLast] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  const totalGhs = items.reduce((sum, item) => {
    const price = item.variant?.priceGhs ?? item.product.priceGhs ?? 0;
    return sum + price * item.quantity;
  }, 0);

  const [createdOrderIds, setCreatedOrderIds] = useState<string[]>([]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cFirst || !cLast || !cPhone || !cEmail) return;

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: `${cFirst.trim()} ${cLast.trim()}`,
          phone: cPhone.trim(),
          email: cEmail.trim(),
          items: items.map((item) => {
            const pName = item.product.name || 'Software';
            const pId = item.product.itemId;
            const vPlan = item.variant?.versionOrPlan || 'Standard';
            const price = item.serviceOption
              ? priceServiceLine(item.serviceOption, item.quantity).totalPesewas / 100
              : item.variant?.payablePriceGhs ?? item.variant?.priceGhs ?? item.product.priceGhs ?? 0;
            const inputType =
              item.product.machineCodeType === 'lock-code'
                ? 'Lock Code'
                : item.product.machineCodeType === 'hardware-id'
                  ? 'Hardware ID'
                  : undefined;
            const isParallels =
              Boolean(item.variant?.macViaParallels) ||
              (item.selectedOs?.toLowerCase().includes('mac') &&
                (item.variant?.os === 'Windows' || item.product.osList?.join(", ") === 'Windows'));

            // A service line is resolved from its service and option; the
            // server prices it again rather than trusting the browser.
            if (item.serviceOption) {
              return {
                serviceId: item.product.itemId,
                optionId: item.serviceOption.optionId,
                quantity: item.quantity,
                productName: pName,
                versionOrPlan: item.serviceOption.name,
                amountGhs: price
              };
            }

            return {
              // The server resolves the order from the variant, so this is the
              // field checkout actually depends on.
              variantId: item.variant?.variantId || item.product.variants?.[0]?.variantId,
              productId: pId,
              productName: pName,
              versionOrPlan: vPlan,
              deliveryOs: item.selectedOs || item.variant?.os || item.product.osList?.join(", ") || 'Windows',
              amountGhs: price,
              quantity: item.quantity,
              customerInputType: inputType,
              installerUrl: item.variant?.windowsInstallerUrl || item.product.variants?.[0]?.windowsInstallerUrl,
              guideUrl: item.variant?.guideUrl || item.product.variants?.[0]?.guideUrl,
              learningUrl: item.variant?.learningResourcesUrl || item.product.variants?.[0]?.learningResourcesUrl,
              isParallels
            };
          })
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }

      setCreatedOrderIds(data.orders?.map((o: any) => o.orderId) || []);
      setOrderComplete(true);
      onClearCart();
    } catch (err: any) {
      setCheckoutError(err.message || 'Error processing checkout');
    } finally {
      setIsSubmitting(false);
    }
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
              const itemPrice = item.variant?.priceGhs ?? item.product.priceGhs ?? 0;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#d8e7e4] p-4 sm:p-5 flex items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#edf5f3] text-[#014040] font-black flex items-center justify-center text-sm shrink-0 border border-[#cbe3dd]">
                      {(item.product.name || 'SW').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#014040]">
                        {item.product.name}
                      </h3>
                      <div className="text-xs text-slate-600 flex flex-wrap gap-2 mt-0.5">
                        {item.variant && (
                          <span className="font-semibold text-slate-800">
                            {item.variant.versionOrPlan}
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

                {checkoutError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                    {checkoutError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-[#05ef28] hover:bg-[#04d824] active:scale-98 text-[#014040] font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : STORE_COPY.cart.submitAndPay}
                </button>
              </form>
            ) : (
              <div className="p-5 bg-[#d9ffe0] text-[#0d6520] rounded-2xl text-xs space-y-3 text-center border border-[#b2f0bf]">
                <div className="w-10 h-10 bg-[#0d6520] text-[#05ef28] rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div className="font-black text-base text-[#014040]">Order Placed Successfully!</div>
                <p className="text-slate-700">
                  Your order has been registered. You can track progress, make payment, and retrieve your licence key anytime using your phone number <strong>{cPhone}</strong>.
                </p>
                {createdOrderIds.length > 0 && (
                  <div className="font-mono text-xs font-bold text-[#014040] bg-white/70 py-1.5 px-3 rounded-lg">
                    Order Ref: {createdOrderIds.join(', ')}
                  </div>
                )}
                {onNavigateToFindOrder && (
                  <button
                    type="button"
                    onClick={onNavigateToFindOrder}
                    className="w-full py-2.5 px-4 bg-[#014040] hover:bg-[#025656] text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    Track in Find My Order
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
