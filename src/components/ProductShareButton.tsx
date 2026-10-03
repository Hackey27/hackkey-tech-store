import React, { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { copyProductLink, shareProductLink } from '../utils/productSharing';

/** Place inside a relative banner, above its gallery click target. */
export function ProductShareButton({ name, path }: { name: string; path: string }) {
  const [status, setStatus] = useState('');
  const timer = useRef(0);
  const currentPath = useRef(path);
  currentPath.current = path;
  useEffect(() => {
    setStatus('');
    return () => window.clearTimeout(timer.current);
  }, [path]);
  const share = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const url = new URL(path, window.location.origin).toString();
    let message: string | null;
    try { message = await shareProductLink({ title: name, text: `View ${name} on Hack-Key Tech Store.`, url }, copyProductLink); }
    catch { message = 'Unable to share'; }
    if (!message || currentPath.current !== path) return;
    window.clearTimeout(timer.current);
    setStatus(message);
    timer.current = window.setTimeout(() => setStatus(''), 2200);
  };
  return <>
    <button type="button" onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onClick={share} className="absolute bottom-5 right-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/95 text-[#014040] shadow-lg transition-transform hover:scale-105 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#05ef28] sm:bottom-7 sm:right-7" aria-label={`Share ${name}`} title={`Share ${name}`}><Share2 className="h-5 w-5" /></button>
    {status && <span role="status" className="absolute bottom-[4.5rem] right-4 z-20 rounded-full bg-black/75 px-3 py-1.5 text-xs font-bold text-white shadow-lg sm:bottom-[5.25rem] sm:right-6">{status}</span>}
  </>;
}
