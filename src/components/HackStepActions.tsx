import React, { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { HackStep } from '../../shared/hacks';

export function HackStepActions({ step }: { step: HackStep }) {
  const [copied, setCopied] = useState(false), [error, setError] = useState('');
  const copy = async () => {
    setCopied(false); setError('');
    try { await navigator.clipboard.writeText(step.copyText!); setCopied(true); }
    catch { setError('Could not copy automatically. Select and copy the text below instead.'); }
  };
  return <div className="min-w-0 space-y-4">
    {step.copyText && <div className="min-w-0 rounded-xl border border-[#bdd1cc] bg-white p-4"><pre className="max-w-full whitespace-pre-wrap break-words rounded-lg bg-[#edf5f3] p-3 font-mono text-sm text-[#014040] [overflow-wrap:anywhere]">{step.copyText}</pre><button type="button" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#014040] px-4 py-2 text-sm font-bold text-[#05ef28]" onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</button>{copied && <p role="status" className="mt-2 text-xs text-[#014040]">Text copied to your clipboard.</p>}{error && <p role="alert" className="mt-2 text-xs text-rose-800">{error}</p>}</div>}
    {step.actionLabel && step.actionUrl && <a href={step.actionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-xl bg-[#014040] px-4 py-3 text-sm font-bold text-[#05ef28] [overflow-wrap:anywhere]">{step.actionLabel}<ExternalLink className="h-4 w-4 shrink-0" /></a>}
  </div>;
}
