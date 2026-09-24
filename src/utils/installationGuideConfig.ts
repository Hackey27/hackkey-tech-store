import type { InstallationGuideConfig, InstallationGuideStepConfig, Product } from '../types';

const STEP_KINDS = new Set(['download', 'command', 'licence', 'customer-input']);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanGuide(value: InstallationGuideConfig, os: string, productId: string): InstallationGuideConfig {
  if (!value || !Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 60) {
    throw new Error(`${os} installation guide must have 1 to 60 steps.`);
  }
  const title = text(value.title);
  const caption = text(value.caption);
  if (!title || title.length > 120 || caption.length > 500) throw new Error(`${os} installation guide has an invalid title or caption.`);
  const steps = value.steps.map((step, index): InstallationGuideStepConfig => {
    const stepTitle = text(step?.title);
    const body = text(step?.body);
    const actionLabel = text(step?.actionLabel);
    const actionUrl = text(step?.actionUrl);
    if (!stepTitle || stepTitle.length > 120 || !body || body.length > 4000) {
      throw new Error(`${os} step ${index + 1} needs a title and description.`);
    }
    if (step.kind && !STEP_KINDS.has(step.kind)) throw new Error(`${os} step ${index + 1} has an invalid action type.`);
    if (Boolean(actionLabel) !== Boolean(actionUrl)) throw new Error(`${os} step ${index + 1} needs both a button label and link.`);
    if (actionLabel.length > 80) throw new Error(`${os} step ${index + 1} button label is too long.`);
    if (actionUrl) {
      try { if (new URL(actionUrl).protocol !== 'https:') throw new Error('HTTPS required'); }
      catch { throw new Error(`${os} step ${index + 1} button link must be an HTTPS URL.`); }
    }
    if (step.images && (!Array.isArray(step.images) || step.images.length > 6)) throw new Error(`${os} step ${index + 1} can have up to six screenshots.`);
    const safeProductId = productId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'product';
    const images = step.images?.map((image, imageIndex) => {
      const src = text(image?.src);
      const alt = text(image?.alt);
      const builtIn = /^\/installation-guides\/[a-z0-9-]+\/[a-zA-Z0-9._-]+$/.test(src);
      const guidePrefix = `catalogue/${safeProductId}/guide/`;
      const uploaded = src.startsWith(guidePrefix) && !src.slice(guidePrefix.length).includes('/') && !src.includes('..');
      if ((!builtIn && !uploaded) || !alt || alt.length > 200) throw new Error(`${os} step ${index + 1} screenshot ${imageIndex + 1} is invalid.`);
      if (image.markers && (!Array.isArray(image.markers) || image.markers.length > 20)) throw new Error(`${os} step ${index + 1} has too many amber markers.`);
      const markers = image.markers?.map((marker) => {
        const label = text(marker?.label);
        if (!Number.isFinite(marker?.x) || !Number.isFinite(marker?.y) || marker.x < 0 || marker.x > 100 || marker.y < 0 || marker.y > 100 || !label || label.length > 80) {
          throw new Error(`${os} step ${index + 1} has an invalid amber marker.`);
        }
        return { x: marker.x, y: marker.y, label };
      });
      return { src, alt, ...(markers?.length ? { markers } : {}) };
    });
    return {
      title: stepTitle,
      body,
      ...(step.kind ? { kind: step.kind } : {}),
      ...(step.optional ? { optional: true } : {}),
      ...(images?.length ? { images } : {}),
      ...(actionLabel ? { actionLabel, actionUrl } : {})
    };
  });
  return { title, ...(caption ? { caption } : {}), steps };
}

export function cleanProductInstallationSettings(input: Product): Pick<Product, 'installationButtonLabel' | 'installationGuides' | 'showInstallationGuideFallback'> {
  const label = text(input.installationButtonLabel);
  if (label.length > 100) throw new Error('Installation button label is too long.');
  const guides = input.installationGuides;
  return {
    installationButtonLabel: label || undefined,
    showInstallationGuideFallback: input.showInstallationGuideFallback === true,
    installationGuides: guides ? {
      ...(guides.windows ? { windows: cleanGuide(guides.windows, 'Windows', input.productId) } : {}),
      ...(guides.macos ? { macos: cleanGuide(guides.macos, 'macOS', input.productId) } : {})
    } : undefined
  };
}
