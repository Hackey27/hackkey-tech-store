import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowDown, ArrowUp, BookOpen, Link, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import type { HackPost, HackStep, HacksCatalogue, HackTheme } from '../../shared/hacks';
import { adminRequest } from './api';
import { GuideStepScreenshotsEditor } from './GuideScreenshotsEditor';

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040]';
const label = 'block space-y-1 text-xs font-bold text-slate-700';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#bdd1cc] bg-white px-3 py-2 text-xs font-bold text-[#014040] disabled:opacity-40';
const primary = 'rounded-xl border border-[#014040] bg-[#014040] px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Could not save the changes.';

export function HacksSetupSection({ user, refreshToken }: { user: User; refreshToken?: unknown }) {
  const [data, setData] = useState<HacksCatalogue>({ themes: [], posts: [] });
  const [theme, setTheme] = useState<HackTheme | null>(null);
  const [post, setPost] = useState<HackPost | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState('');
  const load = useCallback(async () => { setLoading(true); try { setData(await adminRequest<HacksCatalogue>(user, '/hacks')); } catch (error) { setMessage(errorText(error)); } finally { setLoading(false); } }, [user]);
  useEffect(() => { void load(); }, [load, refreshToken]);
  const selectTheme = (value: HackTheme) => { setTheme(structuredClone(value)); setPost(null); setMessage(''); };
  const selectPost = (value: HackPost) => { setPost(structuredClone(value)); setTheme(null); setMessage(''); };
  const addTheme = () => selectTheme({ themeId: `THEME-${crypto.randomUUID()}`, name: '', description: '', active: false, sortOrder: 100 });
  const addPost = (themeId: string) => selectPost({ postId: `HACK-${crypto.randomUUID()}`, themeId, title: '', description: '', active: false, steps: [], links: [], createdAt: '', updatedAt: '', views: 0 });
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      if (post) { const result = await adminRequest<{ post: HackPost }>(user, `/hacks/posts/${post.postId}`, { method: 'PUT', body: JSON.stringify(post) }); setPost(result.post); }
      else if (theme) { const result = await adminRequest<{ theme: HackTheme }>(user, `/hacks/themes/${theme.themeId}`, { method: 'PUT', body: JSON.stringify(theme) }); setTheme(result.theme); }
      await load(); setMessage('Saved. Published posts appear only under published themes.');
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  };
  const setStep = (index: number, patch: Partial<HackStep>) => setPost(current => current && ({ ...current, steps: current.steps.map((step, position) => position === index ? { ...step, ...patch } : step) }));
  const moveStep = (index: number, delta: number) => setPost(current => {
    if (!current) return current;
    const steps = [...current.steps]; [steps[index], steps[index + delta]] = [steps[index + delta], steps[index]];
    return { ...current, steps };
  });
  const savedPost = !!post && data.posts.some(value => value.postId === post.postId);
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-[#014040]">Hack-this</h2><p className="mt-1 text-sm text-slate-600">Set up themes, tips, tutorials and helpful tools. Submitted laptop issues appear in Requests.</p></div><button type="button" className={button} onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" />Refresh</button></header>
    {message && <p role="status" className="rounded-xl bg-[#edf5f3] p-4 text-sm font-bold text-[#014040]">{message}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-3 rounded-2xl border bg-white p-3">
        <button type="button" className={`${primary} w-full`} onClick={addTheme}><Plus className="h-4 w-4" />Add theme</button>
        {loading && <p className="p-2 text-sm text-slate-500">Loading themes…</p>}
        {!loading && !data.themes.length && <p className="p-2 text-sm text-slate-500">Create a theme to start adding posts.</p>}
        {data.themes.map(item => <details key={item.themeId} open className="rounded-xl border border-[#d8e7e4] bg-[#f8fbfa] p-2">
          <summary className="cursor-pointer text-sm font-black text-[#014040]">{item.name} <span className="font-normal text-slate-500">({data.posts.filter(post => post.themeId === item.themeId).length})</span></summary>
          <button type="button" className={`${button} mt-2 w-full`} onClick={() => selectTheme(item)}>Edit theme · {item.active ? 'Published' : 'Hidden'}</button>
          <div className="mt-2 space-y-1">{data.posts.filter(post => post.themeId === item.themeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => <button key={item.postId} type="button" className={`w-full rounded-lg p-3 text-left text-sm ${post?.postId === item.postId ? 'bg-[#014040] text-white' : 'hover:bg-[#edf5f3]'}`} onClick={() => selectPost(item)}><b className="block">{item.title}</b><small>{item.active ? 'Published' : 'Hidden'} · {item.steps.length} steps · {item.views} views</small></button>)}</div>
          <button type="button" className={`${button} mt-2 w-full`} onClick={() => addPost(item.themeId)}><Plus className="h-4 w-4" />Add post</button>
        </details>)}
      </aside>
      <main className="min-w-0 space-y-4">
        {!theme && !post && <p className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Choose a theme or post, or add a new theme.</p>}
        {theme && <form className="space-y-4 rounded-2xl border bg-white p-5" onSubmit={event => { event.preventDefault(); void save(); }}>
          <h3 className="text-xl font-black text-[#014040]">{data.themes.some(item => item.themeId === theme.themeId) ? 'Edit theme' : 'Add theme'}</h3>
          <label className={label}>Theme name<input required maxLength={100} className={input} value={theme.name} onChange={event => setTheme({ ...theme, name: event.target.value })} /></label>
          <label className={label}>Description<textarea maxLength={1000} rows={3} className={input} value={theme.description} onChange={event => setTheme({ ...theme, description: event.target.value })} /></label>
          <label className={label}>Display order<input className={input} type="number" min={0} value={theme.sortOrder} onChange={event => setTheme({ ...theme, sortOrder: Number(event.target.value) })} /></label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={theme.active} onChange={event => setTheme({ ...theme, active: event.target.checked })} />Publish theme</label>
          <button disabled={busy} className={primary}><Save className="h-4 w-4" />Save theme</button>
        </form>}
        {post && <form className="space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}>
          <section className="space-y-4 rounded-2xl border bg-white p-5">
            <header className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black text-[#014040]">{savedPost ? 'Edit post' : 'Add post'}</h3><button disabled={busy} className={primary}><Save className="h-4 w-4" />Save post</button></header>
            <label className={label}>Title<input required maxLength={160} className={input} value={post.title} onChange={event => setPost({ ...post, title: event.target.value })} /></label>
            <label className={label}>Theme<select required className={input} value={post.themeId} onChange={event => setPost({ ...post, themeId: event.target.value })}>{data.themes.map(theme => <option key={theme.themeId} value={theme.themeId}>{theme.name}{theme.active ? '' : ' (hidden)'}</option>)}</select></label>
            <label className={label}>Message / description<textarea rows={6} maxLength={12000} className={input} value={post.description} onChange={event => setPost({ ...post, description: event.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={post.active} onChange={event => setPost({ ...post, active: event.target.checked })} />Publish post</label>
            {data.themes.find(theme => theme.themeId === post.themeId)?.active === false && <p className="text-xs text-amber-800">Publish this theme too for customers to see the post.</p>}
          </section>
          <section className="space-y-4 rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black text-[#014040]">Tutorial</h3><button type="button" className={button} disabled={post.steps.length >= 60} onClick={() => setPost({ ...post, steps: [...post.steps, { body: '' }] })}><BookOpen className="h-4 w-4" />{post.steps.length ? 'Add step' : 'Add tutorial'}</button></div>
            {!savedPost && <p className="text-xs text-slate-500">Save the post before uploading tutorial images. Titles on steps are optional.</p>}
            {post.steps.map((step, index) => <section key={`${post.postId}-${index}`} className="space-y-3 rounded-xl border bg-[#f8fbfa] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-black text-[#014040]">Step {index + 1}</h4><div className="flex gap-1"><button type="button" aria-label={`Move step ${index + 1} up`} className={button} disabled={index === 0} onClick={() => moveStep(index, -1)}><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label={`Move step ${index + 1} down`} className={button} disabled={index === post.steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown className="h-4 w-4" /></button><button type="button" className={button} onClick={() => setPost({ ...post, steps: post.steps.filter((_, position) => position !== index) })}><Trash2 className="h-4 w-4" />Remove step</button></div></div>
              <label className={label}>Step title (optional)<input maxLength={120} className={input} value={step.title || ''} onChange={event => setStep(index, { title: event.target.value })} /></label>
              <label className={label}>Step description<textarea required maxLength={4000} rows={4} className={input} value={step.body} onChange={event => setStep(index, { body: event.target.value })} /></label>
              <GuideStepScreenshotsEditor key={`${post.postId}-${index}`} productId={post.postId} user={user} images={step.images || []} uploadsEnabled={savedPost} uploadPath={`/hacks/posts/${post.postId}/images`} onChange={images => setStep(index, { images })} />
            </section>)}
          </section>
          <section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black text-[#014040]">Tool links</h3><button type="button" className={button} disabled={post.links.length >= 20} onClick={() => setPost({ ...post, links: [...post.links, { label: '', url: '' }] })}><Link className="h-4 w-4" />Add link button</button></div>
            {post.links.map((link, index) => <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className={label}>Button label<input required maxLength={80} className={input} value={link.label} onChange={event => setPost({ ...post, links: post.links.map((link, position) => position === index ? { ...link, label: event.target.value } : link) })} /></label><label className={label}>Tool URL<input required type="url" maxLength={2048} placeholder="https://..." className={input} value={link.url} onChange={event => setPost({ ...post, links: post.links.map((link, position) => position === index ? { ...link, url: event.target.value } : link) })} /></label><button type="button" aria-label={`Remove link ${index + 1}`} className={button} onClick={() => setPost({ ...post, links: post.links.filter((_, position) => position !== index) })}><Trash2 className="h-4 w-4" /></button></div>)}
          </section>
          <button disabled={busy} className={primary}><Save className="h-4 w-4" />Save post and tutorial</button>
        </form>}
      </main>
    </div>
  </div>;
}
