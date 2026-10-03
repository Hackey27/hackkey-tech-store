import type { HackPost } from '../../shared/hacks';
import { hackPostPath } from '../../shared/hacks';

type SharePlatform = { share?: (data: ShareData) => Promise<void>; clipboard?: Pick<Clipboard, 'writeText'> };
export function hackShareUrl(postId: string, origin: string) { return new URL(hackPostPath(postId), origin).toString(); }
export async function shareHackPost(post: Pick<HackPost, 'postId' | 'title'>, origin: string, platform: SharePlatform = navigator): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = hackShareUrl(post.postId, origin);
  if (platform.share) {
    try { await platform.share({ title: post.title, url }); return 'shared'; }
    catch (error) { if (error instanceof Error && error.name === 'AbortError') return 'cancelled'; }
  }
  if (!platform.clipboard) throw new Error('Copy the post link below to share it.');
  await platform.clipboard.writeText(url);
  return 'copied';
}
