import type { InstallationGuideConfig, InstallationGuideStepConfig, Product } from '../types';

const STEP_KINDS = new Set(['download', 'command', 'licence', 'customer-input']);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanGuide(value: InstallationGuideConfig, os: string): InstallationGuideConfig {
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
    return {
      title: stepTitle,
      body,
      ...(step.kind ? { kind: step.kind } : {}),
      ...(step.optional ? { optional: true } : {}),
      ...(step.images?.length ? { images: step.images } : {}),
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
      ...(guides.windows ? { windows: cleanGuide(guides.windows, 'Windows') } : {}),
      ...(guides.macos ? { macos: cleanGuide(guides.macos, 'macOS') } : {})
    } : undefined
  };
}
