import { STORE_COPY } from '../config/storeCopy';

export function whatsAppDocumentLink(orderId: string, productName: string): string {
  const text = `Order ${orderId} — ${productName}. Here is my document.`;
  return `${STORE_COPY.brand.whatsAppUrl}?text=${encodeURIComponent(text)}`;
}
