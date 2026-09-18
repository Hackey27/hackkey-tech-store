import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertCircle, Check, CreditCard, Monitor, Phone, ShoppingCart } from 'lucide-react';
import { CatalogueItem, MachineCodeType, ServiceOption, Variant } from '../types';
import { STORE_COPY } from '../config/storeCopy';
import { formatPesewas, resolveLinePricePesewas } from '../utils/money';
import { ServicePurchasePanel } from './ServicePurchasePanel';
import { ProductGallery } from './ProductGallery';
import { ProductImage, renderableProductImageUrl } from './ProductImage';
import { QuoteRequestForm } from './QuoteRequestForm';
import { PromotionCountdown } from './PromotionCountdown';
import { FulfilmentTimeNotice } from './FulfilmentTimeNotice';
import { WhatsAppIcon } from './WhatsAppIcon';

interface ProductDetailViewProps {
  product: CatalogueItem;
  onClose: () => void;
  initialInterestForm?: boolean;
  onAddToCart?: (
    product: CatalogueItem,
    variant?: Variant,
    os?: string,
    serviceOption?: ServiceOption,
    quantity?: number,
    bundleSelections?: Record<string, string>
  ) => void;
  onBuyNow?: (
    product: CatalogueItem,
    variant?: Variant,
    os?: string,
    serviceOption?: ServiceOption,
    quantity?: number,
    bundleSelections?: Record<string, string>
  ) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, onClose, initialInterestForm = false, onAddToCart, onBuyNow }) => {
  const variants = product.variants || [];
  const [selectedVariant, setSelectedVariant] = useState<Variant>();
  const [selectedOs, setSelectedOs] = useState('');
  const [bundleSelections, setBundleSelections] = useState<Record<string, string>>({});
  const [addedNotice, setAddedNotice] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [showInterestForm, setShowInterestForm] = useState(initialInterestForm);
  const [galleryOpenRequest, setGalleryOpenRequest] = useState(0);
  const productName = product.name || STORE_COPY.product.softwareFallback;
  const recommendedId = variants.find((variant) => variant.latest)?.variantId;
  const latestVariant = variants.find((variant) => variant.latest && variant.available) || variants.find((variant) => variant.available);
  const isPurchasableService = product.kind === 'service' && (product.options?.length ?? 0) > 0;
  const isQuoteOnly = product.kind === 'laptop' || (product.kind === 'service' && !isPurchasableService);
  const machineCodeType: MachineCodeType = product.machineCodeType || 'none';
  const selectedMacViaParallels = /via parallels/i.test(selectedOs);
  const isParallelsProduct = /parallels/i.test(`${product.itemId} ${productName}`);

  const allOsList = useMemo(() => [...new Set(variants.flatMap((variant) => variant.osList || [variant.os || 'Windows']))], [variants]);
  const versionGroups = useMemo(() => {
    const groups = new Map<string, Variant[]>();
    variants.filter((variant) => !selectedOs || (variant.osList || [variant.os]).some((os) => os.toLowerCase() === selectedOs.toLowerCase()))
      .forEach((variant) => groups.set(variant.versionOrPlan, [...(groups.get(variant.versionOrPlan) || []), variant]));
    return [...groups.entries()];
  }, [variants, selectedOs]);
  const selectedVersion = selectedVariant?.versionOrPlan;
  const availableOsList = allOsList;
  const alternativeGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<CatalogueItem['bundleContents']>>();
    (product.bundleContents || []).forEach((entry) => {
      if (entry.altGroup) groups.set(entry.altGroup, [...(groups.get(entry.altGroup) || []), entry]);
    });
    return [...groups.entries()];
  }, [product.bundleContents]);

  useEffect(() => {
    setSelectedVariant(undefined);
    setSelectedOs(allOsList[0] || '');
    setShowInterestForm(initialInterestForm);
    const defaults: Record<string, string> = {};
    alternativeGroups.forEach(([group, choices]) => { if (choices[0]) defaults[group] = choices[0].variantId; });
    setBundleSelections(defaults);
    setBannerFailed(false);
    setGalleryOpenRequest(0);
  }, [product.itemId, alternativeGroups, allOsList, initialInterestForm]);

  useEffect(() => setBannerFailed(false), [product.bannerImageUrl]);

  const price = resolveLinePricePesewas({ item: product, variant: selectedVariant, quantity: 1 }).unitPesewas;
  const listPrice = selectedVariant?.listPricePesewas ?? product.listPricePesewas;
  const promoLabel = selectedVariant?.promoLabel ?? product.promoLabel;
  const promoPercent = selectedVariant?.promoPercent ?? product.promoPercent;
  const promoEndsAt = selectedVariant?.promoEndsAt ?? product.promoEndsAt;
  const bannerUrl = renderableProductImageUrl(product.bannerImageUrl);
  const mobileBannerUrl = renderableProductImageUrl(product.mobileBannerImageUrl);
  const laptopBannerOpensGallery = product.kind === 'laptop' && (product.screenshots?.length || 0) > 0;
  const needsVariant = variants.length > 0;
  const canBuy = !needsVariant || Boolean(selectedVariant?.available);
  const noticeEnabled = product.kind === 'service'
    ? product.showDeliveryNotice === true
    : selectedVariant?.showDeliveryNotice === true;
  const noticeKind = product.kind === 'service'
    ? 'report' as const
    : /account/i.test(selectedVariant?.fulfilmentType || '') ? 'account' as const : 'licence' as const;
  const noticeInputLabel = selectedVariant?.customerInputRequired?.trim()
    || (machineCodeType === 'lock-code' ? 'Lock Code' : machineCodeType === 'hardware-id' ? 'Hardware ID' : undefined);

  const showAdded = () => {
    setAddedNotice(true);
    window.setTimeout(() => setAddedNotice(false), 2500);
  };

  const handleAddClick = () => {
    if (!canBuy) return;
    onAddToCart?.(product, selectedVariant, selectedOs || availableOsList[0], undefined, 1, bundleSelections);
    showAdded();
  };

  const handleBuyClick = () => {
    if (!canBuy) return;
    onBuyNow?.(product, selectedVariant, selectedOs || availableOsList[0], undefined, 1, bundleSelections);
  };

  const handleServiceAdd = (option: ServiceOption, quantity: number) => {
    onAddToCart?.(product, undefined, undefined, option, quantity);
    showAdded();
  };

  const handleServiceBuy = (option: ServiceOption, quantity: number) => {
    onBuyNow?.(product, undefined, undefined, option, quantity);
  };

  const selectVariant = (variant: Variant) => {
    if (!variant.available) return;
    setSelectedVariant(variant);
  };

  const selectOs = (os: string) => {
    setSelectedOs(os);
    setSelectedVariant(undefined);
  };

  const softwareActions = <div className="grid grid-cols-2 gap-1.5 sm:gap-2"><button type="button" disabled={!selectedVariant} onClick={handleBuyClick} className="flex items-center justify-center gap-1.5 rounded-lg border border-[#05ef28] bg-[#05ef28] px-2.5 py-3 text-xs font-black text-[#014040] disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-3.5 sm:text-sm"><CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Buy now</button><button type="button" disabled={!selectedVariant} onClick={handleAddClick} className="flex items-center justify-center gap-1.5 rounded-lg border border-[#014040] bg-white px-2.5 py-3 text-xs font-black text-[#014040] disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-3.5 sm:text-sm"><ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Add to cart</button></div>;
  const aboutLabel = product.kind === 'product' ? 'About this software' : product.kind === 'laptop' ? 'About this laptop' : product.kind === 'service' ? 'About this service' : product.kind === 'bundle' ? 'About this bundle' : STORE_COPY.product.about;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <button type="button" onClick={onClose} className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#014040] hover:bg-[#edf5f3]">
        <ArrowLeft className="h-4 w-4" />
        {STORE_COPY.product.back}
      </button>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
        <section role={laptopBannerOpensGallery ? 'button' : undefined} tabIndex={laptopBannerOpensGallery ? 0 : undefined} aria-label={laptopBannerOpensGallery ? `Open image gallery for ${productName}` : undefined} onClick={laptopBannerOpensGallery ? () => setGalleryOpenRequest((value) => value + 1) : undefined} onKeyDown={laptopBannerOpensGallery ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setGalleryOpenRequest((value) => value + 1); } } : undefined} className={`relative aspect-[4/5] w-full min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-[#025656] via-[#014040] to-[#002929] shadow-lg sm:aspect-[16/10] ${laptopBannerOpensGallery ? 'cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#05ef28] focus:ring-offset-2' : ''}`}>
          {bannerUrl && !bannerFailed && <picture><source media="(max-width: 639px)" srcSet={mobileBannerUrl || bannerUrl} /><img src={bannerUrl} alt="" width="1200" height="750" loading="eager" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={() => setBannerFailed(true)} /></picture>}
          <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#014040] via-[#014040]/80 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
            <div className="mb-4 flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-4">
              <ProductImage name={productName} itemId={product.itemId} imageUrl={product.imageUrl} kind={product.kind} size="lg" eager />
              <div className="min-w-0">
                {product.kind !== 'laptop' && <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#d9ffe0]">{product.categoryName}</p>}
                <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">{productName}</h1>
              </div>
            </div>
            <div key={`${selectedVariant?.variantId || 'from'}-${price}`} className="hk-price-change flex flex-wrap items-end gap-x-3 gap-y-1">
              {!selectedVariant && variants.length > 0 && <span className="pb-1 text-sm font-bold uppercase tracking-wider text-[#d9ffe0]">{STORE_COPY.product.fromPrefix}</span>}
              <span className="text-3xl font-black sm:text-4xl">{price > 0 ? formatPesewas(price) : STORE_COPY.product.askForPrice}</span>
              {!selectedVariant && latestVariant && <span className="pb-1 text-sm font-black text-[#d9ffe0]">Latest version {latestVariant.versionOrPlan}</span>}
              {listPrice && listPrice > price && <span className="pb-1 text-sm font-bold text-white/70 line-through">{formatPesewas(listPrice)}</span>}
              {(promoLabel || promoPercent) && <span className="mb-1 rounded-full bg-[#05ef28] px-2.5 py-1 text-xs font-black text-[#014040]">{promoLabel || STORE_COPY.product.promotion(promoPercent)}</span>}
              {(promoLabel || promoPercent) && <PromotionCountdown endsAt={promoEndsAt} className="mb-1 text-xs font-bold text-[#d9ffe0]" />}
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-[#d8e7e4] bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          {isQuoteOnly ? (
            product.kind === 'laptop' && !showInterestForm
              ? <div className="grid grid-cols-[1fr_auto_auto] gap-2"><button type="button" onClick={() => setShowInterestForm(true)} className="rounded-xl bg-[#014040] px-5 py-3.5 text-sm font-black text-white">I am interested</button><a href={`tel:${STORE_COPY.brand.phoneRaw}`} className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#014040] bg-white text-[#014040]" aria-label={`Call ${STORE_COPY.brand.phone}`}><Phone className="h-5 w-5" /></a><a href={STORE_COPY.brand.whatsAppUrl} target="_blank" rel="noreferrer" className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#05ef28] text-[#014040]" aria-label={STORE_COPY.brand.whatsAppAccessibleLabel}><WhatsAppIcon className="h-5 w-5" /></a></div>
              : <QuoteRequestForm item={product} submitLabel="Submit details" />
          ) : isPurchasableService ? (
            <ServicePurchasePanel item={product} onAddToCart={handleServiceAdd} onBuyNow={handleServiceBuy} />
          ) : variants.length > 0 ? (
            <div>
              <div className="sticky top-[116px] z-20 -mx-5 mb-5 border-b border-[#d8e7e4] bg-white px-5 pb-3 pt-1 shadow-sm sm:static sm:mx-0 sm:border-0 sm:p-0 sm:shadow-none">
                {allOsList.length > 0 && <div className="mb-3 sm:mb-5"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">{STORE_COPY.product.chooseOperatingSystem}</p><div className="flex flex-wrap gap-2">{allOsList.map((os) => <button key={os} type="button" onClick={() => selectOs(os)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${selectedOs === os ? 'bg-[#014040] text-white' : 'bg-[#edf5f3] text-[#014040]'}`}><Monitor className="h-3.5 w-3.5" />{os}</button>)}</div></div>}
              </div>
              {selectedMacViaParallels && <details className="mb-5 overflow-hidden rounded-2xl border border-amber-200 bg-[#fffaf0]"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-[#014040]">Please read this before you place your order</summary><p className="border-t border-amber-200 px-4 py-3 text-xs leading-6 text-slate-700">Parallels setup requires approximately <strong>8GB of data</strong> to download the files and about <strong>50GB of free storage</strong> on your Mac. The required Parallels and Windows downloads are included with this order at no extra cost.</p></details>}
              <div className="mb-4">
                <h2 className="text-lg font-black text-[#014040]">{STORE_COPY.product.chooseVersion}</h2>
                <p className="mt-1 text-xs text-slate-500">{STORE_COPY.product.selectVersion}</p>
              </div>
              <div className="space-y-2">
                {versionGroups.map(([version, group]) => {
                  const variant = group.find((candidate) => candidate.latest) || group[0];
                  const selected = selectedVersion === version;
                  const variantPrice = resolveLinePricePesewas({ item: product, variant, quantity: 1 }).unitPesewas;
                  return (
                    <button
                      key={version}
                      type="button"
                      disabled={!variant.available}
                      onClick={() => selectVariant(variant)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition-colors motion-reduce:transition-none ${selected ? 'border-[#014040] bg-[#f0f9f7]' : variant.available ? 'border-slate-200 hover:border-[#7aa39b]' : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="flex flex-wrap items-center gap-2 text-sm font-black text-[#014040]">
                            {version}
                            {group.some((candidate) => candidate.variantId === recommendedId) && <span className="rounded-full bg-[#05ef28] px-2 py-0.5 text-[10px] uppercase tracking-wider">{STORE_COPY.product.recommended}</span>}
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

              <div className="h-[68px] sm:hidden" aria-hidden="true" />
              <div className="fixed inset-x-0 bottom-[63px] z-40 border-t border-[#d8e7e4] bg-white/95 px-4 py-2 shadow-[0_-6px_18px_rgba(1,64,64,0.10)] backdrop-blur-md sm:hidden"><div className="mx-auto max-w-lg">{softwareActions}</div></div>

              <div className="mt-5 hidden sm:block">{softwareActions}</div>
            </div>
          ) : product.kind === 'bundle' ? (
            <div className="space-y-5"><div><h2 className="text-lg font-black text-[#014040]">What is included</h2><p className="mt-1 text-xs text-slate-500">Fixed items are included automatically. Choose one option where alternatives are shown.</p></div><div className="space-y-3">{(product.bundleContents || []).filter((entry) => !entry.altGroup).map((entry) => <div key={entry.itemId} className="rounded-xl bg-[#edf5f3] p-3"><b className="text-sm text-[#014040]">{entry.productName}</b><span className="ml-2 text-xs text-slate-600">{entry.versionOrPlan}</span></div>)}{alternativeGroups.map(([group, choices]) => <fieldset key={group} className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-xs font-black uppercase tracking-wider text-slate-600">{choices[0]?.altLabel || `Choose ${group}`}</legend>{choices.map((choice) => <label key={choice.itemId} className="mt-2 flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name={group} checked={bundleSelections[group] === choice.variantId} onChange={() => setBundleSelections((old) => ({ ...old, [group]: choice.variantId }))} /><span><b>{choice.productName}</b> · {choice.versionOrPlan}</span></label>)}</fieldset>)}</div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={handleBuyClick} className="flex items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-3 py-3.5 text-sm font-black text-[#014040]"><CreditCard className="h-4 w-4" />Buy now</button><button type="button" onClick={handleAddClick} className="flex items-center justify-center gap-2 rounded-xl bg-[#014040] px-3 py-3.5 text-sm font-black text-white"><ShoppingCart className="h-4 w-4" />Add to cart</button></div></div>
          ) : (
            <div className="space-y-5">
              {availableOsList.length > 0 && <p className="inline-flex items-center gap-2 rounded-xl bg-[#edf5f3] px-3 py-2 text-xs font-bold text-[#014040]"><Monitor className="h-4 w-4" />{availableOsList.join(' · ')}</p>}
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={handleBuyClick} disabled={price <= 0} className="flex items-center justify-center gap-2 rounded-xl bg-[#05ef28] px-3 py-3.5 text-sm font-black text-[#014040] disabled:opacity-50"><CreditCard className="h-4 w-4" />Buy now</button><button type="button" onClick={handleAddClick} disabled={price <= 0} className="flex items-center justify-center gap-2 rounded-xl bg-[#014040] px-3 py-3.5 text-sm font-black text-white disabled:opacity-50"><ShoppingCart className="h-4 w-4" />Add to cart</button></div>
            </div>
          )}

          {addedNotice && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-[#b2f0bf] bg-[#d9ffe0] p-3 text-xs font-bold text-[#0d6520]"><Check className="h-4 w-4" />{STORE_COPY.product.addedToCartTitle}</p>}
          {noticeEnabled && <div className="mt-4"><FulfilmentTimeNotice kind={noticeKind} beforePayment customerInputLabel={noticeInputLabel} /></div>}
        </aside>
      </div>

      <div className="mt-8 space-y-10">
        {product.description && (
          <section className="max-w-3xl">
            <h2 className="text-xl font-black text-[#014040]">{aboutLabel}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">{product.description}</p>
          </section>
        )}

        {product.kind === 'laptop' && product.laptop && <section className="max-w-4xl"><h2 className="text-xl font-black text-[#014040]">Laptop specifications</h2><dl className="mt-4 grid gap-3 rounded-2xl border border-[#d8e7e4] bg-white p-5 sm:grid-cols-2">{[
          ['Brand', product.laptop.brand], ['Model', product.laptop.model], ['Processor', product.laptop.processor], ['RAM', product.laptop.ram], ['Storage', product.laptop.storage], ['Screen size', product.laptop.screen], ['Colour', product.laptop.colour], ['Operating system', product.laptop.operatingSystem], ['Graphics card', [product.laptop.graphics, product.laptop.graphicsDetails].filter(Boolean).join(' · ')], ['Freebies included', product.laptop.freebies], ['Availability', product.laptop.availability]
        ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd></div>)}</dl>{product.laptop.availability.toLowerCase().includes('pre') ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">This laptop will be shipped after purchase and delivered within 2 to 4 weeks after payment. Pay 70% now and the remaining 30% when it arrives.</p> : <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">This laptop is available with us and can be delivered as soon as your purchase is made.</p>}</section>}

        {product.showSingleLicenceDisclaimer === true && (
          <div className="flex max-w-3xl items-start gap-2 rounded-2xl border-l-4 border-[#e0a800] bg-[#fffaf0] p-4 text-xs leading-relaxed text-[#8a5b00]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{STORE_COPY.deviceLock.before}</span>
          </div>
        )}

        {isParallelsProduct && <section className="max-w-3xl rounded-2xl border border-amber-200 bg-[#fffaf0] p-4"><h2 className="text-base font-black text-[#014040]">Before installing Parallels</h2><p className="mt-2 text-sm leading-6 text-slate-700">You will need approximately <strong>8GB of data</strong> to download the required files and about <strong>50GB of free storage</strong> on your MacBook for the installation.</p></section>}

        <ProductGallery images={product.screenshots || []} productName={productName} kind={product.kind} openRequest={galleryOpenRequest} />
      </div>
    </div>
  );
};
