import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Plus } from 'lucide-react';
import type { Product } from '../../shared/types';
import { adminRequest } from './api';

export function SoftwareVersionList({ product, selectedId, onSelect, onAdd, user, reload }: {
  product: Product; selectedId?: string; onSelect: (id: string) => void;
  onAdd: () => void; user: User; reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const move = async (from: number, to: number) => {
    const expectedIds = product.variants.map(variant => variant.variantId);
    const orderedIds = [...expectedIds];
    const [id] = orderedIds.splice(from, 1);
    orderedIds.splice(to, 0, id);
    setBusy(true); setError(''); setNotice('');
    try {
      await adminRequest(user, `/products/${encodeURIComponent(product.productId)}/version-order`, {
        method: 'PUT', body: JSON.stringify({ orderedIds, expectedIds }),
      });
      await reload();
      setNotice('Version order saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save version order.'); }
    finally { setBusy(false); }
  };
  return <div className="ml-3 space-y-1 border-l-2 border-[#cbdcd9] pl-2" aria-busy={busy}>
    <button type="button" onClick={onAdd} className="my-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" />Add version</button>
    <p className="px-1 pb-1 text-[11px] text-slate-500">Storefront order · moves save immediately</p>
    {product.variants.map((variant, index) => {
      const selected = selectedId === variant.variantId;
      const label = `${product.productName} ${variant.versionOrPlan} · ${variant.os || 'All OS'}`;
      const moves = [
        { title: 'to top', target: 0, Icon: ArrowUpToLine },
        { title: 'up', target: index - 1, Icon: ArrowUp },
        { title: 'down', target: index + 1, Icon: ArrowDown },
        { title: 'to bottom', target: product.variants.length - 1, Icon: ArrowDownToLine },
      ];
      return <div key={variant.variantId} className="rounded-lg border border-slate-100">
        <button type="button" onClick={() => onSelect(variant.variantId)} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${selected ? 'bg-[#014040] font-black text-white' : 'hover:bg-slate-50'}`}>
          <span className="block truncate">{variant.versionOrPlan} · {variant.os || 'All OS'}</span>
          <small className={selected ? 'text-white/70' : variant.available ? 'text-emerald-700' : 'text-slate-400'}>{variant.available ? 'Visible' : 'Hidden'}{variant.latest ? ' · Latest' : ''}</small>
        </button>
        <div className="flex items-center justify-end gap-1 px-2 pb-1">
          <span className="mr-auto text-[10px] text-slate-500">Position {index + 1}</span>
          {moves.map(({ title, target, Icon }) => <button key={title} type="button" aria-label={`Move ${label} ${title}`} title={`Move ${title}`} disabled={busy || target < 0 || target >= product.variants.length || target === index} onClick={() => void move(index, target)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-[#014040] hover:bg-[#edf5f3] disabled:cursor-not-allowed disabled:opacity-30"><Icon className="h-3.5 w-3.5" /></button>)}
        </div>
      </div>;
    })}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    <p role="status" className="px-1 text-[11px] text-emerald-700">{busy ? 'Saving version order…' : notice}</p>
  </div>;
}
