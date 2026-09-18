import React, { useEffect, useState } from 'react';
import { ChevronDown, Clock3 } from 'lucide-react';
import { fulfilmentTimeState } from '../utils/fulfilmentTime';

type NoticeKind = 'licence' | 'account' | 'report';

export function fulfilmentNoticeHeadline({ kind, insideWindow, nextStartLocalTime, postUpload = false, beforePayment = false, customerInputLabel }: { kind: NoticeKind; insideWindow: boolean; nextStartLocalTime: string; postUpload?: boolean; beforePayment?: boolean; customerInputLabel?: string }) {
  const detail = customerInputLabel?.trim();
  if (beforePayment && insideWindow) {
    if (kind === 'report') return 'You are within our delivery window. Your report will be ready in 20 to 40 minutes if you order and submit your document now.';
    if (kind === 'account') return 'You are within our delivery window. Your account details will be added in 20 to 40 minutes if you order now.';
    return detail
      ? `You are within our delivery window. Your licence will be added in 20 to 40 minutes if you order now and submit your ${detail} in the next 30 minutes.`
      : 'You are within our delivery window. Your licence will be added in 20 to 40 minutes if you order now.';
  }
  if (beforePayment) {
    const action = kind === 'report'
      ? 'order and submit your document now'
      : detail
        ? `order now and submit your ${detail}`
        : 'order now';
    const subject = kind === 'account' ? 'account details' : kind === 'report' ? 'report' : 'licence';
    return `You are outside our current delivery window. If you ${action}, your ${subject} will be processed from 01:00 UTC+0 (${nextStartLocalTime} your time).`;
  }
  const subject = kind === 'account' ? 'account details' : kind === 'report' ? 'report' : 'licence';
  return insideWindow
    ? `Your ${subject} should be added in 20–40 minutes`
    : postUpload && kind === 'report'
      ? `Your report will be processed from 01:00 UTC+0 (${nextStartLocalTime} your time)`
      : `Orders placed now will be processed from 01:00 UTC+0 (${nextStartLocalTime} your time)`;
}

export function FulfilmentTimeNotice({ kind, postUpload = false, beforePayment = false, customerInputLabel }: { kind: NoticeKind; postUpload?: boolean; beforePayment?: boolean; customerInputLabel?: string }) {
  const [now, setNow] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const timing = fulfilmentTimeState(now);
  const localRange = `${timing.localRange}${timing.crossesMidnight ? ' (crosses midnight)' : ''}`;
  const headline = fulfilmentNoticeHeadline({ kind, insideWindow: timing.insideWindow, nextStartLocalTime: timing.nextStartLocalTime, postUpload, beforePayment, customerInputLabel });

  return <section className="rounded-2xl border border-amber-200 bg-[#fffaf0] p-4 text-[#014040]">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-[#05ef28]/20 p-2"><Clock3 className="h-5 w-5" /></span><div className="min-w-0"><p className="text-sm font-black sm:text-base">{headline}</p>{!beforePayment && <p className="mt-1 text-xs text-slate-600">{timing.insideWindow ? 'You are currently within our fulfilment hours.' : 'You are currently outside our normal fulfilment window.'}</p>}</div></div>
    <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#014040] underline decoration-[#05ef28] decoration-2 underline-offset-4">See delivery hours<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
    {expanded && <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-6 text-slate-700">Orders paid between <strong className="text-[#014040]">01:00–16:00 UTC+0</strong> ({localRange} in your local time) are normally processed within <strong className="text-[#014040]">20–40 minutes</strong> after payment and after any requested details are received. Orders paid outside this window are processed after the <strong className="text-[#014040]">next 01:00 UTC+0</strong> ({timing.nextStartLocalTime} your local time). Your local time is currently <strong className="rounded bg-[#05ef28]/25 px-1 text-[#014040]">{timing.currentLocalTime}</strong>.</p>}
  </section>;
}
