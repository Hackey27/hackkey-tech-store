import { RmbCombinationCosts } from './RmbCombinationCosts';
import { RmbCostEditor } from './RmbCostEditor';
import { priceRmbProduct } from '../../shared/rmbPricing';
import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { ImagePlus, Plus, Trash2, TriangleAlert, UploadCloud } from 'lucide-react';
import { adminRequest } from './api';
import { AdminData } from './types';
import {
  PreorderAxis,
  PreorderCategory,
  PreorderCombination,
  PreorderDelivery,
  PreorderDetail,
  PreorderImageAssignment,
  PreorderProduct,
  RmbPricingSettings,
} from '../../shared/types';
import {
  combinationSlug,
  combinationsForAxes,
  readableSelections,
  validatePreorderProduct,
} from '../../shared/preorderCombinations';
import { similarAxisNames } from '../utils/preorderFilters';
import { cedisToPesewas, pesewasToCedis } from '../../shared/money';

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#014040]/10';
const labelClass = 'space-y-1 text-xs font-bold text-slate-700';
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#014040] px-4 py-2.5 text-sm font-black text-white hover:bg-[#025656] disabled:cursor-not-allowed disabled:opacity-50';
const ghostButton =
  'inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50';

/** Leaving an axis on this is what creates a partial combination. */
const ANY = '';

const DELIVERY_LABELS: Record<PreorderDelivery, string> = {
  express: '2-3 weeks',
  'two-months': '6-8 Weeks',
};

function blankProduct(): PreorderProduct {
  return {
    productId: '',
    pricingMode: 'rmb',
    name: '',
    description: '',
    details: [],
    categoryId: '',
    galleryImagePaths: [],
    variantAxes: [],
    // A product with no axes still gets one combination, so the cart and the
    // resolver keep a single code path rather than branching on "has variants".
    combinations: [{ combinationId: 'default', selections: {} }],
    imageAssignments: [],
    deliveryOptions: ['express', 'two-months'],
    active: false,
  };
}

/** Cedis in the form, integer pesewas in the model. Converted once, here. */
function cedisField(pesewas: number | undefined): string {
  return typeof pesewas === 'number' ? String(pesewasToCedis(pesewas)) : '';
}

function parseCedis(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  // A blank price means "not sold on this option", never free — so anything
  // unparseable drops the field rather than becoming zero.
  return Number.isFinite(parsed) ? cedisToPesewas(parsed) : undefined;
}

/* -- selector row shared by combinations and image assignments ------------ */

function SelectionRow({
  axes,
  selections,
  onChange,
}: {
  axes: PreorderAxis[];
  selections: Record<string, string>;
  onChange: (selections: Record<string, string>) => void;
}) {
  return (
    <>
      {axes.map((axis) => (
        <td key={axis.name} className="p-2 align-top">
          {/* The caption is for phones, where there is no table header to name
              the column. It stays in the accessibility tree on a laptop, but
              the LABEL itself must never be hidden — doing that took the
              select with it and made this table unusable above 768px. */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-slate-600 md:sr-only">{axis.name}</span>
            <select
              className={inputClass}
              value={selections[axis.name] ?? ANY}
              onChange={(event) => {
                const next = { ...selections };
                if (event.target.value === ANY) delete next[axis.name];
                else next[axis.name] = event.target.value;
                onChange(next);
              }}
            >
              {/* "Any" first, so the partial case is the easy one to reach. */}
              <option value={ANY}>Any {axis.name.toLowerCase()}</option>
              {axis.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </td>
      ))}
    </>
  );
}

/* -- images --------------------------------------------------------------- */

/** Bucket paths are private; this is the route that streams them back. */
function preorderMediaUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `/api/catalog/images?path=${encodeURIComponent(path)}`;
}

export type UploadImage = (file: File) => Promise<string>;

/**
 * A real file input, styled as a button.
 *
 * `type="file"` is what makes the device open its own picker — Explorer on a
 * laptop, the photo and file chooser on a phone. Nothing here can be replaced
 * with a click handler and a dialog of our own without losing that.
 */
function ImageUploadButton({
  label,
  multiple = false,
  disabled,
  busy,
  onFiles,
}: {
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onFiles: (files: FileList) => void;
}) {
  return (
    <label
      className={`${ghostButton} ${disabled || busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      {busy ? <UploadCloud className="h-4 w-4 animate-pulse" /> : <ImagePlus className="h-4 w-4" />}
      {busy ? 'Uploading…' : label}
      <input
        type="file"
        className="sr-only"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || busy}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          // Cleared so choosing the same file twice still fires a change.
          event.currentTarget.value = '';
        }}
      />
    </label>
  );
}

/** The product's own artwork: the card preview and the gallery strip. */
function MediaEditor({
  product,
  onChange,
  upload,
  canUpload,
}: {
  product: PreorderProduct;
  onChange: (changes: Partial<PreorderProduct>) => void;
  upload: UploadImage;
  canUpload: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, files: FileList, apply: (paths: string[]) => void) => {
    setBusy(key);
    setError(null);
    try {
      apply(await Promise.all(Array.from(files).map(upload)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <h4 className="text-sm font-black text-[#014040]">Images</h4>
        <p className="text-xs text-slate-600">
          The preview is what the listing card shows. Gallery images appear as
          thumbnails under the main picture on the product page.
        </p>
      </div>

      {!canUpload && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
          Give the product an id before uploading — the images are stored under it.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <b className="text-sm">Preview image</b>
              <p className="text-[11px] text-slate-500">1200 × 900 px (4:3).</p>
            </div>
            <ImageUploadButton
              label="Upload"
              disabled={!canUpload}
              busy={busy === 'preview'}
              onFiles={(files) => void run('preview', files, ([path]) => onChange({ previewImagePath: path }))}
            />
          </div>
          {product.previewImagePath ? (
            <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-[#edf5f3]">
              <img src={preorderMediaUrl(product.previewImagePath)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove preview image"
                onClick={() => onChange({ previewImagePath: undefined })}
                className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed p-4 text-center text-xs text-slate-400">
              Not uploaded
            </p>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <b className="text-sm">Gallery</b>
              <p className="text-[11px] text-slate-500">Several at once is fine.</p>
            </div>
            <ImageUploadButton
              label="Add images"
              multiple
              disabled={!canUpload}
              busy={busy === 'gallery'}
              onFiles={(files) =>
                void run('gallery', files, (paths) =>
                  onChange({ galleryImagePaths: [...product.galleryImagePaths, ...paths] })
                )
              }
            />
          </div>
          {product.galleryImagePaths.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {product.galleryImagePaths.map((path) => (
                <div key={path} className="relative aspect-square overflow-hidden rounded-lg bg-white">
                  <img src={preorderMediaUrl(path)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove gallery image"
                    onClick={() =>
                      onChange({ galleryImagePaths: product.galleryImagePaths.filter((entry) => entry !== path) })
                    }
                    className="absolute right-1 top-1 rounded bg-white/90 p-1.5 text-rose-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">No gallery images yet.</p>
          )}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</p>}
    </section>
  );
}

/* -- combination editor --------------------------------------------------- */

function CombinationEditor({
  product,
  settings,
  onChange,
  onPatch,
}: {
  product: PreorderProduct;
  settings: RmbPricingSettings;
  onChange: (combinations: PreorderCombination[]) => void;
  onPatch: (changes: Partial<PreorderProduct>) => void;
}) {
  const axes = product.variantAxes;
  const deliveries = product.deliveryOptions;
  const uniform = Boolean(product.uniformPricing);
  const automatic = product.pricingMode === 'rmb';

  const update = (index: number, patch: Partial<PreorderCombination>) => {
    onChange(
      product.combinations.map((combination, position) => {
        if (position !== index) return combination;
        const next = { ...combination, ...patch };
        // The id follows the selections, so a row cannot keep an id describing
        // a combination it no longer is.
        return { ...next, combinationId: patch.selections ? combinationSlug(next.selections, axes) : combination.combinationId };
      })
    );
  };

  /* Under uniform pricing the shared pair IS the first row's pair. Keeping it
     there rather than in a field of its own means the stored product has the
     same shape either way, and nothing downstream — the resolver, the server's
     re-pricing, the cart — has to know this mode exists. */
  const sharedPesewas = (delivery: PreorderDelivery): number | undefined =>
    delivery === 'express'
      ? product.combinations[0]?.priceExpressPesewas
      : product.combinations[0]?.priceTwoMonthsPesewas;

  const setShared = (delivery: PreorderDelivery, value: number | undefined) => {
    const field = delivery === 'express' ? 'priceExpressPesewas' : 'priceTwoMonthsPesewas';
    onChange(product.combinations.map((combination) => ({ ...combination, [field]: value })));
  };

  const sharedPrice = () => ({
    ...(automatic && product.combinations[0]?.sourceCost ? { sourceCost: product.combinations[0].sourceCost } : {}),
    priceExpressPesewas: sharedPesewas('express'),
    priceTwoMonthsPesewas: sharedPesewas('two-months'),
  });

  const priceColumns = uniform || automatic ? 0 : deliveries.length;

  const rows = product.combinations.map((combination, index) => {
    const readable = readableSelections(combination.selections, axes) || 'No variants';
    return (
      <React.Fragment key={`${combination.combinationId}-${index}`}>
        <tr className="border-t border-slate-200 md:align-top max-md:block max-md:rounded-xl max-md:border max-md:border-slate-200 max-md:p-3">
          {/* On a phone the row becomes a card, and the readable form is its
              heading. On a laptop it is the caption row underneath instead. */}
          <td className="pb-2 text-sm font-black text-[#014040] md:hidden">{readable}</td>
          <SelectionRow
            axes={axes}
            selections={combination.selections}
            onChange={(selections) => update(index, { selections })}
          />
          {!uniform && !automatic && deliveries.map((delivery) => (
            <td key={delivery} className="p-2 align-top">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-600 md:sr-only">
                  {DELIVERY_LABELS[delivery]} ₵
                </span>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cedisField(
                    delivery === 'express'
                      ? combination.priceExpressPesewas
                      : combination.priceTwoMonthsPesewas
                  )}
                  onChange={(event) =>
                    update(
                      index,
                      delivery === 'express'
                        ? { priceExpressPesewas: parseCedis(event.target.value) }
                        : { priceTwoMonthsPesewas: parseCedis(event.target.value) }
                    )
                  }
                />
              </label>
            </td>
          ))}
          <td className="p-2 align-top">
            <button
              type="button"
              aria-label={`Remove ${readable}`}
              className="hk-pressable rounded-xl border border-slate-300 p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => onChange(product.combinations.filter((_, position) => position !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </td>
        </tr>
        {automatic && !uniform && <tr className="max-md:block"><td colSpan={Math.max(1, axes.length + 1)} className="p-2 max-md:block"><RmbCostEditor cost={combination.sourceCost} deliveries={deliveries} settings={settings} onChange={sourceCost => update(index, { sourceCost })} /></td></tr>}
        <tr className="max-md:hidden">
          <td
            colSpan={axes.length + priceColumns + 1}
            className="px-2 pb-2 text-[11px] font-bold text-slate-500"
          >
            &#9492; {readable}
          </td>
        </tr>
      </React.Fragment>
    );
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-[#014040]">Combinations</h4>
          <p className="text-xs text-slate-600">
            Leave an axis on &ldquo;Any&rdquo; to price every option of it at once &mdash; one
            row for &ldquo;Black, any size&rdquo;, and a fuller row only where a size needs
            its own price.
          </p>
        </div>
        <button
          type="button"
          className={ghostButton}
          onClick={() =>
            onChange([
              ...product.combinations,
              {
                combinationId: combinationSlug({}, axes),
                selections: {},
                // A row added under uniform pricing arrives priced. Arriving
                // blank would quietly make that combination unsellable, which
                // is the sort of failure nobody reports.
                ...(uniform ? sharedPrice() : {}),
              },
            ])
          }
        >
          <Plus className="h-4 w-4" />
          Add combination
        </button>
      </div>

      {/* One price for the whole product. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={uniform}
            onChange={(event) => {
              const on = event.target.checked;
              onPatch({ uniformPricing: on, ...(on ? { combinations: product.combinations.map(combination => ({ ...combination, ...sharedPrice() })) } : {}) });
            }}
          />
          <span>
            <b>Same price for every combination</b>
            <span className="block text-xs text-slate-600">
              Set the price once below. Each combination still has to be listed
              &mdash; a combination that is not here is not for sale.
            </span>
          </span>
        </label>

        {uniform && !automatic && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {deliveries.map((delivery) => (
              <label key={delivery} className={`${labelClass} w-36`}>
                {DELIVERY_LABELS[delivery]} ₵
                <input
                  className={inputClass}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cedisField(sharedPesewas(delivery))}
                  onChange={(event) => setShared(delivery, parseCedis(event.target.value))}
                />
              </label>
            ))}
            <button
              type="button"
              className={ghostButton}
              onClick={() => onChange(combinationsForAxes(axes, sharedPrice()))}
            >
              <Plus className="h-4 w-4" />
              Fill from variants
            </button>
            <p className="w-full text-[11px] text-slate-500">
              &ldquo;Fill from variants&rdquo; replaces the rows below with one per
              variant, in the order the variants are listed. It is a deliberate
              press because it discards rows you added by hand.
            </p>
          </div>
        )}
        {uniform && automatic && <div className="mt-3"><RmbCombinationCosts product={product} settings={settings} onChange={onPatch} /></div>}
        {!deliveries.length && (
          <p className="mt-2 text-xs font-bold text-amber-800">
            Choose a delivery option above before setting a price.
          </p>
        )}
      </div>

      {/* Table on a laptop, stacked cards on a phone. Same rows either way. */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm max-md:block">
          <thead className="bg-[#f8fbfa] text-left text-[11px] font-black uppercase tracking-wide text-slate-600 max-md:hidden">
            <tr>
              {axes.map((axis) => (
                <th key={axis.name} className="p-2">{axis.name}</th>
              ))}
              {!uniform && !automatic && deliveries.map((delivery) => (
                <th key={delivery} className="p-2">{DELIVERY_LABELS[delivery]} ₵</th>
              ))}
              <th className="p-2" />
            </tr>
          </thead>
          <tbody className="max-md:block max-md:space-y-3 max-md:p-3">
            {rows.length ? rows : (
              <tr>
                <td className="p-4 text-sm text-slate-500" colSpan={axes.length + priceColumns + 1}>
                  No combinations yet. Nothing is purchasable until you add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -- image assignment ----------------------------------------------------- */

function ImageAssignmentEditor({
  product,
  onChange,
  upload,
  canUpload,
}: {
  product: PreorderProduct;
  onChange: (assignments: PreorderImageAssignment[]) => void;
  upload: UploadImage;
  canUpload: boolean;
}) {
  const axes = product.variantAxes;
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setAt = (index: number, patch: Partial<PreorderImageAssignment>) =>
    onChange(
      product.imageAssignments.map((entry, position) =>
        position === index ? { ...entry, ...patch } : entry
      )
    );

  const pick = async (index: number, files: FileList) => {
    setBusy(index);
    setError(null);
    try {
      setAt(index, { imagePath: await upload(files[0]) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-[#014040]">Image assignment</h4>
          <p className="text-xs text-slate-600">
            Separate from combinations, and partial in the same way: assigning to
            &ldquo;Black, any size&rdquo; covers every Black variant. Choose the
            variant, then upload the picture for it.
          </p>
        </div>
        <button
          type="button"
          className={ghostButton}
          onClick={() => onChange([...product.imageAssignments, { selections: {}, imagePath: '' }])}
        >
          <Plus className="h-4 w-4" />
          Assign image
        </button>
      </div>

      {!canUpload && product.imageAssignments.length > 0 && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
          Give the product an id before uploading &mdash; the images are stored under it.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm max-md:block">
          <thead className="bg-[#f8fbfa] text-left text-[11px] font-black uppercase tracking-wide text-slate-600 max-md:hidden">
            <tr>
              {axes.map((axis) => (
                <th key={axis.name} className="p-2">{axis.name}</th>
              ))}
              <th className="p-2">Image</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody className="max-md:block max-md:space-y-3 max-md:p-3">
            {product.imageAssignments.length ? (
              product.imageAssignments.map((assignment, index) => (
                <tr
                  key={index}
                  className="border-t border-slate-200 md:align-top max-md:block max-md:rounded-xl max-md:border max-md:border-slate-200 max-md:p-3"
                >
                  <td className="pb-2 text-sm font-black text-[#014040] md:hidden">
                    {readableSelections(assignment.selections, axes) || 'No variants'}
                  </td>
                  <SelectionRow
                    axes={axes}
                    selections={assignment.selections}
                    onChange={(selections) => setAt(index, { selections })}
                  />
                  <td className="p-2 align-top">
                    <span className="mb-1 block text-[11px] font-bold text-slate-600 md:sr-only">Image</span>
                    <div className="flex items-start gap-3">
                      {assignment.imagePath ? (
                        <img
                          src={preorderMediaUrl(assignment.imagePath)}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
                        />
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
                          None
                        </span>
                      )}
                      <div className="space-y-1">
                        <ImageUploadButton
                          label={assignment.imagePath ? 'Replace' : 'Upload image'}
                          disabled={!canUpload}
                          busy={busy === index}
                          onFiles={(files) => void pick(index, files)}
                        />
                        {product.galleryImagePaths.length > 0 && (
                          <select
                            className={`${inputClass} text-xs`}
                            value={product.galleryImagePaths.includes(assignment.imagePath) ? assignment.imagePath : ''}
                            onChange={(event) => setAt(index, { imagePath: event.target.value })}
                          >
                            <option value="">or reuse a gallery image…</option>
                            {product.galleryImagePaths.map((path, position) => (
                              <option key={path} value={path}>Gallery image {position + 1}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-2 align-top">
                    <button
                      type="button"
                      aria-label="Remove image assignment"
                      className="hk-pressable rounded-xl border border-slate-300 p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() =>
                        onChange(product.imageAssignments.filter((_, position) => position !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-sm text-slate-500" colSpan={axes.length + 2}>
                  No assignments. Every variant falls back to the preview image.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</p>}
    </section>
  );
}

/* -- categories ----------------------------------------------------------- */

/** A readable, stable document id from a typed name. */
function slugifyCategory(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Pick a category, or type one that does not exist yet.
 *
 * Typing a new name adds it to the list straight away so the seller can carry
 * on and hang subcategories off it, but it is only written when the product is
 * saved. Writing on every keystroke, or even on blur, would litter the
 * collection with half-typed names and typos that then have to be hunted down.
 */
function CategoryPicker({
  label,
  placeholder,
  options,
  valueId,
  onSelect,
  onCreate,
}: {
  label: string;
  placeholder: string;
  options: PreorderCategory[];
  valueId: string;
  onSelect: (categoryId: string) => void;
  onCreate: (name: string) => void;
}) {
  const selected = options.find((category) => category.categoryId === valueId);
  const [typed, setTyped] = useState('');
  const listId = `preorder-categories-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const commit = () => {
    const name = typed.trim();
    if (!name) return;
    const existing = options.find(
      (category) => category.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) onSelect(existing.categoryId);
    else onCreate(name);
    setTyped('');
  };

  return (
    <div className={labelClass}>
      <span>{label}</span>
      <select
        className={inputClass}
        value={valueId}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((category) => (
          <option key={category.categoryId} value={category.categoryId}>
            {category.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2 pt-1">
        <input
          className={inputClass}
          list={listId}
          value={typed}
          placeholder={`Or type a new ${label.toLowerCase()}`}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commit();
          }}
        />
        <datalist id={listId}>
          {options.map((category) => (
            <option key={category.categoryId} value={category.name} />
          ))}
        </datalist>
        <button type="button" className={ghostButton} onClick={commit} disabled={!typed.trim()}>
          Add
        </button>
      </div>
      {selected && (
        <p className="pt-1 text-[11px] font-normal text-slate-500">
          Using <b>{selected.name}</b>
        </p>
      )}
    </div>
  );
}

/* -- axes ----------------------------------------------------------------- */

function AxisEditor({
  axes,
  onChange,
  knownAxisNames,
}: {
  axes: PreorderAxis[];
  onChange: (axes: PreorderAxis[]) => void;
  /** Axis names already used on other pre-order products. */
  knownAxisNames: string[];
}) {
  const move = (index: number, delta: number) => {
    const next = axes.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-[#014040]">Variants</h4>
          <p className="text-xs text-slate-600">
            Order matters: it is the order the selectors appear in on the product page.
          </p>
        </div>
        <button
          type="button"
          className={ghostButton}
          onClick={() => onChange([...axes, { name: '', options: [] }])}
        >
          <Plus className="h-4 w-4" />
          Add variant
        </button>
      </div>

      {axes.length === 0 && (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No variants. This product gets a single price pair.
        </p>
      )}

      {axes.map((axis, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className={`${labelClass} flex-1`}>
              Heading
              <input
                className={inputClass}
                value={axis.name}
                placeholder="Colour"
                onChange={(event) =>
                  onChange(axes.map((entry, position) =>
                    position === index ? { ...entry, name: event.target.value } : entry
                  ))
                }
              />
            </label>
            <button type="button" className={ghostButton} onClick={() => move(index, -1)} disabled={index === 0}>
              Up
            </button>
            <button
              type="button"
              className={ghostButton}
              onClick={() => move(index, 1)}
              disabled={index === axes.length - 1}
            >
              Down
            </button>
            <button
              type="button"
              className={ghostButton}
              onClick={() => onChange(axes.filter((_, position) => position !== index))}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>

          {/* The storefront's Advanced filter matches axes by exact name, so a
              near-miss here means neither axis ever surfaces as a filter and
              nothing looks broken. A hint, not a block. */}
          {similarAxisNames(axis.name, knownAxisNames).length > 0 && (
            <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">
              Other products already use{' '}
              <b>{similarAxisNames(axis.name, knownAxisNames).join('”, “')}</b>. Filters group
              variants by exact name, so use the same wording if this is the same thing.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {axis.options.map((option, optionIndex) => (
              <span
                key={optionIndex}
                className="inline-flex items-center gap-2 rounded-xl bg-[#edf5f3] px-3 py-1.5 text-xs font-bold text-[#014040]"
              >
                {option}
                <button
                  type="button"
                  aria-label={`Remove ${option}`}
                  onClick={() =>
                    onChange(axes.map((entry, position) =>
                      position === index
                        ? { ...entry, options: entry.options.filter((_, o) => o !== optionIndex) }
                        : entry
                    ))
                  }
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          <AddOption
            onAdd={(value) =>
              onChange(axes.map((entry, position) =>
                position === index && !entry.options.includes(value)
                  ? { ...entry, options: [...entry.options, value] }
                  : entry
              ))
            }
          />
        </div>
      ))}
    </section>
  );
}

function AddOption({ onAdd }: { onAdd: (value: string) => void }) {
  const [value, setValue] = useState('');
  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };
  return (
    <div className="flex gap-2">
      <input
        className={inputClass}
        value={value}
        placeholder="Add option, e.g. Black"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
      <button type="button" className={ghostButton} onClick={commit}>
        Add
      </button>
    </div>
  );
}

/* -- details -------------------------------------------------------------- */

function DetailsEditor({
  details,
  onChange,
}: {
  details: PreorderDetail[];
  onChange: (details: PreorderDetail[]) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-black text-[#014040]">Details</h4>
        <button
          type="button"
          className={ghostButton}
          onClick={() => onChange([...details, { label: '', value: '' }])}
        >
          <Plus className="h-4 w-4" />
          Add row
        </button>
      </div>
      {details.map((detail, index) => (
        <div key={index} className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Label"
            value={detail.label}
            onChange={(event) =>
              onChange(details.map((entry, position) =>
                position === index ? { ...entry, label: event.target.value } : entry
              ))
            }
          />
          <input
            className={inputClass}
            placeholder="Value"
            value={detail.value}
            onChange={(event) =>
              onChange(details.map((entry, position) =>
                position === index ? { ...entry, value: event.target.value } : entry
              ))
            }
          />
          <button
            type="button"
            aria-label="Remove detail"
            className="hk-pressable rounded-xl border border-slate-300 p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => onChange(details.filter((_, position) => position !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </section>
  );
}

/* -- the section ---------------------------------------------------------- */

export function PreorderSetupSection({
  data,
  user,
  reload,
}: {
  data: AdminData;
  user: User;
  reload: () => Promise<void>;
}) {
  const products = data.preorderProducts;
  const [selectedId, setSelectedId] = useState<string>(() => products[0]?.productId || '');
  const [draft, setDraft] = useState<PreorderProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editing = draft ?? products.find((product) => product.productId === selectedId) ?? null;
  const patch = (changes: Partial<PreorderProduct>) =>
    setDraft({ ...(editing ?? blankProduct()), ...changes });

  // Live, so the seller sees a duplicate or a gap as they type rather than on
  // save. The server runs the same function again before writing.
  const validation = useMemo(
    () => {
      if (!editing) return { errors: [], warnings: [] };
      const result = validatePreorderProduct(editing);
      if (editing.pricingMode === 'rmb' && editing.active) result.errors.push(...priceRmbProduct(editing, data.rmbPricing).errors);
      return result;
    },
    [editing, data.rmbPricing]
  );

  /* Categories typed in but not yet written. They are shown alongside the
     saved ones so subcategories can be added under a brand new parent, and
     they reach Firestore only when the product is saved. */
  const [pendingCategories, setPendingCategories] = useState<PreorderCategory[]>([]);
  const allCategories = [...data.preorderCategories, ...pendingCategories];
  const topLevel = allCategories.filter((category) => !category.parentId);
  const children = (parentId: string): PreorderCategory[] =>
    allCategories.filter((category) => category.parentId === parentId);

  /** Adds a typed category to the list and returns the id to select. */
  const addCategory = (name: string, parentId: string | null): string => {
    const base = slugifyCategory(name);
    let categoryId = base || `category-${allCategories.length + 1}`;
    // A name that slugs onto an existing id would silently rename that
    // category on save, so the duplicate gets a suffix instead.
    for (let n = 2; allCategories.some((entry) => entry.categoryId === categoryId); n += 1) {
      categoryId = `${base}-${n}`;
    }
    setPendingCategories((current) => [...current, { categoryId, name: name.trim(), parentId }]);
    return categoryId;
  };

  const canUpload = Boolean(editing?.productId);

  /* Axis names in use on every OTHER product, for the near-miss hint. */
  const otherAxisNames = useMemo(
    () => [...new Set(
      products
        .filter((candidate) => candidate.productId !== editing?.productId)
        .flatMap((candidate) => candidate.variantAxes.map((axis) => axis.name))
    )],
    [products, editing?.productId]
  );

  /**
   * Stores one file and hands back its path.
   *
   * It attaches nothing: the caller puts the path into the draft, and the
   * draft is written by the usual save. That keeps one write per save rather
   * than one per image, so an upload can never half-save the product.
   */
  const uploadImage: UploadImage = async (file) => {
    if (!editing?.productId) throw new Error('Give the product an id first.');
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const { objectPath } = await adminRequest<{ objectPath: string }>(
      user,
      `/preorder/products/${encodeURIComponent(editing.productId)}/images`,
      { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob }
    );
    return objectPath;
  };

  const save = async () => {
    if (!editing || validation.errors.length) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      // Categories first: a product saved against a category that does not
      // exist yet renders under no card at all on the storefront.
      for (const category of pendingCategories) {
        await adminRequest(user, `/preorder/categories/${encodeURIComponent(category.categoryId)}`, {
          method: 'PUT',
          body: JSON.stringify(category),
        });
      }
      const response = await adminRequest<{ warnings: string[] }>(
        user,
        `/preorder/products/${encodeURIComponent(editing.productId)}`,
        { method: 'PUT', body: JSON.stringify(editing) }
      );
      await reload();
      setPendingCategories([]);
      setDraft(null);
      setSelectedId(editing.productId);
      setMessage(
        response.warnings?.length
          ? `Saved with ${response.warnings.length} warning(s).`
          : 'Saved.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-[#014040]">Pre-order setup</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          The combination is what sells, not the product. A combination that is not
          listed here is not for sale, and a blank price means “ask”, never free.
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2 rounded-2xl border border-slate-200 bg-white p-2 xl:sticky xl:top-5">
          <button
            type="button"
            className={`${primaryButton} w-full`}
            onClick={() => {
              setDraft(blankProduct());
              setSelectedId('');
            }}
          >
            <Plus className="h-4 w-4" />
            New product
          </button>
          {products.map((product) => (
            <button
              key={product.productId}
              type="button"
              onClick={() => {
                setDraft(null);
                setSelectedId(product.productId);
              }}
              className={`w-full rounded-xl p-3 text-left text-sm ${
                selectedId === product.productId && !draft
                  ? 'bg-[#014040] font-black text-white'
                  : 'hover:bg-slate-50'
              }`}
            >
              <span className="block truncate">{product.name || product.productId}</span>
              <small className={selectedId === product.productId && !draft ? 'text-white/70' : 'text-slate-500'}>
                {product.combinations.length} combination
                {product.combinations.length === 1 ? '' : 's'} · {product.active ? 'Published' : 'Draft'}
              </small>
            </button>
          ))}
          {!products.length && (
            <p className="p-3 text-xs text-slate-500">No pre-order products yet.</p>
          )}
        </aside>

        <main className="min-w-0 space-y-5">
          {!editing ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
              Choose a product, or start a new one.
            </div>
          ) : (
            <>
              <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                <label className={labelClass}>
                  Product id
                  <input
                    className={inputClass}
                    value={editing.productId}
                    placeholder="field-shirt"
                    onChange={(event) => patch({ productId: event.target.value.trim() })}
                  />
                </label>
                <label className={labelClass}>
                  Name
                  <input
                    className={inputClass}
                    value={editing.name}
                    onChange={(event) => patch({ name: event.target.value })}
                  />
                </label>
                <label className={`${labelClass} md:col-span-2`}>
                  Description
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={editing.description}
                    onChange={(event) => patch({ description: event.target.value })}
                  />
                </label>
                <CategoryPicker
                  label="Category"
                  placeholder="Choose a category…"
                  options={topLevel}
                  valueId={editing.categoryId}
                  onSelect={(categoryId) => patch({ categoryId, subcategoryId: undefined })}
                  onCreate={(name) => {
                    const categoryId = addCategory(name, null);
                    patch({ categoryId, subcategoryId: undefined });
                  }}
                />
                {/* A subcategory needs a parent to hang from, so this appears as
                    soon as one is chosen rather than only once children exist —
                    otherwise the first subcategory could never be added. */}
                {editing.categoryId && (
                  <CategoryPicker
                    label="Subcategory"
                    placeholder="None"
                    options={children(editing.categoryId)}
                    valueId={editing.subcategoryId || ''}
                    onSelect={(subcategoryId) => patch({ subcategoryId: subcategoryId || undefined })}
                    onCreate={(name) => patch({ subcategoryId: addCategory(name, editing.categoryId) })}
                  />
                )}
                <fieldset className="md:col-span-2">
                  <legend className="text-xs font-bold text-slate-700">Delivery options</legend>
                  <div className="mt-1 flex flex-wrap gap-4">
                    {(['express', 'two-months'] as const).map((delivery) => (
                      <label key={delivery} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editing.deliveryOptions.includes(delivery)}
                          onChange={(event) =>
                            patch({
                              deliveryOptions: event.target.checked
                                ? [...editing.deliveryOptions, delivery]
                                : editing.deliveryOptions.filter((entry) => entry !== delivery),
                            })
                          }
                        />
                        {DELIVERY_LABELS[delivery]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(event) => patch({ active: event.target.checked })}
                  />
                  Published
                </label>
              </section>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <DetailsEditor details={editing.details} onChange={(details) => patch({ details })} />
              </div>

              <AxisEditor
                axes={editing.variantAxes}
                onChange={(variantAxes) => patch({ variantAxes })}
                knownAxisNames={otherAxisNames}
              />

              <label className="block space-y-2 text-xs font-bold">Pricing method<select className={inputClass} value={editing.pricingMode || 'manual'} onChange={event => patch({ pricingMode: event.target.value as 'manual' | 'rmb' })}><option value="rmb">Automatically calculate from RMB costs</option><option value="manual">Existing manual selling prices</option></select><small className="block font-normal text-slate-500">RMB-based prices update whenever Payments → Exchange Rate &amp; Charges changes. Existing manual items keep their current prices until converted.</small></label>
              <CombinationEditor
                product={editing}
                settings={data.rmbPricing}
                onChange={(combinations) => patch({ combinations })}
                onPatch={patch}
              />

              <MediaEditor
                product={editing}
                onChange={patch}
                upload={uploadImage}
                canUpload={canUpload}
              />

              <ImageAssignmentEditor
                product={editing}
                onChange={(imageAssignments) => patch({ imageAssignments })}
                upload={uploadImage}
                canUpload={canUpload}
              />

              {validation.errors.length > 0 && (
                <ul role="alert" className="space-y-1 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">
                  {validation.errors.map((entry, index) => (
                    <li key={index}>{entry}</li>
                  ))}
                </ul>
              )}

              {validation.warnings.length > 0 && (
                <ul className="space-y-1 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  {validation.warnings.map((entry, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      {entry}
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButton}
                  disabled={saving || validation.errors.length > 0 || !editing.productId}
                  onClick={save}
                >
                  {saving ? 'Saving…' : 'Save product'}
                </button>
                {draft && (
                  <button type="button" className={ghostButton} onClick={() => setDraft(null)}>
                    Discard changes
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
