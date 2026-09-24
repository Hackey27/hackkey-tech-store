/** Progress is private to this exact order and OS-specific installation guide. */
export function guideProgressKey(orderId: string, guideId: string): string {
  return `hkt-install-guide:${orderId}:${guideId}`;
}

/** A completed guide starts fresh on its next opening; incomplete guides resume. */
export function initialGuidePosition(saved: string | null, stepCount: number): number {
  const position = saved === null ? 0 : Number(saved);
  return Number.isInteger(position) && position >= 0 && position < stepCount ? position : 0;
}

export function shouldClearGuideProgress(position: number, stepCount: number): boolean {
  return position >= stepCount;
}
