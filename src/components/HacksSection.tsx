import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, ExternalLink, Layers, Lightbulb, RefreshCw } from 'lucide-react';
import { emptyHacksFilters, filterHackPosts, HackPost, hackMatchedStep, HacksCatalogue, cleanLaptopIssue } from '../../shared/hacks';
import { StoreDialog } from './StoreDialog';
import { GuideImage } from './GuideImage';
import { HacksFilterStrip } from './HacksFilterStrip';

const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#014040] bg-white px-4 py-2.5 text-sm font-bold text-[#014040] disabled:opacity-40';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-[#05ef28] disabled:opacity-40';
const input = 'w-full rounded-xl border border-[#bdd1cc] bg-white px-4 py-3 text-sm outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#014040]/10';
const textOf = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';

function HackPostDialog({ post, theme, initialStep, onClose }: { post: HackPost; theme?: string; initialStep: number; onClose: () => void }) {
  const [stepsOpen, setStepsOpen] = useState(false), [stepIndex, setStepIndex] = useState(Math.min(Math.max(0, initialStep), Math.max(0, post.steps.length - 1)));
  const step = post.steps[stepIndex];
  return <StoreDialog floating title={post.title} close={onClose}>
    <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#025656]">{theme} · {new Date(post.createdAt).toLocaleDateString()} · {post.views} views</p>
    {post.description && <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 sm:text-base">{post.description}</p>}
    {!!post.links.length && <div className="mt-6 flex flex-wrap gap-3">{post.links.map((link, index) => <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className={primary}>{link.label}<ExternalLink className="h-4 w-4" /></a>)}</div>}
    {!!post.steps.length && <button type="button" className={`${button} mt-6`} aria-expanded={stepsOpen} onClick={() => setStepsOpen(!stepsOpen)}><BookOpen className="h-4 w-4" />{stepsOpen ? 'Close steps' : 'Open steps'} · {post.steps.length}</button>}
    {stepsOpen && step && <section className="mt-5 space-y-5 rounded-2xl border border-[#d8e7e4] bg-[#f8fbfa] p-4 sm:p-6" aria-label="Tutorial steps">
      <div aria-live="polite"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Step {stepIndex + 1} of {post.steps.length}</p><h3 className="mt-2 text-xl font-black text-[#014040]">{step.title || `Step ${stepIndex + 1}`}</h3></div>
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{step.body}</p>
      {step.images?.map(picture => <GuideImage key={picture.src} picture={picture} />)}
      <div className="flex items-center justify-between gap-3"><button type="button" disabled={stepIndex === 0} className={button} onClick={() => setStepIndex(index => index - 1)}><ArrowLeft className="h-4 w-4" />Previous</button>{stepIndex < post.steps.length - 1 ? <button type="button" className={primary} onClick={() => setStepIndex(index => index + 1)}>Next step<ArrowRight className="h-4 w-4" /></button> : <button type="button" className={primary} onClick={() => setStepsOpen(false)}>Finish steps<CheckCircle2 className="h-4 w-4" /></button>}</div>
    </section>}
  </StoreDialog>;
}

function LaptopIssueForm({ back }: { back: () => void }) {
  const [fields, setFields] = useState({ customerName: '', phone: '', email: '', laptopBrand: '', model: '', operatingSystem: '', issue: '', attempts: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reference, setReference] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      cleanLaptopIssue(fields); setBusy(true);
      const response = await fetch('/api/requests/laptop-issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not submit the issue.'); setReference(result.requestId);
    } catch (error) { setError(textOf(error)); } finally { setBusy(false); }
  };
  if (reference) return <section className="mx-auto max-w-2xl rounded-3xl border bg-white p-6 text-center sm:p-10" role="status"><CheckCircle2 className="mx-auto h-12 w-12 text-[#00d082]" /><h1 className="mt-5 text-2xl font-black text-[#014040]">Your issue has been submitted</h1><p className="mt-4 text-sm leading-7 text-slate-600">We will get back to you as soon as we can to help you resolve it, if possible.</p><p className="mt-3 text-xs font-bold text-slate-500">Reference: {reference}</p><button type="button" className={`${primary} mt-6`} onClick={back}>All Hacks</button></section>;
  return <section className="mx-auto max-w-3xl rounded-3xl border bg-white p-5 sm:p-8"><button type="button" className={button} onClick={back}><ArrowLeft className="h-4 w-4" />All Hacks</button><h1 className="mt-6 text-2xl font-black text-[#014040]">Submit an issue</h1><p className="mt-2 text-sm leading-6 text-slate-600">Tell us what is happening with your laptop and how to reach you. We will do our best to help.</p>
    <form onSubmit={event => void submit(event)} className="mt-6 space-y-5"><div className="grid gap-4 sm:grid-cols-2">{([['customerName', 'Your name', true], ['phone', 'Phone / WhatsApp number', true], ['email', 'Email (optional)', false], ['laptopBrand', 'Laptop brand (optional)', false], ['model', 'Model (optional)', false], ['operatingSystem', 'Operating system (optional)', false]] as const).map(([key, label, required]) => <label key={key} className="space-y-2 text-xs font-bold text-[#014040]">{label}<input required={required} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} maxLength={key === 'customerName' ? 120 : 200} className={input} value={fields[key]} onChange={event => setFields({ ...fields, [key]: event.target.value })} /></label>)}</div>
      <label className="block space-y-2 text-xs font-bold text-[#014040]">Describe the issue<textarea required maxLength={8000} rows={6} className={input} value={fields.issue} onChange={event => setFields({ ...fields, issue: event.target.value })} /></label>
      <label className="block space-y-2 text-xs font-bold text-[#014040]">What have you tried? (optional)<textarea maxLength={4000} rows={3} className={input} value={fields.attempts} onChange={event => setFields({ ...fields, attempts: event.target.value })} /></label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}<button disabled={busy} className={primary}>{busy ? 'Submitting…' : 'Submit issue'}</button>
    </form>
  </section>;
}

export function HacksSection({ query, path, navigate, browseRevision = 0 }: { query: string; path: string; navigate: (path: string) => void; browseRevision?: number }) {
  const [catalogue, setCatalogue] = useState<HacksCatalogue>({ themes: [], posts: [] }), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyHacksFilters);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const response = await fetch('/api/hacks'); if (!response.ok) throw new Error('Could not load tips and tools.'); setCatalogue(await response.json()); } catch (error) { setError(textOf(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setFilters(emptyHacksFilters()); }, [browseRevision]);
  const postId = path.match(/^\/hacks\/posts\/([^/]+)\/?$/)?.[1];
  const selected = catalogue.posts.find(post => post.postId === postId);
  useEffect(() => {
    if (!selected) return;
    const key = `hk-hack-view:${selected.postId}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* counts work without browser storage */ }
    let active = true;
    void fetch(`/api/hacks/posts/${encodeURIComponent(selected.postId)}/view`, { method: 'POST' }).then(async response => { if (response.ok && response.status !== 204) { const result = await response.json(); if (active) setCatalogue(current => ({ ...current, posts: current.posts.map(post => post.postId === selected.postId ? { ...post, views: result.views } : post) })); } }).catch(() => undefined);
    return () => { active = false; };
  }, [selected?.postId]);
  const results = useMemo(() => filterHackPosts(catalogue, query, filters), [catalogue, query, filters]);
  const count = (themeId: string) => catalogue.posts.filter(post => post.themeId === themeId).length;
  const categories = /^\/hacks\/categories\/?$/.test(path), issue = /^\/hacks\/issue\/?$/.test(path);
  if (issue) return <LaptopIssueForm back={() => navigate('/hacks')} />;
  return <div className="min-w-0 pb-8">
    <header className="hk-category-title hk-activation-gradient relative rounded-3xl p-6 text-white sm:p-9"><span className="hk-category-pattern-fade" aria-hidden="true"><span className="hk-category-solid-pattern" /></span><h1 className="relative text-2xl font-black sm:text-4xl">Hack-this</h1><p className="relative mt-3 max-w-2xl text-sm leading-7 sm:text-base">Tech tips, useful tools and step-by-step fixes for your computer and everyday work.</p><p className="relative mt-3 text-sm">{catalogue.posts.length} posts · {catalogue.themes.length} themes</p></header>
    <nav aria-label="Themes" className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 text-sm font-bold text-[#014040]"><button type="button" className={`shrink-0 rounded-xl px-3 py-2 ${!filters.themeId && !categories ? 'bg-[#014040] text-[#05ef28]' : 'bg-white'}`} onClick={() => { setFilters({ ...filters, themeId: '' }); if (categories) navigate('/hacks'); }}>All</button>{catalogue.themes.map(theme => <React.Fragment key={theme.themeId}><ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /><button type="button" className={`shrink-0 rounded-xl px-3 py-2 ${filters.themeId === theme.themeId && !categories ? 'bg-[#014040] text-[#05ef28]' : 'bg-white'}`} onClick={() => { setFilters({ ...filters, themeId: theme.themeId }); if (categories) navigate('/hacks'); }}>{theme.name}</button></React.Fragment>)}</nav>
    {!categories && <HacksFilterStrip themes={catalogue.themes} filters={filters} onChange={setFilters} />}
    {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading tips and tools…</p> : error ? <div role="alert" className="mt-6 rounded-2xl border bg-white p-6"><p>{error}</p><button className={`${button} mt-4`} onClick={() => void load()}><RefreshCw className="h-4 w-4" />Try again</button></div> : categories ? <section className="mt-6"><h2 className="text-xl font-black text-[#014040]">Categories</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{catalogue.themes.map(theme => <button key={theme.themeId} type="button" className="rounded-2xl border border-[#d8e7e4] bg-white p-6 text-left hover:border-[#014040]" onClick={() => { setFilters({ ...emptyHacksFilters(), themeId: theme.themeId }); navigate('/hacks'); }}><Layers className="h-6 w-6 text-[#00d082]" /><h3 className="mt-4 text-lg font-black text-[#014040]">{theme.name}</h3><p className="mt-2 text-sm text-slate-600">{theme.description}</p><p className="mt-4 text-sm font-bold text-[#014040]">{count(theme.themeId)} {count(theme.themeId) === 1 ? 'post' : 'posts'}</p></button>)}</div>{!catalogue.themes.length && <p className="mt-4 text-sm text-slate-500">Themes will appear here when published.</p>}</section> : <>
      <p aria-live="polite" className="mt-4 text-xs font-bold text-[#014040]">{results.length} {results.length === 1 ? 'result' : 'results'}{query.trim() ? ` for “${query.trim()}”` : ''}</p>
      <section aria-label="Tips and tools" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.map(post => { const matchedStep = hackMatchedStep(post, query); return <button key={post.postId} type="button" className="group flex flex-col rounded-2xl border border-[#d8e7e4] bg-white p-5 text-left transition hover:border-[#014040] hover:shadow-lg" onClick={() => navigate(`/hacks/posts/${encodeURIComponent(post.postId)}${matchedStep === undefined ? '' : `?step=${matchedStep}`}`)}><span className="flex items-center justify-between gap-3"><span className="rounded-xl bg-[#edf5f3] p-3 text-[#014040]">{post.steps.length ? <BookOpen className="h-6 w-6" /> : post.links.length ? <ExternalLink className="h-6 w-6" /> : <Lightbulb className="h-6 w-6" />}</span><span className="text-xs font-bold text-[#025656]">{catalogue.themes.find(theme => theme.themeId === post.themeId)?.name}</span></span><h2 className="mt-5 text-lg font-black text-[#014040]">{post.title}</h2>{post.description && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{post.description}</p>}{matchedStep !== undefined && <p className="mt-3 rounded-lg bg-[#edf5f3] p-2 text-xs font-bold text-[#014040]">Matched step {matchedStep + 1}: {post.steps[matchedStep].title || post.steps[matchedStep].body.slice(0, 120)}</p>}<span className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500"><span>{post.steps.length ? `${post.steps.length} steps` : 'Quick tip'}</span>{!!post.links.length && <span>· {post.links.length} tool {post.links.length === 1 ? 'link' : 'links'}</span>}</span><span className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-slate-500"><span>{new Date(post.createdAt).toLocaleDateString()}</span><span className="inline-flex items-center gap-1 font-black text-[#014040]">Open post<ArrowRight className="h-4 w-4" /></span></span></button>; })}</section>
      {!results.length && <section className="mt-6 rounded-2xl border bg-white p-8 text-center"><Lightbulb className="mx-auto h-8 w-8 text-[#00d082]" /><h2 className="mt-4 font-black text-[#014040]">{catalogue.posts.length ? 'No matching tips or tools' : 'Tips and tools are coming soon'}</h2><p className="mt-2 text-sm text-slate-500">{catalogue.posts.length ? 'Try different words, themes or filters.' : 'Published posts will appear here.'}</p></section>}
    </>}
    {postId && !loading && !error && !selected && <StoreDialog floating title="Post unavailable" close={() => navigate('/hacks')}><p className="text-sm text-slate-600">This post is not published. Browse the available tips and tools.</p></StoreDialog>}
    {selected && <HackPostDialog key={selected.postId} post={selected} theme={catalogue.themes.find(theme => theme.themeId === selected.themeId)?.name} initialStep={Number(new URLSearchParams(window.location.search).get('step')) || 0} onClose={() => navigate('/hacks')} />}
  </div>;
}
