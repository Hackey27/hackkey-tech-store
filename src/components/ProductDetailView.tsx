import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertCircle, Check, ChevronRight, Monitor } from 'lucide-react';
import { CatalogueItem, MachineCodeType, ServiceOption, Variant } from '../types';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { ServicePurchasePanel } from './ServicePurchasePanel';
import { ProductGallery } from './ProductGallery';
import { ProductImage, renderableProductImageUrl } from './ProductImage';

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

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, onClose, onAddToCart }) => {
  const variants = product.variants || [];
  const [selectedVariant, setSelectedVariant] = useState<Variant>();
  const [selectedOs, setSelectedOs] = useState('');
  const [addedNotice, setAddedNotice] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const productName = product.name || STORE_COPY.product.softwareFallback;
  const recommendedId = variants.find((variant) => variant.latest)?.variantId;
  const isPurchasableService = product.kind === 'service' && (product.options?.length ?? 0) > 0;
  const machineCodeType: MachineCodeType = product.machineCodeType || 'none';

  const availableOsList = useMemo(() => {
    if (selectedVariant) return selectedVariant.osList || [selectedVariant.os || 'Windows'];
    return product.osList || [];
  }, [product.osList, selectedVariant]);

  useEffect(() => {
    setSelectedVariant(undefined);
    setSelectedOs('');
    setBannerFailed(false);
  }, [product.itemId]);

  useEffect(() => setBannerFailed(false), [product.bannerImageUrl]);

  const price = resolveLinePricePesewas({ item: product, variant: selectedVariant, quantity: 1 }).unitPesewas;
  const listPrice = selectedVariant?.listPricePesewas ?? product.listPricePesewas;
  const promoLabel = selectedVariant?.promoLabel ?? product.promoLabel;
  const promoPercent = selectedVariant?.promoPercent ?? product.promoPercent;
  const bannerUrl = renderableProductImageUrl(product.bannerImageUrl);
  const needsVariant = variants.length > 0;
  const canBuy = !needsVariant || Boolean(selectedVariant?.available);

  const showAdded = () => {
    setAddedNotice(true);
    window.setTimeout(() => setAddedNotice(false), 2500);
  };

  const handleBuyClick = () => {
    if (!canBuy) return;
    onAddToCart?.(product, selectedVariant, selectedOs || availableOsList[0]);
    showAdded();
  };

  const handleServiceAdd = (option: ServiceOption, quantity: number) => {
    onAddToCart?.(product, undefined, undefined, option, quantity);
    showAdded();
  };

  const selectVariant = (variant: Variant) => {
    if (!variant.available) return;
    setSelectedVariant(variant);
    setSelectedOs((variant.osList || [variant.os || 'Windows'])[0] || '');
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <button type="button" onClick={onClose} className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]">
        <ArrowLeft className="h-4 w-4" />
        {STORE_COPY.product.back}
      </button>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
        <section className="relative aspect-[16/10] min-h-[330px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#025656] via-[#014040] to-[#002929] shadow-lg sm:min-h-[440px]">
          {bannerUrl && !bannerFailed && <img src={bannerUrl} alt="" width="1200" height="750" loading="eager" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={() => setBannerFailed(true)} />}
          <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#014040] via-[#014040]/80 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
            <div className="mb-4 flex items-end gap-4">
              <ProductImage name={productName} itemId={product.itemId} imageUrl={product.imageUrl} kind={product.kind} size="lg" eager />
              <div className="min-w-0">
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#d9ffe0]">{product.categoryName}</p>
                <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">{productName}</h1>
              </div>
            </div>
            <div key={`${selectedVariant?.variantId || 'from'}-${price}`} className="hk-price-change flex flex-wrap items-end gap-x-3 gap-y-1">
              {!selectedVariant && variants.length > 0 && <span className="pb-1 text-sm font-bold uppercase tracking-wider text-[#d9ffe0]">{STORE_COPY.product.fromPrefix}</span>}
              <span className="text-3xl font-black sm:text-4xl">{price > 0 ? formatPesewas(price) : STORE_COPY.product.askForPrice}</span>
              {listPrice && listPrice > price && <span className="pb-1 text-sm font-bold text-white/70 line-through">{formatPesewas(listPrice)}</span>}
              {(promoLabel || promoPercent) && <span className="mb-1 rounded-full bg-[#05ef28] px-2.5 py-1 text-xs font-black text-[#014040]">{promoLabel || STORE_COPY.product.promotion(promoPercent)}</span>}
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-[#d8e7e4] bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          {isPurchasableService ? (
            <ServicePurchasePanel item={product} onAddToCart={handleServiceAdd} />
          ) : variants.length > 0 ? (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-black text-[#014040]">{STORE_COPY.product.chooseVersion}</h2>
                <p className="mt-1 text-xs text-slate-500">{STORE_COPY.product.selectVersion}</p>
              </div>
              <div className="space-y-2">
                {variants.map((variant) => {
                  const selected = selectedVariant?.variantId === variant.variantId;
                  const variantPrice = resolveLinePricePesewas({ item: product, variant, quantity: 1 }).unitPesewas;
                  return (
                    <button
                      key={variant.variantId}
                      type="button"
                      disabled={!variant.available}
                      onClick={() => selectVariant(variant)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition-colors motion-reduce:transition-none ${selected ? 'border-[#014040] bg-[#f0f9f7]' : variant.available ? 'border-slate-200 hover:border-[#7aa39b]' : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="flex flex-wrap items-center gap-2 text-sm font-black text-[#014040]">
                            {variant.versionOrPlan}
                            {variant.variantId === recommendedId && <span className="rounded-full bg-[#05ef28] px-2 py-0.5 text-[10px] uppercase tracking-wider">{STORE_COPY.product.recommended}</span>}
                          </span>
                          {!variant.available && <span className="mt-1 block text-xs font-bold text-slate-500">{STORE_COPY.product.unavailable}</span>}
                          {selected && <span className="mt-1 block text-xs font-bold text-[#025656]">{STORE_COPY.product.selected}</span>}
                        </span>
                        <span className="text-sm font-black text-[#014040]">{formatPesewas(variantPrice)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedVariant && availableOsList.length > 0 && (
                <div className="mt-5 border-t border-[#e2ecea] pt-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">{STORE_COPY.product.chooseOperatingSystem}</p>
                  <div className="flex flex-wrap gap-2">
                    {availableOsList.map((os) => (
                      <button key={os} type="button" onClick={() => setSelectedOs(os)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${selectedOs === os ? 'bg-[#014040] text-white' : 'bg-[#edf5f3] text-[#014040]'}`}>
                        <Monitor className="h-3.5 w-3.5" />{os}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" disabled={!selectedVariant} onClick={handleBuyClick} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-5 py-3.5 text-sm font-black text-[#014040] shadow-xs hover:bg-[#04d824] disabled:cursor-not-allowed disabled:opacity-50">
                {STORE_COPY.product.addToCart}<ChevronRight className="h-4 w-4 stroke-[3]" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {availableOsList.length > 0 && <p className="inline-flex items-center gap-2 rounded-xl bg-[#edf5f3] px-3 py-2 text-xs font-bold text-[#014040]"><Monitor className="h-4 w-4" />{availableOsList.join(' · ')}</p>}
              <button type="button" onClick={handleBuyClick} disabled={price <= 0} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-5 py-3.5 text-sm font-black text-[#014040] hover:bg-[#04d824] disabled:cursor-not-allowed disabled:opacity-50">
                {price > 0 ? STORE_COPY.product.addToCart : STORE_COPY.product.askForPrice}<ChevronRight className="h-4 w-4 stroke-[3]" />
              </button>
            </div>
          )}

          {addedNotice && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-[#b2f0bf] bg-[#d9ffe0] p-3 text-xs font-bold text-[#0d6520]"><Check className="h-4 w-4" />{STORE_COPY.product.addedToCartTitle}</p>}
        </aside>
      </div>

      <div className="mt-8 space-y-10">
        {product.description && (
          <section className="max-w-3xl">
            <h2 className="text-xl font-black text-[#014040]">{STORE_COPY.product.about}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">{product.description}</p>
          </section>
        )}

        {machineCodeType !== 'service' && machineCodeType !== 'none' && (
          <div className="flex max-w-3xl items-start gap-2 rounded-2xl border-l-4 border-[#e0a800] bg-[#fffaf0] p-4 text-xs leading-relaxed text-[#8a5b00]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{STORE_COPY.deviceLock.before}</span>
          </div>
        )}

        <ProductGallery images={product.screenshots || []} productName={productName} />
      </div>
    </div>
  );
};
