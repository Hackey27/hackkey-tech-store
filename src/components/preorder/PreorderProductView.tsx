import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { PreorderDelivery, PreorderProduct } from '../../../shared/types';
import {
  PreorderSelections,
  readableSelections,
  resolvePreorderSelection,
} from '../../../shared/preorderCombinations';
import { formatPesewas } from '../../../shared/money';
import { STORE_COPY } from '../../config/storeCopy';
import { PreorderCartAddition } from '../../utils/usePreorderCart';

interface PreorderProductViewProps {
  product: PreorderProduct;
  onBack: () => void;
  onAdd: (addition: PreorderCartAddition) => void;
}

const DELIVERY_LABELS: Record<PreorderDelivery, string> = {
  express: STORE_COPY.preorder.delivery.express,
  'two-months': STORE_COPY.preorder.delivery.twoMonths,
};

const DELIVERY_NOTES: Record<PreorderDelivery, string> = {
  express: STORE_COPY.preorder.delivery.expressNote,
  'two-months': STORE_COPY.preorder.delivery.twoMonthsNote,
};

/**
 * The pre-order product page.
 *
 * Every piece of derived state on this page — which axes to show, which
 * options to enable, which price applies, which image to show — comes out of
 * `resolvePreorderSelection`. This component chooses nothing. The server
 * recomputes a submitted order's price through that same function, so any
 * rule reimplemented here would be a rule the two sides disagree about, and
 * the disagreement would surface as a customer being charged a price they
 * never saw.
 */
export const PreorderProductView: React.FC<PreorderProductViewProps> = ({
  product,
  onBack,
  onAdd,
}) => {
  const [selections, setSelections] = useState<PreorderSelections>({});
  const [delivery, setDelivery] = useState<PreorderDelivery>(
    () => product.deliveryOptions[0] || 'express'
  );

  // Switching products through a shared link resets the page rather than
  // carrying one product's Colour over to another that happens to share it.
  useEffect(() => {
    setSelections({});
    setDelivery(product.deliveryOptions[0] || 'express');
  }, [product.productId, product.deliveryOptions]);

  const resolved = useMemo(
    () => resolvePreorderSelection(product, selections),
    [product, selections]
  );

  const pricePesewas = delivery === 'express'
    ? resolved.priceExpressPesewas
    : resolved.priceTwoMonthsPesewas;

  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [resolved.imagePath]);

  /** Tapping the chosen option again clears it, which is the only way back to
   *  "any colour" once a partial combination has been narrowed. */
  const toggleOption = (axis: string, value: string) => {
    setSelections((current) => {
      if (current[axis] === value) {
        const { [axis]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [axis]: value };
    });
  };

  const canAdd = pricePesewas !== null;

  const handleAdd = () => {
    if (!canAdd || !resolved.combination) return;
    onAdd({
      productId: product.productId,
      productName: product.name,
      combinationId: resolved.combination.combinationId,
      selectionLabel: readableSelections(resolved.combination.selections, product.variantAxes),
      delivery,
      pricePesewas,
      imageUrl: resolved.imagePath || undefined,
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="hk-pressable mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]"
      >
        <ArrowLeft className="h-4 w-4" />
        {STORE_COPY.preorder.back}
      </button>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image. Swaps as the selection narrows, via the resolver's
            most-specific image assignment. */}
        <div>
          <div className="overflow-hidden rounded-2xl border border-[#d8e7e4] bg-[#edf5f3]">
            <div className="aspect-[4/3] w-full">
              {resolved.imagePath && !imageFailed ? (
                <img
                  key={resolved.imagePath}
                  data-testid="preorder-product-image"
                  data-image-src={resolved.imagePath}
                  src={resolved.imagePath}
                  alt={product.name}
                  onError={() => setImageFailed(true)}
                  className="hk-price-change h-full w-full object-cover"
                />
              ) : (
                <div
                  data-testid="preorder-product-image"
                  className="flex h-full items-center justify-center px-6 text-center text-xl font-black text-[#014040]/40"
                >
                  {product.name}
                </div>
              )}
            </div>
          </div>

          {product.galleryImagePaths.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {product.galleryImagePaths.slice(0, 8).map((path) => (
                <div
                  key={path}
                  className="aspect-square overflow-hidden rounded-xl border border-[#d8e7e4] bg-[#edf5f3]"
                >
                  <img src={path} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Choices and price. */}
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#014040] sm:text-3xl">
            {product.name}
          </h1>
          {product.description && (
            <p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p>
          )}

          {/* Selectors, in the product's own axis order. A hidden axis keeps
              its place in that order rather than being filtered out, so the
              ones still showing do not jump sideways as choices narrow. */}
          {resolved.axes.map((axis) =>
            axis.visible ? (
              <fieldset
                key={axis.name}
                data-testid={`preorder-axis-${axis.name}`}
                className="mt-6"
              >
                <legend className="text-xs font-black uppercase tracking-wider text-[#025656]">
                  {axis.name}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {axis.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      data-testid={`preorder-option-${axis.name}-${option.value}`}
                      data-enabled={option.enabled ? 'true' : 'false'}
                      disabled={!option.enabled}
                      aria-pressed={option.selected}
                      title={option.enabled ? undefined : STORE_COPY.preorder.unavailableOption}
                      onClick={() => toggleOption(axis.name, option.value)}
                      className={`hk-pressable rounded-xl border px-3.5 py-2 text-sm font-bold ${
                        option.selected
                          ? 'border-[#014040] bg-[#014040] text-white'
                          : option.enabled
                            ? 'border-[#d0e4e0] bg-white text-[#014040] hover:bg-[#edf5f3]'
                            : // Greyed and struck through, never hidden: a
                              // customer should be able to see that Red exists
                              // and is simply not available with what they
                              // have picked so far.
                              'cursor-not-allowed border-[#e6eeec] bg-[#f4f8f7] text-slate-400 line-through'
                      }`}
                    >
                      {option.value}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null
          )}

          {product.deliveryOptions.length > 1 && (
            <fieldset className="mt-6" data-testid="preorder-delivery">
              <legend className="text-xs font-black uppercase tracking-wider text-[#025656]">
                {STORE_COPY.preorder.delivery.label}
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {product.deliveryOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    data-testid={`preorder-delivery-${option}`}
                    aria-pressed={delivery === option}
                    onClick={() => setDelivery(option)}
                    className={`hk-pressable rounded-xl border px-3.5 py-2.5 text-left ${
                      delivery === option
                        ? 'border-[#014040] bg-[#014040] text-white'
                        : 'border-[#d0e4e0] bg-white text-[#014040] hover:bg-[#edf5f3]'
                    }`}
                  >
                    <span className="block text-sm font-black">{DELIVERY_LABELS[option]}</span>
                    <span
                      className={`mt-0.5 block text-[11px] ${
                        delivery === option ? 'text-white/70' : 'text-slate-500'
                      }`}
                    >
                      {DELIVERY_NOTES[option]}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Price and the add button. */}
          <div className="mt-7 rounded-2xl border border-[#d8e7e4] bg-[#f8fbfa] p-4">
            {pricePesewas !== null ? (
              <p
                key={pricePesewas}
                data-testid="preorder-price"
                className="hk-price-change text-2xl font-black text-[#014040]"
              >
                {formatPesewas(pricePesewas)}
              </p>
            ) : (
              <p data-testid="preorder-price-pending" className="text-sm font-bold text-[#025656]">
                {resolved.missingAxes.length
                  ? STORE_COPY.preorder.choosePrompt(resolved.missingAxes)
                  : STORE_COPY.preorder.askForPrice}
              </p>
            )}

            <button
              type="button"
              id="preorder-add-btn"
              data-testid="preorder-add-btn"
              disabled={!canAdd}
              onClick={handleAdd}
              className={`hk-pressable mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ${
                canAdd
                  ? 'bg-[#05ef28] text-[#014040] hover:bg-[#04d824]'
                  : 'cursor-not-allowed bg-[#dfe9e7] text-slate-400'
              }`}
            >
              <PackagePlus className="h-4 w-4" />
              {STORE_COPY.preorder.addToCart}
            </button>
          </div>

          {product.details.length > 0 && (
            <div className="mt-7">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#025656]">
                {STORE_COPY.preorder.details}
              </h2>
              <dl className="mt-2 divide-y divide-[#edf4f3] rounded-2xl border border-[#d8e7e4] bg-white px-4">
                {product.details.map((detail) => (
                  <div key={detail.label} className="flex gap-4 py-2.5 text-sm">
                    <dt className="w-2/5 shrink-0 font-bold text-[#014040]">{detail.label}</dt>
                    <dd className="min-w-0 flex-1 text-slate-600">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
