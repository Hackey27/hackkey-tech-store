import React from 'react';
import { ArrowRight, BookOpen, ExternalLink, Lightbulb } from 'lucide-react';
import { HackPost, hackLinkCount, hackOperatingSystem, hackPostPath } from '../../shared/hacks';
import { HackShareButton } from './HackShareButton';

export function HackPostCard({ post, theme, matchedStep, navigate }: { post: HackPost; theme?: string; matchedStep?: number; navigate: (path: string) => void }) {
  const open = () => navigate(`${hackPostPath(post.postId)}${matchedStep === undefined ? '' : `?step=${matchedStep}`}`);
  const links = hackLinkCount(post);
  return <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#d8e7e4] bg-white transition hover:border-[#014040] hover:shadow-lg">
    <button type="button" className="flex min-w-0 flex-1 flex-col p-5 text-left" onClick={open}>
      <span className="flex items-center justify-between gap-3"><span className="rounded-xl bg-[#edf5f3] p-3 text-[#014040]">{post.steps.length ? <BookOpen className="h-6 w-6" /> : links ? <ExternalLink className="h-6 w-6" /> : <Lightbulb className="h-6 w-6" />}</span><span className="text-xs font-bold text-[#025656]">{theme}</span></span>
      <h2 className="mt-5 text-lg font-black text-[#014040]">{post.title}</h2>
      {post.description && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{post.description}</p>}
      {matchedStep !== undefined && <p className="mt-3 rounded-lg bg-[#edf5f3] p-2 text-xs font-bold text-[#014040]">Matched step {matchedStep + 1}: {post.steps[matchedStep].title || post.steps[matchedStep].body.slice(0, 120)}</p>}
    </button>
    <div className="hk-brand-pattern hk-pattern-outline hk-hack-card-pattern relative bg-[#014040] p-5 text-white">
      <div className="flex flex-wrap gap-2 text-xs font-bold text-[#05ef28]"><span>{post.steps.length ? `${post.steps.length} steps` : 'Quick tip'}</span><span>· {hackOperatingSystem(post)}</span>{!!links && <span>· {links} tool {links === 1 ? 'link' : 'links'}</span>}</div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs"><span className="text-white/80">{new Date(post.createdAt).toLocaleDateString()}</span><button type="button" onClick={open} className="inline-flex items-center gap-1 font-black text-[#05ef28]">Open post<ArrowRight className="h-4 w-4" /></button></div>
      <div className="mt-3 border-t border-white/20 pt-3"><HackShareButton post={post} /></div>
    </div>
  </article>;
}
