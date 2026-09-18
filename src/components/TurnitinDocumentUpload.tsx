import React, { DragEvent, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, RefreshCw, UploadCloud } from 'lucide-react';
import { Order } from '../types';
import { FulfilmentTimeNotice } from './FulfilmentTimeNotice';

const ACCEPTED = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

function uploadContentType(file: File): string | undefined {
  if (ACCEPTED.has(file.type)) return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'doc') return 'application/msword';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return undefined;
}

function fileSize(bytes?: number): string {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function TurnitinDocumentUpload({ order, phone, onComplete }: { order: Order; phone: string; onComplete: (order: Order) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>(order.documentUploadedAt ? 'success' : 'idle');
  const [error, setError] = useState('');

  const upload = async (nextFile: File) => {
    setFile(nextFile); setError(''); setProgress(0);
    const contentType = uploadContentType(nextFile);
    if (!contentType) {
      setStatus('error'); setError('Choose a PDF or Word document (.pdf, .doc, or .docx).'); return;
    }
    setStatus('uploading');
    try {
      const authorize = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/document-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, sizeBytes: nextFile.size, originalName: nextFile.name, phone })
      });
      const authorization = await authorize.json();
      if (!authorize.ok) throw new Error(authorization.error || 'Unable to prepare the upload.');

      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('PUT', authorization.uploadUrl);
        request.setRequestHeader('Content-Type', contentType);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        };
        request.onerror = () => reject(new Error('The upload was interrupted. Check your connection and retry.'));
        request.onload = () => request.status >= 200 && request.status < 300
          ? resolve()
          : reject(new Error('Cloud storage rejected the upload. Please retry.'));
        request.send(nextFile);
      });

      const confirm = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, objectPath: authorization.objectPath, originalName: nextFile.name, phone })
      });
      const confirmation = await confirm.json();
      if (!confirm.ok || !confirmation.order) throw new Error(confirmation.error || 'The upload could not be confirmed.');
      setProgress(100); setStatus('success'); onComplete(confirmation.order);
    } catch (caught) {
      setStatus('error'); setError(caught instanceof Error ? caught.message : 'Upload failed. Please retry.');
    }
  };

  const choose = (list?: FileList | null) => { const chosen = list?.[0]; if (chosen) void upload(chosen); };
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files); };
  const receivedName = order.documentOriginalName || file?.name || 'Your document';
  const receivedSize = order.documentSizeBytes || file?.size;

  if (status === 'success' || order.documentUploadedAt || order.documentUploadStatus === 'uploaded') {
    return <div className="space-y-4"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><div className="flex items-center gap-2 text-base font-black"><CheckCircle2 className="h-6 w-6 text-[#0d6520]" />{order.documentUploadedAt ? 'Document received' : 'Upload complete'}</div><p className="mt-2 break-all text-sm font-bold">{receivedName}</p>{receivedSize ? <p className="mt-1 text-xs">{fileSize(receivedSize)}</p> : null}{order.fulfilmentStatus === 'ready' && <p className="mt-3 rounded-xl bg-[#014040] p-3 text-sm font-black text-white">Your report is ready.</p>}</div>{order.fulfilmentStatus !== 'ready' && order.showDeliveryNotice !== false && <FulfilmentTimeNotice kind="report" postUpload />}</div>;
  }

  return <section className="space-y-3">
    <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop} className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-[#05ef28] bg-[#eaffed]' : 'border-[#7aa39b] bg-[#f8fbfa]'}`}>
      <UploadCloud className="mx-auto h-10 w-10 text-[#014040]" /><h4 className="mt-3 text-lg font-black text-[#014040]">{dragging ? 'Release to upload' : 'Drop your document here'}</h4><p className="mt-1 text-xs text-slate-600">PDF, DOC, or DOCX</p>
      <button type="button" disabled={status === 'uploading'} onClick={() => inputRef.current?.click()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#05ef28] px-5 py-3 text-sm font-black text-[#014040] disabled:opacity-50"><FileText className="h-4 w-4" />Tap to upload</button>
      <input ref={inputRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { choose(event.target.files); event.currentTarget.value = ''; }} />
    </div>
    {file && <div className="rounded-xl border bg-white p-4"><div className="flex justify-between gap-3 text-xs"><span className="min-w-0 truncate font-bold">{status === 'uploading' ? `Uploading ${file.name}` : file.name}</span><span>{fileSize(file.size)}</span></div>{status === 'uploading' && <><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#05ef28] transition-[width]" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-right text-xs font-black text-[#014040]">{progress}%</p></>}</div>}
    {status === 'error' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"><p className="flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>{file && uploadContentType(file) && <button type="button" onClick={() => void upload(file)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 font-black"><RefreshCw className="h-3.5 w-3.5" />Retry upload</button>}</div>}
  </section>;
}
