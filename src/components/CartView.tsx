import React from 'react';
import { CatalogueItem, Variant, ServiceOption } from '../types';
import { ShoppingBag, Trash2, ChevronRight } from 'lucide-react';
import { OrderProgressBar } from './OrderProgressBar';
import { STORE_COPY } from '../config/storeCopy';
import { ProductImage } from './ProductImage';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { cartLineDetail } from '../utils/cartLineDetail';

export interface CartItem {
  id: string;
  product: CatalogueItem;
  variant?: Variant;
  selectedOs?: string;
  quantity: number;
  /** Set when the line is a purchasable service rather than software. */
  serviceOption?: ServiceOption;
  /** One selected variant id for every alternative group in a bundle. */
  bundleSelections?: Record<string, string>;
}

interface CartViewProps {
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onContinueShopping: () => void;
  /**
   * Opens the shared checkout form. The cart deliberately owns no form of its
   * own: "Proceed to checkout" and "Buy now" reach the same one.
   */
  onCheckout: () => void;
}

export const CartView: React.FC<CartViewProps> = ({
  items,
  onRemoveItem,
  onClearCart,
  onContinueShopping,
  onCheckout
}) => {
  const totalPesewas = items.reduce((sum, item) => {
    return sum + resolveLinePricePesewas({
      item: item.product,
      variant: item.variant,
      serviceOption: item.serviceOption,
      quantity: item.quantity
    }).totalPesewas;
  }, 0);

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
              className="px-6 py-3 rounded-xl bg-[#014040] hover:bg-[#025656] text-white font-bold text-xs sm:text-sm hk-pressable cursor-pointer"
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
              const itemPrice = resolveLinePricePesewas({
                item: item.product,
                variant: item.variant,
                serviceOption: item.serviceOption,
                quantity: item.quantity
              }).totalPesewas;
              const detail = cartLineDetail(item);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#d8e7e4] p-4 sm:p-5 flex items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="flex items-center gap-4">
                    <ProductImage name={item.product.name} itemId={item.product.itemId} imageUrl={item.product.imageUrl} kind={item.product.kind} size="sm" />
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#014040]">
                        {item.product.name}
                      </h3>
                      {detail && (
                        <div className="text-xs text-slate-600 mt-0.5">
                          <span className="font-semibold text-slate-800">{detail}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm sm:text-base font-black text-[#014040]">
                        {/* itemPrice is already the line total, quantity
                            included — multiplying again double-charged. */}
                        {formatPesewas(itemPrice)}
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
                currentStep={1}
              />
            </div>
          </div>

          {/* Checkout Summary Panel */}
          <div className="lg:col-span-4 sticky top-24 bg-white rounded-2xl border border-[#d8e7e4] p-6 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-[#014040] border-b border-[#edf4f3] pb-3">
              Summary
            </h2>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{STORE_COPY.cart.subtotal(items.length)}</span>
                <span className="font-bold text-slate-800">{formatPesewas(totalPesewas)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-[#014040] pt-2 border-t border-[#edf4f3]">
                <span>{STORE_COPY.cart.total}</span>
                <span>{formatPesewas(totalPesewas)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-3.5 px-4 bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm rounded-xl hk-pressable shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{STORE_COPY.cart.proceedToCheckout}</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>

            <p className="text-[11px] text-slate-500 text-center">
              {STORE_COPY.cart.afterPaymentNotice}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
