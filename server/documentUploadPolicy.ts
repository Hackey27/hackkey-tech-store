import { Order } from '../src/types';
import { normalisePhone } from './orders';

export interface DocumentUploadPolicyResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Shared by upload authorization and confirmation; the browser cannot bypass it. */
export function turnitinDocumentUploadPolicy(order: Order, phone: string, rejectExisting = false): DocumentUploadPolicyResult {
  if (order.paymentStatus !== 'paid') return { ok: false, status: 403, error: 'This order has not been paid for.' };
  if (order.productId !== 'TURNITIN' && order.variantId !== 'TURNITIN') {
    return { ok: false, status: 403, error: 'Document upload is only available for Turnitin orders.' };
  }
  if (normalisePhone(phone) !== order.phone) return { ok: false, status: 403, error: 'The phone number does not match this order.' };
  if (rejectExisting && (order.documentPath || order.documentUploadStatus === 'uploaded')) {
    return { ok: false, status: 409, error: 'A document has already been received for this order.' };
  }
  return { ok: true };
}
