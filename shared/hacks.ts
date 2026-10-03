import type { InstallationGuideImageConfig } from './types';

export interface HackTheme {
  themeId: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
}
export const HACK_OPERATING_SYSTEMS = ['General', 'Windows', 'macOS', 'Android'] as const;
export type HackOperatingSystem = typeof HACK_OPERATING_SYSTEMS[number];
export interface HackStep {
  title?: string;
  body: string;
  images?: InstallationGuideImageConfig[];
  copyText?: string;
  actionLabel?: string;
  actionUrl?: string;
}
export interface HackPost {
  operatingSystem?: HackOperatingSystem;
  postId: string;
  themeId: string;
  title: string;
  description: string;
  active: boolean;
  steps: HackStep[];
  links: Array<{ label: string; url: string }>;
  createdAt: string;
  updatedAt: string;
  views: number;
}
export interface HacksCatalogue { themes: HackTheme[]; posts: HackPost[] }
export type HacksSort = 'popular' | 'newest' | 'oldest' | 'with-steps' | 'without-steps';
export interface HacksFilters { themeId: string; sort: HacksSort; links: 'all' | 'with-links' | 'without-links'; os: 'All' | HackOperatingSystem }
export const emptyHacksFilters = (): HacksFilters => ({ themeId: '', sort: 'newest', links: 'all', os: 'All' });
const trimmed = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const id = (value: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,69}$/.test(value);
export function hackImagePrefix(postId: string) { return `catalogue/hacks-${postId}/guide/`; }

export function cleanHackTheme(themeId: string, input: HackTheme): HackTheme {
  const name = trimmed(input?.name), description = trimmed(input?.description);
  if (!id(themeId) || !name || name.length > 100 || description.length > 1000) throw new Error('Theme needs a valid ID and a name of up to 100 characters. Description can be up to 1,000 characters.');
  return { themeId, name, description, active: input.active === true, sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 100 };
}

export function cleanHackPost(postId: string, input: HackPost): Omit<HackPost, 'createdAt' | 'updatedAt' | 'views'> {
  const title = trimmed(input?.title), description = trimmed(input?.description), themeId = trimmed(input?.themeId);
  if (!id(postId) || !id(themeId) || !title || title.length > 160 || description.length > 12000) throw new Error('Post needs a theme and title (up to 160 characters). Message can be up to 12,000 characters.');
  if (!Array.isArray(input.steps) || input.steps.length > 60 || !Array.isArray(input.links) || input.links.length > 20) throw new Error('A post can have up to 60 steps and 20 tool links.');
  const operatingSystem = input.operatingSystem ?? 'General';
  if (!HACK_OPERATING_SYSTEMS.includes(operatingSystem)) throw new Error('Choose General, Windows, macOS or Android for the tutorial OS.');
  const links = input.links.map(link => {
    const label = trimmed(link?.label), url = trimmed(link?.url);
    if (!label || label.length > 80 || !url || url.length > 2048) throw new Error('Every tool link needs a label and URL.');
    try { if (new URL(url).protocol !== 'https:') throw new Error(); }
    catch { throw new Error('Tool links must use HTTPS.'); }
    return { label, url };
  });
  const steps = input.steps.map((step, index): HackStep => {
    const stepTitle = trimmed(step?.title), body = trimmed(step?.body);
    if (stepTitle.length > 120 || !body || body.length > 4000) throw new Error(`Step ${index + 1} needs a description (up to 4,000 characters). Its title is optional.`);
    if (step.images && (!Array.isArray(step.images) || step.images.length > 6)) throw new Error(`Step ${index + 1} can have up to six images.`);
    const copyText = typeof step.copyText === 'string' ? step.copyText : '';
    if ((step.copyText !== undefined && typeof step.copyText !== 'string') || copyText.length > 4000) throw new Error(`Step ${index + 1}: copy text must be up to 4,000 characters.`);
    const actionLabel = trimmed(step.actionLabel), actionUrl = trimmed(step.actionUrl);
    if (actionLabel || actionUrl) {
      if (!actionLabel || actionLabel.length > 80 || !actionUrl || actionUrl.length > 2048) throw new Error(`Step ${index + 1}: the link button needs a label and URL.`);
      try { if (new URL(actionUrl).protocol !== 'https:') throw new Error(); }
      catch { throw new Error(`Step ${index + 1}: link buttons must use HTTPS.`); }
    }
    const images = step.images?.map(image => {
      const src = trimmed(image?.src), alt = trimmed(image?.alt);
      const prefix = hackImagePrefix(postId);
      if (!src.startsWith(prefix) || src.slice(prefix.length).includes('/') || src.includes('..') || !/\.(webp|png|jpg)$/.test(src) || !alt || alt.length > 200) throw new Error(`Step ${index + 1} has an invalid image. Upload images to this post and provide a description.`);
      if (image.markers && (!Array.isArray(image.markers) || image.markers.length > 20)) throw new Error('An image can have up to 20 click markers.');
      const markers = image.markers?.map(marker => {
        const label = trimmed(marker?.label);
        if (!Number.isFinite(marker?.x) || !Number.isFinite(marker?.y) || marker.x < 0 || marker.x > 100 || marker.y < 0 || marker.y > 100 || !label || label.length > 80) throw new Error('Click markers need a label and a position within the image.');
        return { x: marker.x, y: marker.y, label };
      });
      return { src, alt, ...(markers?.length ? { markers } : {}) };
    });
    return { ...(stepTitle ? { title: stepTitle } : {}), body, ...(copyText.trim() ? { copyText } : {}), ...(actionLabel ? { actionLabel, actionUrl } : {}), ...(images?.length ? { images } : {}) };
  });
  if (!description && !steps.length && !links.length) throw new Error('Add a message, tutorial or tool link to the post.');
  const result = { postId, themeId, title, description, operatingSystem, active: input.active === true, steps, links };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 90000) throw new Error('This post is too large. Shorten the tutorial or split it into separate posts.');
  return result;
}

export const hackOperatingSystem = (post: HackPost): HackOperatingSystem => HACK_OPERATING_SYSTEMS.includes(post.operatingSystem!) ? post.operatingSystem! : 'General';
export const hackLinkCount = (post: HackPost) => post.links.length + post.steps.filter(step => step.actionUrl).length;
export const hackPostPath = (postId: string) => `/hacks/posts/${encodeURIComponent(postId)}`;
export const hackStepSearchText = (step: HackStep) => [step.title, step.body, step.copyText, step.actionLabel, step.actionUrl, ...(step.images || []).flatMap(image => [image.alt, ...(image.markers || []).map(marker => marker.label)])].join(' ');
export function publicHacks(themes: HackTheme[], posts: HackPost[]): HacksCatalogue {
  const visibleThemes = themes.filter(theme => theme.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const themeIds = new Set(visibleThemes.map(theme => theme.themeId));
  return { themes: visibleThemes, posts: posts.filter(post => post.active && themeIds.has(post.themeId)).map(post => ({ ...post, operatingSystem: hackOperatingSystem(post) })) };
}
export const hackSearchText = (post: HackPost, theme?: HackTheme) => [post.title, post.description, hackOperatingSystem(post), theme?.name, theme?.description, ...post.links.flatMap(link => [link.label, link.url]), ...post.steps.map(hackStepSearchText)].join(' ');
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterHackPosts(catalogue: HacksCatalogue, query: string, filters: HacksFilters): HackPost[] {
  const tokens = fold(query).trim().split(/\s+/).filter(Boolean);
  return catalogue.posts.filter(post => {
    if (filters.os && filters.os !== 'All' && hackOperatingSystem(post) !== filters.os) return false;
    if (filters.themeId && post.themeId !== filters.themeId) return false;
    if (filters.sort === 'with-steps' && !post.steps.length || filters.sort === 'without-steps' && post.steps.length) return false;
    if (filters.links === 'with-links' && !hackLinkCount(post) || filters.links === 'without-links' && hackLinkCount(post)) return false;
    const text = fold(hackSearchText(post, catalogue.themes.find(theme => theme.themeId === post.themeId)));
    return tokens.every(token => text.includes(token));
  }).sort((a, b) => (filters.sort === 'popular' ? b.views - a.views : 0) || (filters.sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)) || a.postId.localeCompare(b.postId));
}
export function hackMatchedStep(post: HackPost, query: string): number | undefined {
  const token = fold(query).trim().split(/\s+/)[0];
  if (!token) return undefined;
  const index = post.steps.findIndex(step => fold(hackStepSearchText(step)).includes(token));
  return index >= 0 ? index : undefined;
}
export function cleanLaptopIssue(input: Record<string, unknown>) {
  const customerName = trimmed(input?.customerName), phone = trimmed(input?.phone), email = trimmed(input?.email), issue = trimmed(input?.issue);
  if (!customerName || customerName.length > 120 || !/^\+?[\d\s()-]{9,24}$/.test(phone) || phone.replace(/\D/g, '').length < 9 || !issue || issue.length > 8000) throw new Error('Enter your name, a valid phone number and an issue description (up to 8,000 characters).');
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter a valid email address.');
  const fields = ['laptopBrand', 'model', 'operatingSystem', 'attempts'] as const;
  const details: Record<string, string> = { issue };
  for (const field of fields) { const value = trimmed(input[field]); if (value.length > (field === 'attempts' ? 4000 : 200)) throw new Error('Some laptop details are too long.'); details[field] = value; }
  return { customerName, phone, ...(email ? { email } : {}), details };
}
