import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { Boxes, Plus, Users } from 'lucide-react';
import { adminRequest } from './api';
import { AdminData } from './types';
import { Preorder, PreorderItem, PreorderItemStatus } from '../../shared/types';
import { formatPesewas } from '../../shared/money';

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#014040]/10';
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#014040] px-4 py-2.5 text-sm font-black text-white hover:bg-[#025656] disabled:cursor-not-allowed disabled:opacity-50';
const ghostButton =
  'inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50';

/**
 * The five item statuses, in order.
 *
 * Three and four are greyed here because they belong to the package: setting
 * them on one item would make that item disagree with the box it is physically
 * inside. They stay visible so the sequence reads as a whole.
 */
const ITEM_STATUSES: Array<{ value: PreorderItemStatus; label: string; onPackage: boolean }> = [
  { value: 'awaiting-order', label: 'Ordered', onPackage: false },
  { value: 'delivered-in-china', label: 'Delivered in China', onPackage: false },
  { value: 'received-by-shipping', label: 'Received by shipping', onPackage: true },
  { value: 'received-in-ghana', label: 'Received in Ghana', onPackage: true },
  { value: 'delivered-to-client', label: 'Delivered to client', onPackage: false },
];

const PACKAGE_STATUSES = [
  { value: 'delivered-in-china', label: 'Delivered in China' },
  { value: 'received-by-shipping', label: 'Received by shipping' },
  { value: 'received-in-ghana', label: 'Received in Ghana' },
] as const;

const statusLabel = (status: PreorderItemStatus) =>
  ITEM_STATUSES.find((entry) => entry.value === status)?.label || status;

/**
 * Pre-order management.
 *
 * TWO VIEWS OVER THE SAME ORDERS, because the seller asks two different
 * questions. By product answers "how many of these do I need to buy", which is
 * what a bulk order to a supplier needs. By customer answers "what does this
 * person get", which is what fulfilling one delivery needs. Neither view can be
 * derived comfortably from the other on screen, so both exist.
 */
export function PreorderOrdersSection({
  data,
  user,
  reload,
}: {
  data: AdminData;
  user: User;
  reload: () => Promise<void>;
}) {
  const preorders = data.preorders || [];
  const packages = data.preorderPackages || [];
  const [view, setView] = useState<'product' | 'customer'>('product');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPackageId, setNewPackageId] = useState('');

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMessage(await work());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  /** Every line across every order, carrying its order for context. */
  const lines = useMemo(
    () => preorders.flatMap((preorder) => preorder.items.map((item) => ({ preorder, item }))),
    [preorders]
  );

  const byProduct = useMemo(() => {
    const map = new Map<string, { productName: string; quantity: number; rows: Array<{ preorder: Preorder; item: PreorderItem }> }>();
    for (const row of lines) {
      const entry = map.get(row.item.productId) || { productName: row.item.productName, quantity: 0, rows: [] };
      entry.quantity += row.item.quantity;
      entry.rows.push(row);
      map.set(row.item.productId, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].quantity - a[1].quantity);
  }, [lines]);

  const setItemStatus = (preorderId: string, itemId: string, status: PreorderItemStatus) =>
    run(async () => {
      await adminRequest(user, `/preorder/orders/${encodeURIComponent(preorderId)}/items/${encodeURIComponent(itemId)}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      return `Item moved to ${statusLabel(status)}.`;
    });

  const assignPackage = (preorderId: string, itemId: string, packageId: string) =>
    run(async () => {
      await adminRequest(user, `/preorder/orders/${encodeURIComponent(preorderId)}/items/${encodeURIComponent(itemId)}/package`, {
        method: 'PUT',
        body: JSON.stringify({ packageId }),
      });
      return `Item added to ${packageId}.`;
    });

  const ItemControls: React.FC<{ preorder: Preorder; item: PreorderItem }> = ({ preorder, item }) => {
    const openPackages = packages.filter((pkg) => !pkg.closed);
    // Only an item that has actually arrived in China can go in a box.
    const packable = item.status !== 'awaiting-order' && !item.packageId;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${inputClass} w-auto text-xs`}
          value={item.status}
          disabled={busy}
          onChange={(event) => void setItemStatus(preorder.preorderId, item.itemId, event.target.value as PreorderItemStatus)}
        >
          {ITEM_STATUSES.map((status) => (
            <option
              key={status.value}
              value={status.value}
              // Set on the package, so setting it here would let one item
              // disagree with the box it is inside.
              disabled={status.onPackage && status.value !== item.status}
            >
              {status.label}
            </option>
          ))}
        </select>

        {item.packageId ? (
          <span className="rounded-lg bg-[#edf5f3] px-2 py-1 text-[11px] font-black text-[#014040]">
            {item.packageId}
          </span>
        ) : packable && openPackages.length > 0 ? (
          <select
            className={`${inputClass} w-auto text-xs`}
            value=""
            disabled={busy}
            onChange={(event) => event.target.value && void assignPackage(preorder.preorderId, item.itemId, event.target.value)}
          >
            <option value="">Add to package…</option>
            {openPackages.map((pkg) => (
              <option key={pkg.packageId} value={pkg.packageId}>{pkg.label}</option>
            ))}
          </select>
        ) : (
          <span className="text-[11px] text-slate-400">
            {item.status === 'awaiting-order' ? 'Not in China yet' : 'No open package'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-[#014040]">Pre-orders</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          The first two statuses and the last are set per item. Received by shipping and
          Received in Ghana belong to the package and cascade to everything inside it.
        </p>
      </div>

      {/* Packages. */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black text-[#014040]">Packages</h3>
          <div className="flex gap-2">
            <input
              className={`${inputClass} w-44`}
              placeholder="Write this on the box"
              value={newPackageId}
              onChange={(event) => setNewPackageId(event.target.value)}
            />
            <button
              type="button"
              className={ghostButton}
              disabled={busy || !newPackageId.trim()}
              onClick={() =>
                void run(async () => {
                  await adminRequest(user, '/preorder/packages', {
                    method: 'POST',
                    body: JSON.stringify({ packageId: newPackageId.trim(), label: newPackageId.trim() }),
                  });
                  setNewPackageId('');
                  return 'Package created.';
                })
              }
            >
              <Plus className="h-4 w-4" />
              New package
            </button>
          </div>
        </div>

        {packages.length === 0 ? (
          <p className="text-xs text-slate-500">No packages yet.</p>
        ) : (
          <ul className="space-y-2">
            {packages.map((pkg) => {
              const contents = lines.filter((row) => row.item.packageId === pkg.packageId);
              return (
                <li key={pkg.packageId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                  <div>
                    <b className="text-sm text-[#014040]">{pkg.label}</b>
                    <p className="text-[11px] text-slate-500">
                      {contents.length} item{contents.length === 1 ? '' : 's'}
                      {pkg.closed ? ' · closed to new items' : ''}
                    </p>
                  </div>
                  <select
                    className={`${inputClass} w-auto text-xs`}
                    value={pkg.status}
                    disabled={busy}
                    onChange={(event) =>
                      void run(async () => {
                        const { itemsUpdated } = await adminRequest<{ itemsUpdated: number }>(
                          user,
                          `/preorder/packages/${encodeURIComponent(pkg.packageId)}/status`,
                          { method: 'PUT', body: JSON.stringify({ status: event.target.value }) }
                        );
                        return `${pkg.label} moved on. ${itemsUpdated} item${itemsUpdated === 1 ? '' : 's'} followed it.`;
                      })
                    }
                  >
                    {PACKAGE_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Which way round to read the orders. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView('product')}
          className={view === 'product' ? primaryButton : ghostButton}
        >
          <Boxes className="h-4 w-4" />
          By product
        </button>
        <button
          type="button"
          onClick={() => setView('customer')}
          className={view === 'customer' ? primaryButton : ghostButton}
        >
          <Users className="h-4 w-4" />
          By customer
        </button>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p>}
      {message && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</p>}

      {preorders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          No pre-orders yet.
        </div>
      ) : view === 'product' ? (
        <div className="space-y-3">
          {byProduct.map(([productId, entry]) => (
            <section key={productId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <header className="flex items-center justify-between gap-3 bg-[#f8fbfa] p-3">
                <b className="text-sm text-[#014040]">{entry.productName}</b>
                <span className="text-xs font-black text-[#025656]">{entry.quantity} to buy</span>
              </header>
              <ul className="divide-y divide-slate-100">
                {entry.rows.map(({ preorder, item }) => (
                  <li key={`${preorder.preorderId}-${item.itemId}`} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#014040]">
                        {item.quantity} x {item.selectionLabel || 'No variants'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {preorder.customer.name} · {preorder.customer.phone} · {preorder.preorderId}
                      </p>
                    </div>
                    <ItemControls preorder={preorder} item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {preorders.map((preorder) => (
            <section key={preorder.preorderId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-3 bg-[#f8fbfa] p-3">
                <div>
                  <b className="text-sm text-[#014040]">{preorder.customer.name}</b>
                  <p className="text-[11px] text-slate-500">
                    {preorder.customer.phone} · {preorder.customer.email} · {preorder.customer.location}
                  </p>
                </div>
                <div className="text-right">
                  <span className="block font-mono text-[11px] text-slate-500">{preorder.preorderId}</span>
                  <span className="text-xs font-black text-[#014040]">
                    {formatPesewas(preorder.items.reduce((sum, item) => sum + item.pricePesewas * item.quantity, 0))}
                  </span>
                </div>
              </header>
              <ul className="divide-y divide-slate-100">
                {preorder.items.map((item) => (
                  <li key={item.itemId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#014040]">
                        {item.quantity} x {item.productName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.selectionLabel || 'No variants'} · {item.delivery === 'express' ? 'Express' : 'Two months'} ·{' '}
                        {formatPesewas(item.pricePesewas * item.quantity)}
                      </p>
                    </div>
                    <ItemControls preorder={preorder} item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
