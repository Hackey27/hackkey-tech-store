export const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

/** Browser MIME may be empty on mobile, so extension is only a hint; the server verifies file bytes. */
export function documentContentType(file: { name: string; type: string }): string | undefined {
  if (DOCUMENT_MIME_TYPES.has(file.type)) return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'doc') return 'application/msword';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return undefined;
}
