type SharePlatform = { share?: (data: ShareData) => Promise<void> };

/** Native sharing on supported devices, with the same copy fallback on desktop. */
export async function shareProductLink(data: ShareData, copy: (url: string) => Promise<void>, platform: SharePlatform = navigator): Promise<'Shared' | 'Link copied' | null> {
  if (platform.share) {
    try { await platform.share(data); return 'Shared'; }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return null; }
  }
  await copy(data.url!);
  return 'Link copied';
}

export function preorderSharePath(productId: string, combinationId?: string): string {
  const path = `/preorder/${encodeURIComponent(productId)}`;
  return combinationId ? `${path}?combination=${encodeURIComponent(combinationId)}` : path;
}

export async function copyProductLink(url: string): Promise<void> {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); return; }
  const input = document.createElement('textarea');
  input.value = url;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try { if (!document.execCommand('copy')) throw new Error('Unable to copy link'); }
  finally { input.remove(); }
}
