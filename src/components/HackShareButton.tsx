import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import type { HackPost } from '../../shared/hacks';
import { hackShareUrl, shareHackPost } from '../utils/hackSharing';

export function HackShareButton({ post }: { post: Pick<HackPost, 'postId' | 'title'> }) {
  const [status, setStatus] = useState(''), [fallback, setFallback] = useState('');
  const share = async () => {
    setStatus(''); setFallback('');
    try { const result = await shareHackPost(post, window.location.origin); setStatus(result === 'copied' ? 'Post link copied' : result === 'shared' ? 'Post shared' : ''); }
    catch { setFallback(hackShareUrl(post.postId, window.location.origin)); setStatus('Copy this link to share the post.'); }
  };
  return <div className="min-w-0"><button type="button" aria-label={`Share ${post.title}`} onClick={() => void share()} className="inline-flex items-center gap-2 rounded-xl border border-[#bdd1cc] bg-white px-3 py-2 text-xs font-bold text-[#014040]"><Share2 className="h-4 w-4" />Share</button>{status && <p role="status" className="mt-2 text-xs text-[#014040]">{status}</p>}{fallback && <input aria-label="Post link to share" readOnly value={fallback} onFocus={event => event.currentTarget.select()} className="mt-2 w-full min-w-0 rounded-lg border p-2 text-xs" />}</div>;
}
