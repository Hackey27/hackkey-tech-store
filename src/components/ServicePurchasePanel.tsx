import React, { useState } from 'react';
import { AlertCircle, Check, ChevronDown, CreditCard, Minus, Plus, ShoppingCart } from 'lucide-react';
import { CatalogueItem, ServiceOption } from '../types';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, priceServiceLine } from '../utils/money';
import { isTurnitinAiCheck } from '../utils/turnitin';

interface ServicePurchasePanelProps {
  item: CatalogueItem;
  onAddToCart: (option: ServiceOption, quantity: number) => void;
  onBuyNow: (option: ServiceOption, quantity: number) => void;
}

/**
 * Buying a priced service: choose an option, choose a quantity, see the total.
 *
 * A service with options goes through the same cart and checkout as software.
 * Services without options never reach this panel and keep their existing
 * quote-request behaviour.
 */
export const ServicePurchasePanel: React.FC<ServicePurchasePanelProps> = ({ item, onAddToCart, onBuyNow }) => {
  const options = item.options || [];
  // The first option is the one customers actually buy, so it starts selected.
  const [selected, setSelected] = useState<ServiceOption>(options[0]);
  const minQty = item.minQty ?? 1;
  const maxQty = item.maxQty ?? 50;
  const [quantity, setQuantity] = useState<number>(minQty);
  const [showImportantInformation, setShowImportantInformation] = useState(false);

  if (!options.length || !selected) return null;

  const pricing = priceServiceLine(selected, quantity);
  const setQty = (next: number) => setQuantity(Math.min(maxQty, Math.max(minQty, next)));

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
          Choose a check
        </h4>
        <div className="space-y-2">
          {options.map((option) => {
            const isSelected = option.optionId === selected.optionId;
            const unit = priceServiceLine(option, 1);
            return (
              <button
                key={option.optionId}
                onClick={() => setSelected(option)}
                className={`w-full p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between text-left ${
                  isSelected
                    ? 'bg-[#f0f9f7] border-[#014040] shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-[#014040] bg-[#014040]' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-[#05ef28]" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#014040]">{option.name}</div>
                    {option.bulkPriceGhs != null && option.bulkFromQty != null && (
                      <div className="text-[11px] text-slate-600">
                        {formatPesewas(priceServiceLine(option, option.bulkFromQty).unitPricePesewas)}{' '}
                        each from {option.bulkFromQty}+
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-sm font-black text-[#014040] shrink-0">
                  {formatPesewas(unit.totalPesewas)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            How many?
          </h4>
          <div className="inline-flex items-center gap-1 rounded-xl border border-[#cbdcd9] bg-white p-1">
            <button
              onClick={() => setQty(quantity - 1)}
              disabled={quantity <= minQty}
              aria-label="Fewer"
              className="p-2 rounded-lg hover:bg-[#edf4f3] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5 text-[#014040]" />
            </button>
            <span className="w-10 text-center text-sm font-black text-[#014040]">{quantity}</span>
            <button
              onClick={() => setQty(quantity + 1)}
              disabled={quantity >= maxQty}
              aria-label="More"
              className="p-2 rounded-lg hover:bg-[#edf4f3] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#014040]" />
            </button>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Total</div>
          <div className="text-2xl font-black text-[#014040] leading-tight">
            {formatPesewas(pricing.totalPesewas)}
          </div>
          {pricing.bulkApplied && (
            <div className="text-[11px] text-[#047857] font-semibold flex items-center gap-1 justify-end">
              <Check className="w-3 h-3" />
              {formatPesewas(pricing.unitPricePesewas)} each
            </div>
          )}
        </div>
      </div>

      {/* Keep the two Turnitin notices together so customers see the similarity
          explanation first and the AI-only word limit immediately after it. */}
      {item.disclaimer && (
        <div className="overflow-hidden rounded-xl border border-[#fde68a] bg-[#fffbeb]">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-3.5 text-left text-xs font-black leading-relaxed text-[#78350f]"
            onClick={() => setShowImportantInformation((value) => !value)}
            aria-expanded={showImportantInformation}
            aria-controls={`important-information-${item.itemId}`}
          >
            <span className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" />
              {STORE_COPY.turnitin.importantInformation}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showImportantInformation ? 'rotate-180' : ''}`} />
          </button>
          {showImportantInformation && (
            <div id={`important-information-${item.itemId}`} className="space-y-3 border-t border-[#fde68a] px-4 py-3.5 text-xs leading-relaxed text-[#78350f]">
              <p>{item.disclaimer}</p>
              {isTurnitinAiCheck(selected.optionId) && <p>{STORE_COPY.turnitin.aiWordLimit}</p>}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onBuyNow(selected, quantity)} className="flex items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-3 py-3 text-sm font-black text-[#014040]"><CreditCard className="h-4 w-4" />Buy now</button>
        <button onClick={() => onAddToCart(selected, quantity)} className="flex items-center justify-center gap-2 rounded-xl bg-[#014040] px-3 py-3 text-sm font-black text-white"><ShoppingCart className="h-4 w-4" />Add to cart</button>
      </div>
    </div>
  );
};
