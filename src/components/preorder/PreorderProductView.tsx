import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, PackagePlus, Scale } from "lucide-react";
import { PreorderDelivery, PreorderProduct } from "../../../shared/types";
import {
  PreorderSelections,
  readableSelections,
  preorderCardPricing,
  resolvePreorderSelection,
} from "../../../shared/preorderCombinations";
import { formatPesewas } from "../../../shared/money";
import { STORE_COPY } from "../../config/storeCopy";
import { PreorderCartAddition } from "../../utils/usePreorderCart";
import { ImageLightbox } from "../ImageLightbox";
import { PreorderDeliveryLabel } from "./PreorderDeliveryLabel";

interface PreorderProductViewProps {
  product: PreorderProduct;
  onBack: () => void;
  onAdd: (addition: PreorderCartAddition) => void;
  /** From ?combination= on a shared or searched link. */
  initialCombinationId?: string;
  /** Starts a comparison with this product. The only way in — a customer has
   *  to have opened something before comparing it means anything. */
  onCompare: (product: PreorderProduct) => void;
  comparing: boolean;
  canCompare: boolean;
}

const DELIVERY_NOTES: Record<PreorderDelivery, string> = {
  express: STORE_COPY.preorder.delivery.expressNote,
  "two-months": STORE_COPY.preorder.delivery.twoMonthsNote,
};

/** How far into the image the magnifier goes. Enough to read a label or a
 *  stitch, short of the point where a phone-sized photo turns to mush. */
const HOVER_ZOOM = 2.4;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** True only where hovering is a real thing. A touch screen reports a hover
 *  once on tap and then leaves the magnifier stuck on. */
function useFinePointer(): boolean {
  const query = "(hover: hover) and (pointer: fine)";
  const [fine, setFine] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setFine(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return fine;
}

/**
 * The selected variant's image, magnified under the pointer.
 *
 * The whole image scales up inside its own frame with the transform origin
 * pinned to wherever the pointer is, so the part being pointed at is the part
 * that grows. A separate lens panel would have to sit somewhere, and on this
 * layout the only room for it is on top of the selectors the customer is in
 * the middle of using.
 *
 * There is no transition while the pointer is moving — easing toward a target
 * that changes every frame reads as lag rather than smoothness. The ease is
 * kept for the way back out, when the pointer leaves and there is a single
 * destination to travel to.
 */
function ZoomableImage({
  src,
  alt,
  onOpen,
  onError,
}: {
  src: string;
  alt: string;
  onOpen: () => void;
  onError: () => void;
}) {
  const fine = useFinePointer();
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const track = (event: React.MouseEvent) => {
    if (!fine || !frameRef.current) return;
    const box = frameRef.current.getBoundingClientRect();
    setOrigin({
      x: clampPercent(((event.clientX - box.left) / box.width) * 100),
      y: clampPercent(((event.clientY - box.top) / box.height) * 100),
    });
  };

  return (
    <div
      ref={frameRef}
      onMouseMove={track}
      onMouseLeave={() => setOrigin(null)}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#d8e7e4] bg-[#edf5f3]"
    >
      <img
        key={src}
        data-testid="preorder-product-image"
        data-image-src={src}
        data-zoomed={origin ? "true" : "false"}
        src={src}
        alt={alt}
        onError={onError}
        draggable={false}
        className={`h-full w-full select-none object-cover ${
          origin
            ? ""
            : "transition-transform duration-200 ease-out motion-reduce:transition-none"
        }`}
        style={
          origin
            ? {
                transform: `scale(${HOVER_ZOOM})`,
                transformOrigin: `${origin.x}% ${origin.y}%`,
              }
            : undefined
        }
      />
      {/* The click target is the frame, so the magnifier and the tap-to-open
          never fight over the same pixels. */}
      <button
        type="button"
        data-testid="preorder-image-open"
        onClick={onOpen}
        aria-label={STORE_COPY.preorder.openImage}
        className="absolute inset-0 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#014040]"
      />
      {fine && !origin && (
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-[#014040]/75 px-2.5 py-1 text-[10px] font-bold text-white">
          {STORE_COPY.preorder.hoverToZoom}
        </span>
      )}
    </div>
  );
}

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
  initialCombinationId,
  onCompare,
  comparing,
  canCompare,
}) => {
  /* A linked combination preselects the axes it names, and only those. A
     partial combination such as {Colour: Black} therefore lands with Black
     chosen and the size still open, which is exactly what that combination
     means. An id that no longer exists preselects nothing rather than
     erroring — the link still opens the product. */
  const preselected = (): PreorderSelections => {
    if (!initialCombinationId) return {};
    const combination = product.combinations.find(
      (entry) => entry.combinationId === initialCombinationId,
    );
    return combination ? { ...combination.selections } : {};
  };

  const [selections, setSelections] = useState<PreorderSelections>(preselected);
  const [delivery, setDelivery] = useState<PreorderDelivery>(
    () => product.deliveryOptions[0] || "express",
  );

  // Switching products through a shared link resets the page rather than
  // carrying one product's Colour over to another that happens to share it.
  useEffect(() => {
    setSelections(preselected());
    setDelivery(product.deliveryOptions[0] || "express");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId, initialCombinationId]);

  const resolved = useMemo(
    () => resolvePreorderSelection(product, selections),
    [product, selections],
  );

  const pricePesewas =
    delivery === "express"
      ? resolved.priceExpressPesewas
      : resolved.priceTwoMonthsPesewas;

  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [resolved.imagePath]);

  /* What the viewer pages through: the variant's own image first, then the
     gallery. Deduped, because an assignment usually points at a gallery image
     and the same picture twice in a row reads as a stuck swipe. */
  const [openAt, setOpenAt] = useState<number | null>(null);
  const lightboxImages = useMemo(() => {
    const ordered = [resolved.imagePath, ...product.galleryImagePaths].filter(
      (path): path is string => Boolean(path),
    );
    return [...new Set(ordered)];
  }, [resolved.imagePath, product.galleryImagePaths]);

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
      selectionLabel: readableSelections(
        resolved.combination.selections,
        product.variantAxes,
      ),
      delivery,
      pricePesewas,
      // Both prices travel with the line so the cart can switch delivery
      // without re-reading a catalogue that may have refreshed by then.
      pricesPesewas: {
        express: resolved.priceExpressPesewas ?? undefined,
        "two-months": resolved.priceTwoMonthsPesewas ?? undefined,
      },
      availableDeliveries: product.deliveryOptions,
      imageUrl: resolved.imagePath || undefined,
    });
  };

  const matchingPricing = preorderCardPricing({
    ...product,
    combinations: product.combinations.filter((combination) =>
      Object.entries(selections).every(
        ([axis, value]) =>
          combination.selections[axis] === undefined ||
          combination.selections[axis] === value,
      ),
    ),
  });

  const variantSelectors = (
    <>
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
                  data-enabled={option.enabled ? "true" : "false"}
                  disabled={!option.enabled}
                  aria-pressed={option.selected}
                  title={
                    option.enabled
                      ? undefined
                      : STORE_COPY.preorder.unavailableOption
                  }
                  onClick={() => toggleOption(axis.name, option.value)}
                  className={`hk-pressable rounded-xl border px-3.5 py-2 text-sm font-bold ${
                    option.selected
                      ? "border-[#014040] bg-[#014040] text-white"
                      : option.enabled
                        ? "border-[#d0e4e0] bg-white text-[#014040] hover:bg-[#edf5f3]"
                        : // Greyed and struck through, never hidden: a
                          // customer should be able to see that Red exists
                          // and is simply not available with what they
                          // have picked so far.
                          "cursor-not-allowed border-[#e6eeec] bg-[#f4f8f7] text-slate-400 line-through"
                  }`}
                >
                  {option.value}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null,
      )}
    </>
  );

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
      <h1 className="mb-5 text-2xl font-black tracking-tight text-[#014040] sm:text-3xl">
        {product.name}
      </h1>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          {resolved.imagePath && !imageFailed ? (
            <ZoomableImage
              src={resolved.imagePath}
              alt={product.name}
              onOpen={() =>
                setOpenAt(
                  Math.max(0, lightboxImages.indexOf(resolved.imagePath!)),
                )
              }
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#d8e7e4] bg-[#edf5f3]">
              <div
                data-testid="preorder-product-image"
                className="flex h-full items-center justify-center px-6 text-center text-xl font-black text-[#014040]/40"
              >
                {product.name}
              </div>
            </div>
          )}

          <div className="lg:hidden" data-testid="preorder-mobile-variants">
            {variantSelectors}
          </div>

          <section className="mt-7" aria-label="Product gallery">
            {product.galleryImagePaths.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {product.galleryImagePaths.slice(0, 8).map((path) => (
                  <button
                    key={path}
                    type="button"
                    data-testid="preorder-gallery-thumb"
                    onClick={() =>
                      setOpenAt(Math.max(0, lightboxImages.indexOf(path)))
                    }
                    aria-label={STORE_COPY.preorder.openImage}
                    className="hk-pressable aspect-square cursor-zoom-in overflow-hidden rounded-xl border border-[#d8e7e4] bg-[#edf5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#014040]"
                  >
                    <img
                      src={path}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.04] motion-reduce:transition-none motion-reduce:hover:scale-100"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>
          {product.description && (
            <section className="mt-7">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#025656]">
                Description
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                {product.description}
              </p>
            </section>
          )}
          {product.details.length > 0 && (
            <div className="mt-7">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#025656]">
                {STORE_COPY.preorder.details}
              </h2>
              <dl className="mt-2 divide-y divide-[#edf4f3] rounded-2xl border border-[#d8e7e4] bg-white px-4">
                {product.details.map((detail) => (
                  <div key={detail.label} className="flex gap-4 py-2.5 text-sm">
                    <dt className="w-2/5 shrink-0 font-bold text-[#014040]">
                      {detail.label}
                    </dt>
                    <dd className="min-w-0 flex-1 text-slate-600">
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
        <div className="sticky top-[112px] z-30 row-start-1 min-w-0 md:top-[76px] lg:col-start-2">
          <aside
            data-testid="preorder-sticky-pricing"
            className="rounded-2xl border border-[#d8e7e4] bg-white/95 p-3 shadow-sm backdrop-blur-sm lg:p-5"
          >
            <fieldset data-testid="preorder-delivery">
              <legend className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#014040]">
                Delivery time
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {product.deliveryOptions.map((option) => {
                  const actual =
                    option === "express"
                      ? resolved.priceExpressPesewas
                      : resolved.priceTwoMonthsPesewas;
                  const starting = matchingPricing.find(
                    (entry) => entry.delivery === option,
                  );
                  return (
                    <button
                      key={option}
                      type="button"
                      data-testid={"preorder-delivery-" + option}
                      aria-pressed={delivery === option}
                      onClick={() => setDelivery(option)}
                      className={
                        "hk-pressable flex min-w-0 flex-col items-start gap-1.5 rounded-xl border p-2 text-left " +
                        (delivery === option
                          ? "border-[#014040] bg-[#edf5f3]"
                          : "border-[#d0e4e0] bg-white")
                      }
                    >
                      <PreorderDeliveryLabel delivery={option} />
                      <span className="break-words text-sm font-black text-[#014040] sm:text-base">
                        {actual !== null
                          ? formatPesewas(actual)
                          : starting
                            ? starting.uniform
                              ? formatPesewas(starting.pricePesewas)
                              : STORE_COPY.preorder.fromPrice(
                                  formatPesewas(starting.pricePesewas),
                                )
                            : STORE_COPY.preorder.askForPrice}
                      </span>
                      <span className="hidden text-[11px] text-slate-500 lg:block">
                        {DELIVERY_NOTES[option]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="hidden lg:block">
              {pricePesewas !== null ? (
                <p
                  key={pricePesewas}
                  data-testid="preorder-price"
                  className="hk-price-change mt-4 text-2xl font-black text-[#014040]"
                >
                  {formatPesewas(pricePesewas)}
                </p>
              ) : (
                <p
                  data-testid="preorder-price-pending"
                  className="mt-3 text-sm font-bold text-[#025656]"
                >
                  {resolved.missingAxes.length
                    ? STORE_COPY.preorder.choosePrompt(resolved.missingAxes)
                    : STORE_COPY.preorder.askForPrice}
                </p>
              )}
            </div>
            <button
              type="button"
              id="preorder-add-btn"
              data-testid="preorder-add-btn"
              disabled={!canAdd}
              onClick={handleAdd}
              className={
                "hk-pressable mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black " +
                (canAdd
                  ? "bg-[#05ef28] text-[#014040] hover:bg-[#04d824]"
                  : "cursor-not-allowed bg-[#dfe9e7] text-slate-500")
              }
            >
              <PackagePlus className="h-4 w-4" />
              {canAdd
                ? STORE_COPY.preorder.addToCart
                : resolved.missingAxes.length
                  ? STORE_COPY.preorder.choosePrompt(resolved.missingAxes)
                  : STORE_COPY.preorder.askForPrice}
            </button>
            <button
              type="button"
              data-testid="preorder-product-compare"
              disabled={comparing || !canCompare}
              onClick={() => onCompare(product)}
              className="hk-pressable mt-3 hidden w-full items-center justify-center gap-2 rounded-xl border border-[#014040] px-4 py-2.5 text-xs font-black text-[#014040] disabled:opacity-50 lg:flex"
            >
              <Scale className="h-4 w-4" />
              {comparing
                ? STORE_COPY.preorder.compare.added
                : STORE_COPY.preorder.compare.start}
            </button>
          </aside>
          {resolved.axes.some((axis) => axis.visible) && (
            <section
              data-testid="preorder-desktop-variants"
              aria-label="Product variants"
              className="mt-4 hidden rounded-2xl border border-[#d8e7e4] bg-white px-5 pb-5 lg:block"
            >
              {variantSelectors}
            </section>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={comparing || !canCompare}
        onClick={() => onCompare(product)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#014040] px-4 py-2.5 text-xs font-black text-[#014040] disabled:opacity-50 lg:hidden"
      >
        <Scale className="h-4 w-4" />
        {comparing
          ? STORE_COPY.preorder.compare.added
          : STORE_COPY.preorder.compare.start}
      </button>
      <ImageLightbox
        images={lightboxImages}
        openAt={openAt}
        onClose={() => setOpenAt(null)}
        alt={(index) => product.name + " image " + (index + 1)}
      />
    </div>
  );
};
