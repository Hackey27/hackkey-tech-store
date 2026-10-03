import React from 'react';
import type { RmbPricingSettings } from '../../shared/types';
import { bankChargeBreakEvenPesewas, percentageBankChargePesewas, resolveBankChargeSettings } from '../../shared/bankCharges';
import { formatGhsCost } from '../../shared/money';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040]';
export function BankChargeModeFields({ settings, onChange }: { settings: RmbPricingSettings; onChange: (value: RmbPricingSettings) => void }) {
  const config = resolveBankChargeSettings(settings);
  const example = () => {
    try {
      const money = (pesewas: bigint) => formatGhsCost(Number(pesewas) / 100);
      const breakpoint = bankChargeBreakEvenPesewas(settings);
      return <div className="space-y-2 text-xs text-[#014040]"><p className="font-bold">{money(2500n)} → {money(percentageBankChargePesewas(2500n, settings))} · {money(100000n)} → {money(percentageBankChargePesewas(100000n, settings))}</p><p>{breakpoint === null ? 'No percentage crossover at a 0% rate; positive payments use the minimum.' : `Minimum/percentage break-even: approximately ${money(breakpoint)}`}{config.bankChargeMaximumGhs !== null && ` · capped at ${formatGhsCost(config.bankChargeMaximumGhs)}`}</p></div>;
    } catch (error) { return <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{(error as Error).message}</p>; }
  };
  return <div className="space-y-3">
    <div role="group" aria-label="Bank charge mode" className="flex flex-wrap gap-2">{([{ value: 'percentage_min', label: 'Percentage with minimum' }, { value: 'ranges', label: 'Fixed ranges' }] as const).map(mode => <button key={mode.value} type="button" aria-pressed={config.bankChargeMode === mode.value} className={`rounded-xl border px-3 py-2 text-xs font-bold ${config.bankChargeMode === mode.value ? 'border-[#014040] bg-[#014040] text-white' : 'border-slate-300 bg-white text-[#014040]'}`} onClick={() => onChange({ ...settings, bankChargeMode: mode.value })}>{mode.label}</button>)}</div>
    {config.bankChargeMode === 'percentage_min' && <>
      <p className="text-xs text-slate-600">Charge = rate × converted cost incl. transaction fee, never below the minimum.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-bold">Rate (%)<input className={input} type="number" min="0" max="100" step="0.01" value={Number.isFinite(config.bankChargeRateBps) ? config.bankChargeRateBps / 100 : ''} onChange={event => { const value = event.target.value === '' ? NaN : Number(event.target.value); onChange({ ...settings, bankChargeRateBps: Number(value.toFixed(2)) === value ? Math.round(value * 100) : value * 100 }); }} /></label>
        <label className="space-y-1 text-xs font-bold">Minimum (GHS)<input className={input} type="number" min="0" step="0.01" value={Number.isFinite(config.bankChargeMinimumGhs) ? config.bankChargeMinimumGhs : ''} onChange={event => onChange({ ...settings, bankChargeMinimumGhs: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
        <label className="space-y-1 text-xs font-bold">Maximum (GHS) — optional<input className={input} type="number" min={config.bankChargeMinimumGhs || 0} step="0.01" placeholder="No cap" value={config.bankChargeMaximumGhs ?? ''} onChange={event => onChange({ ...settings, bankChargeMaximumGhs: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      </div>
      {example()}
    </>}
  </div>;
}
