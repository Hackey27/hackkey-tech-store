import React, { useState } from 'react';
import { Download, FileCheck2 } from 'lucide-react';
import { Order } from '../types';

export function TurnitinReportDownloads({ order, phone }: { order: Order; phone: string }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const reports = order.reportDocuments || [];
  if (!reports.length) return null;

  const download = async (reportId: string) => {
    setBusy(reportId); setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/reports/${encodeURIComponent(reportId)}?phone=${encodeURIComponent(phone)}`);
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || 'Unable to prepare the download.');
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to download the report.');
    } finally { setBusy(''); }
  };

  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
    <div className="flex items-center gap-2 text-[#014040]"><FileCheck2 className="h-5 w-5" /><h4 className="font-black">Your Turnitin reports</h4></div>
    <div className="mt-3 space-y-2">{reports.map((report) => <div key={report.reportId} className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-bold text-slate-900">{report.label}</p><p className="truncate text-xs text-slate-500">{report.originalName} · {new Date(report.uploadedAt).toLocaleString()}</p></div><button type="button" disabled={Boolean(busy)} onClick={() => void download(report.reportId)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#014040] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Download className="h-4 w-4" />{busy === report.reportId ? 'Preparing…' : 'Download'}</button></div>)}</div>
    {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
  </section>;
}
