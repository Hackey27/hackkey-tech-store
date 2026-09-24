export function guideScreenshotUrl(src: string): string {
  return src.startsWith('catalogue/')
    ? `/api/catalog/images?path=${encodeURIComponent(src)}`
    : src;
}

/** Positions are stored as percentages of the displayed image, so amber
 * markers stay aligned when the screenshot scales on a phone or computer. */
export function guideMarkerPosition(clientX: number, clientY: number, bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): { x: number; y: number } {
  const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
  return {
    x: bounds.width > 0 ? clamp((clientX - bounds.left) / bounds.width * 100) : 50,
    y: bounds.height > 0 ? clamp((clientY - bounds.top) / bounds.height * 100) : 50
  };
}
