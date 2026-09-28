import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { Plus, Trash2, TriangleAlert } from 'lucide-react';
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
} from '../../shared/types';
import {
  combinationSlug,
  readableSelections,
  validatePreorderProduct,
} from '../../shared/preorderCombinations';
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
  express: 'Express',
  'two-months': 'Two months',
};

function blankProduct(): PreorderProduct {
  return {
    productId: '',
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
          <label className="md:sr-only">
            <span className="mb-1 block text-[11px] font-bold text-slate-600 md:hidden">{axis.name}</span>
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

/* -- combination editor --------------------------------------------------- */

function CombinationEditor({
  product,
  onChange,
}: {
  product: PreorderProduct;
  onChange: (combinations: PreorderCombination[]) => void;
}) {
  const axes = product.variantAxes;
  const deliveries = product.deliveryOptions;

  const update = (index: number, patch: Partial<PreorderCombination>) => {
    onChange(
      product.combinations.map((combination, position) => {
        if (position !== index) return combination;
        const next = { ...combination, ...patch };
        // The id follows the selections, so a row cannot keep an id describing
        // a combination it no longer is.
        return { ...next, combinationId: combinationSlug(next.selections, axes) };
      })
    );
  };

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
          {deliveries.map((delivery) => (
            <td key={delivery} className="p-2 align-top">
              <label className="md:sr-only">
                <span className="mb-1 block text-[11px] font-bold text-slate-600 md:hidden">
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
        <tr className="max-md:hidden">
          <td
            colSpan={axes.length + deliveries.length + 1}
            className="px-2 pb-2 text-[11px] font-bold text-slate-500"
          >
            └ {readable}
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
            Leave an axis on “Any” to price every option of it at once — one row for
            “Black, any size”, and a fuller row only where a size needs its own price.
          </p>
        </div>
        <button
          type="button"
          className={ghostButton}
          onClick={() =>
            onChange([
              ...product.combinations,
              { combinationId: combinationSlug({}, axes), selections: {} },
            ])
          }
        >
          <Plus className="h-4 w-4" />
          Add combination
        </button>
      </div>

      {/* Table on a laptop, stacked cards on a phone. Same rows either way. */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm max-md:block">
          <thead className="bg-[#f8fbfa] text-left text-[11px] font-black uppercase tracking-wide text-slate-600 max-md:hidden">
            <tr>
              {axes.map((axis) => (
                <th key={axis.name} className="p-2">{axis.name}</th>
              ))}
              {deliveries.map((delivery) => (
                <th key={delivery} className="p-2">{DELIVERY_LABELS[delivery]} ₵</th>
              ))}
              <th className="p-2" />
            </tr>
          </thead>
          <tbody className="max-md:block max-md:space-y-3 max-md:p-3">
            {rows.length ? rows : (
              <tr>
                <td className="p-4 text-sm text-slate-500" colSpan={axes.length + deliveries.length + 1}>
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
}: {
  product: PreorderProduct;
  onChange: (assignments: PreorderImageAssignment[]) => void;
}) {
  const axes = product.variantAxes;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-[#014040]">Image assignment</h4>
          <p className="text-xs text-slate-600">
            Separate from combinations, and partial in the same way: assigning to
            “Black, any size” covers every Black variant.
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
                  <SelectionRow
                    axes={axes}
                    selections={assignment.selections}
                    onChange={(selections) =>
                      onChange(
                        product.imageAssignments.map((entry, position) =>
                          position === index ? { ...entry, selections } : entry
                        )
                      )
                    }
                  />
                  <td className="p-2 align-top">
                    <label className="md:sr-only">
                      <span className="mb-1 block text-[11px] font-bold text-slate-600 md:hidden">Image</span>
                      <select
                        className={inputClass}
                        value={assignment.imagePath}
                        onChange={(event) =>
                          onChange(
                            product.imageAssignments.map((entry, position) =>
                              position === index ? { ...entry, imagePath: event.target.value } : entry
                            )
                          )
                        }
                      >
                        <option value="">Choose a gallery image…</option>
                        {product.galleryImagePaths.map((path) => (
                          <option key={path} value={path}>{path}</option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-1 text-[11px] text-slate-500 md:hidden">
                      {readableSelections(assignment.selections, axes) || 'No variants'}
                    </p>
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
    </section>
  );
}

/* -- axes ----------------------------------------------------------------- */

function AxisEditor({
  axes,
  onChange,
}: {
  axes: PreorderAxis[];
  onChange: (axes: PreorderAxis[]) => void;
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
    () => (editing ? validatePreorderProduct(editing) : { errors: [], warnings: [] }),
    [editing]
  );

  const topLevel = data.preorderCategories.filter((category) => !category.parentId);
  const children = (parentId: string): PreorderCategory[] =>
    data.preorderCategories.filter((category) => category.parentId === parentId);

  const save = async () => {
    if (!editing || validation.errors.length) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await adminRequest<{ warnings: string[] }>(
        user,
        `/preorder/products/${encodeURIComponent(editing.productId)}`,
        { method: 'PUT', body: JSON.stringify(editing) }
      );
      await reload();
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
                <label className={labelClass}>
                  Category
                  <select
                    className={inputClass}
                    value={editing.categoryId}
                    onChange={(event) => patch({ categoryId: event.target.value, subcategoryId: undefined })}
                  >
                    <option value="">Choose…</option>
                    {topLevel.map((category) => (
                      <option key={category.categoryId} value={category.categoryId}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                {/* Only shown once a category with children is chosen. */}
                {children(editing.categoryId).length > 0 && (
                  <label className={labelClass}>
                    Subcategory
                    <select
                      className={inputClass}
                      value={editing.subcategoryId || ''}
                      onChange={(event) => patch({ subcategoryId: event.target.value || undefined })}
                    >
                      <option value="">None</option>
                      {children(editing.categoryId).map((category) => (
                        <option key={category.categoryId} value={category.categoryId}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
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

              <AxisEditor axes={editing.variantAxes} onChange={(variantAxes) => patch({ variantAxes })} />

              <CombinationEditor
                product={editing}
                onChange={(combinations) => patch({ combinations })}
              />

              <ImageAssignmentEditor
                product={editing}
                onChange={(imageAssignments) => patch({ imageAssignments })}
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
