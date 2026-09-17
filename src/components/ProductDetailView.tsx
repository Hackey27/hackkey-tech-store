import React, { useState } from 'react';
import { CatalogueItem, ServiceOption, Variant, MachineCodeType } from '../types';
import {
  X,
  CheckCircle,
  Monitor,
  Laptop,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Check
} from 'lucide-react';
import { OrderProgressBar } from './OrderProgressBar';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { ServicePurchasePanel } from './ServicePurchasePanel';

interface ProductDetailViewProps {
  product: CatalogueItem;
  onClose: () => void;
  onAddToCart?: (
    product: CatalogueItem,
    variant?: Variant,
    os?: string,
    serviceOption?: ServiceOption,
    quantity?: number
  ) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  onClose,
  onAddToCart
}) => {
  // Determine versions & selection state
  const variants = product.variants || [];
  const recommendedVariant =
    variants.find((v) => v.latest) || variants[0];
  const [selectedVariant, setSelectedVariant] = useState<Variant | undefined>(
    recommendedVariant
  );

  // OS Selection based on Section 1.3
  const availableOsList: string[] = selectedVariant
    ? selectedVariant.osList || [selectedVariant.os || 'Windows']
    : product.osList || ['Windows'];
  const hasMultipleOs = availableOsList.length > 1;
  const [selectedOs, setSelectedOs] = useState<string>(availableOsList[0] || 'Windows');

  // The one resolver, so a laptop or bundle — which has no variant — shows its
  // own price instead of falling through a dead ?? chain to zero.
  const currentPricePesewas = resolveLinePricePesewas({
    item: product,
    variant: selectedVariant,
    quantity: 1
  }).unitPesewas;

  // Active step for progress preview
  const [progressDemoStep, setProgressDemoStep] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);

  const productName = product.name || 'Software';

  const handleBuyClick = () => {
    if (onAddToCart) {
      onAddToCart(product, selectedVariant, selectedOs);
    }
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  const getProductInitial = (name: string) => {
    const parts = (name || '').trim().split(' ');
    if (parts.length > 1 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name || 'HK').slice(0, 2).toUpperCase();
  };

  const recommendedId = recommendedVariant?.variantId;
  const olderVersions = variants.filter(
    (v) => (v.variantId) !== recommendedId
  );

  // Machine code type
  const machineCodeType: MachineCodeType = product.machineCodeType || 'none';

  // A service with options is bought, not enquired about: it gets the option
  // picker, quantity selector and disclaimer instead of the version and OS
  // controls, which mean nothing for it. Services without options are
  // untouched and keep their quote-request behaviour.
  const isPurchasableService = product.kind === 'service' && (product.options?.length ?? 0) > 0;

  const handleServiceAdd = (option: ServiceOption, quantity: number) => {
    onAddToCart?.(product, undefined, undefined, option, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-[#d8e7e4] overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 bg-[#f8fbfa] border-b border-[#e2ecea] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#014040] bg-[#edf5f3] px-2.5 py-1 rounded-full border border-[#d0e4e0]">
              {product.categoryName || 'Software'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            title={STORE_COPY.product.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-5 sm:p-8 space-y-8">
          {/* Main Hero Header */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Product Image / Logo Gallery Area */}
            <div className="md:col-span-4 flex flex-col items-center">
              <div className="w-full aspect-square max-w-[240px] rounded-2xl bg-gradient-to-br from-[#edf5f3] to-[#d4e7e4] border border-[#c4ded9] flex items-center justify-center text-4xl font-black text-[#014040] shadow-sm">
                {product.categoryId === 'laptops' ? (
                  <Laptop className="w-16 h-16 text-[#014040]" />
                ) : product.categoryId === 'research-services' ? (
                  <Sparkles className="w-16 h-16 text-[#014040]" />
                ) : (
                  <span>{getProductInitial(productName)}</span>
                )}
              </div>
            </div>

            {/* Product Info & Selection Experience */}
            <div className="md:col-span-8 space-y-5">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#014040] tracking-tight">
                  {productName}
                </h1>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {isPurchasableService && (
                <ServicePurchasePanel item={product} onAddToCart={handleServiceAdd} />
              )}

              {/* OS Compatibility */}
              {!isPurchasableService && (
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  {STORE_COPY.product.chooseOperatingSystem}
                </span>
                {hasMultipleOs ? (
                  <div className="flex gap-2">
                    {availableOsList.map((os: string) => (
                      <button
                        key={os}
                        type="button"
                        onClick={() => setSelectedOs(os)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          selectedOs === os
                            ? 'bg-[#014040] text-white shadow-xs'
                            : 'bg-[#f0f5f4] text-slate-700 hover:bg-[#e2ecea]'
                        }`}
                      >
                        {os}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg bg-[#f0f5f4] text-slate-800 border border-[#d8e7e4]">
                    <Monitor className="w-3.5 h-3.5 text-[#014040]" />
                    <span>{availableOsList[0] || 'Windows'}</span>
                  </div>
                )}
              </div>
              )}

              {/* Version Selection Experience */}
              {!isPurchasableService && variants.length > 0 && (
                <div className="space-y-3">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {STORE_COPY.product.chooseVersion}
                  </span>

                  {/* Recommended Version */}
                  {recommendedVariant && (
                    <div
                      onClick={() => {
                        setSelectedVariant(recommendedVariant);
                        const osList =
                          recommendedVariant.osList || [recommendedVariant.os || 'Windows'];
                        setSelectedOs(osList[0]);
                      }}
                      className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        (selectedVariant?.variantId) ===
                        (recommendedVariant.variantId)
                          ? 'bg-[#f0f9f7] border-[#014040] shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            (selectedVariant?.variantId) ===
                            (recommendedVariant.variantId)
                              ? 'border-[#014040] bg-[#014040]'
                              : 'border-slate-300'
                          }`}
                        >
                          {(selectedVariant?.variantId) ===
                            (recommendedVariant.variantId) && (
                            <div className="w-2 h-2 rounded-full bg-[#05ef28]" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#014040]">
                              {recommendedVariant.versionOrPlan}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#05ef28] text-[#014040]">
                              {STORE_COPY.product.recommended}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-[#014040]">
                          {formatPesewas(
                            recommendedVariant.payablePricePesewas ??
                              recommendedVariant.priceGhs ??
                              0
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Other Versions if any */}
                  {olderVersions.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {olderVersions.map((variant) => {
                          const vKey = variant.variantId || 'var';
                          const isSelected =
                            (selectedVariant?.variantId) === vKey;
                          const vPrice = resolveLinePricePesewas({
                            item: product,
                            variant,
                            quantity: 1
                          }).unitPesewas;

                          return (
                            <div
                              key={vKey}
                              onClick={() => {
                                setSelectedVariant(variant);
                                const osList =
                                  variant.osList || [variant.os || 'Windows'];
                                setSelectedOs(osList[0]);
                              }}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                                isSelected
                                  ? 'bg-[#f0f9f7] border-[#014040] font-bold'
                                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span>{variant.versionOrPlan}</span>
                              <span className="font-bold text-[#014040]">
                                {formatPesewas(vPrice)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Device lock warning for licensed software (Section 9.3) */}
              {machineCodeType !== 'service' && machineCodeType !== 'none' && (
                <div className="p-3.5 bg-[#fffaf0] border-l-4 border-[#e0a800] rounded-r-xl text-xs text-[#8a5b00] leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#8a5b00] shrink-0 mt-0.5" />
                  <span>{STORE_COPY.deviceLock.before}</span>
                </div>
              )}

              {/* Price & Action Box */}
              {!isPurchasableService && (
              <div className="p-4 rounded-2xl bg-[#f7faf9] border border-[#d8e7e4] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">
                    Price
                  </span>
                  <div className="text-2xl font-black text-[#014040]">
                    {formatPesewas(currentPricePesewas)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBuyClick}
                    className="px-6 py-3 rounded-xl bg-[#05ef28] hover:bg-[#04d824] active:scale-98 text-[#014040] font-black text-sm shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>{STORE_COPY.product.buyNow}</span>
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>
              )}

              {addedNotice && (
                <div className="p-3 rounded-xl bg-[#d9ffe0] border border-[#b2f0bf] text-xs font-bold text-[#0d6520] flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-[#0d6520]" />
                  <span>{STORE_COPY.product.addedToCartTitle}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Reusable Order Progress UI Component */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#f8fbfa] border border-[#d8e7e4] space-y-3">
            <h3 className="text-sm font-bold text-[#014040]">
              Fulfilment & Delivery Workflow
            </h3>

            <OrderProgressBar
              machineCodeType={machineCodeType}
              currentStep={progressDemoStep}
              onStepClick={(step) => setProgressDemoStep(step)}
            />

            <div className="flex justify-end gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 self-center mr-2">Preview step:</span>
              {[1, 2, 3, 4, 5]
                .slice(0, machineCodeType === 'service' || machineCodeType === 'none' ? 4 : 5)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => setProgressDemoStep(s)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md cursor-pointer ${
                      progressDemoStep === s
                        ? 'bg-[#014040] text-[#05ef28]'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    Step {s}
                  </button>
                ))}
            </div>
          </div>

          {/* Product detail tabs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {product.description && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5">
                  About this product
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-5 py-4 bg-[#f8fbfa] border-t border-[#e2ecea] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            {STORE_COPY.product.close}
          </button>

          {/* A priced service is added from its own panel, which knows the
              chosen option and quantity. This button would add a line with
              neither. */}
          {!isPurchasableService && (
            <button
              type="button"
              onClick={handleBuyClick}
              className="px-6 py-2.5 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-xs sm:text-sm shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{STORE_COPY.product.buyNow}</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
