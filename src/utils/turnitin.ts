export const TURNITIN_AI_OPTION_ID = 'PLAG_AI';

export function isTurnitinAiCheck(optionId?: string): boolean {
  return optionId === TURNITIN_AI_OPTION_ID;
}
