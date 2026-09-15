import React, { useState } from 'react';
import { AlertCircle, Check, Minus, Plus } from 'lucide-react';
import { CatalogueItem, ServiceOption } from '../types';
import { formatPesewas, priceServiceLine } from '../utils/money';

interface ServicePurchasePanelProps {
  item: CatalogueItem;
  onAddToCart: (option: ServiceOption, quantity: number) => void;
}

/**
 * Buying a priced service: choose an option, choose a quantity, see the total.
 *
 * A service with options goes through the same cart and checkout as software.
 * Services without options never reach this panel and keep their existing
 * quote-request behaviour.
 */
export const ServicePurchasePanel: React.FC<ServicePurchasePanelProps> = ({ item, onAddToCart }) => {
  const options = item.options || [];
  // The first option is the one customers actually buy, so it starts selected.
  const [selected, setSelected] = useState<ServiceOption>(options[0]);
  const minQty = item.minQty ?? 1;
  const maxQty = item.maxQty ?? 50;
  const [quantity, setQuantity] = useState<number>(minQty);

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

      {/* Rendered verbatim, before purchase. It manages a real expectation gap:
          a customer whose similarity index differs from their university's
          would otherwise reasonably believe the check was wrong. */}
      {item.disclaimer && (
        <div className="flex gap-2.5 p-3.5 rounded-xl bg-[#fffbeb] border border-[#fde68a]">
          <AlertCircle className="w-4 h-4 text-[#b45309] shrink-0 mt-0.5" />
          <p className="text-xs text-[#78350f] leading-relaxed">{item.disclaimer}</p>
        </div>
      )}

      <button
        onClick={() => onAddToCart(selected, quantity)}
        className="w-full py-3 rounded-xl bg-[#014040] hover:bg-[#025656] text-white font-bold text-sm transition-colors cursor-pointer"
      >
        Add to cart — {formatPesewas(pricing.totalPesewas)}
      </button>
    </div>
  );
};
