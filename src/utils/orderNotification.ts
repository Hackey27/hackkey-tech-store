import { CustomerNotificationPurpose, Order } from '../types';
import { formatPesewas } from './money';

export interface OrderNotificationContent {
  subject: string;
  message: string;
}

export function notificationPurposeForOrder(order: Order): CustomerNotificationPurpose {
  const isTurnitin = order.productId === 'TURNITIN' || order.variantId === 'TURNITIN';
  const hasDocument = Boolean(
    order.documentPath || order.documentReceivedAt || order.documentUploadedAt ||
    order.documentUploadStatus === 'uploaded' || order.documentSubmissionMethod === 'whatsapp'
  );
  if (order.paymentStatus !== 'paid') return 'payment-reminder';
  if (isTurnitin && !hasDocument) return 'turnitin-document';
  if (isTurnitin && order.fulfilmentStatus === 'ready' && order.reportDocuments?.length) return 'turnitin-report';
  if (isTurnitin && hasDocument && order.fulfilmentStatus !== 'ready') return 'turnitin-document-received';
  if (order.customerInputType && !order.customerInputValue) return 'customer-input';
  if (order.fulfilmentStatus === 'ready') return 'complete';
  return 'status-update';
}

export function notificationActionLabel(purpose: CustomerNotificationPurpose): string {
  switch (purpose) {
    case 'payment-reminder': return 'Send payment reminder';
    case 'customer-input': return 'Send installation and code instructions';
    case 'turnitin-document': return 'Ask customer to submit document';
    case 'turnitin-document-received': return 'Confirm document is being processed';
    case 'turnitin-report': return 'Notify customer that report is ready';
    case 'complete': return 'Notify customer that order is complete';
    default: return 'Send order status update';
  }
}

export function validateNotificationPurpose(order: Order, purpose: CustomerNotificationPurpose): string | null {
  const isTurnitin = order.productId === 'TURNITIN' || order.variantId === 'TURNITIN';
  const hasDocument = Boolean(
    order.documentPath || order.documentReceivedAt || order.documentUploadedAt ||
    order.documentUploadStatus === 'uploaded' || order.documentSubmissionMethod === 'whatsapp'
  );
  if (purpose === 'payment-reminder' && order.paymentStatus === 'paid') return 'This order is already paid.';
  if (purpose === 'customer-input' && (order.paymentStatus !== 'paid' || !order.customerInputType || order.customerInputValue)) {
    return 'Installation and code instructions apply to a paid order still awaiting a lock code or hardware ID.';
  }
  if (purpose === 'turnitin-document' && (!isTurnitin || order.paymentStatus !== 'paid' || hasDocument)) {
    return 'Document reminders apply to paid Turnitin orders still awaiting a document.';
  }
  if (purpose === 'turnitin-document-received' && (!isTurnitin || order.paymentStatus !== 'paid' || !hasDocument || order.fulfilmentStatus === 'ready')) {
    return 'Document received updates apply to paid Turnitin orders with a document that is still being processed.';
  }
  if (purpose === 'turnitin-report' && (!isTurnitin || order.fulfilmentStatus !== 'ready' || !order.reportDocuments?.length)) {
    return 'Upload a Turnitin report before notifying the customer that it is ready.';
  }
  if (purpose === 'complete' && order.fulfilmentStatus !== 'ready') return 'Complete the order before sending a completion message.';
  return null;
}

export function buildOrderNotification(order: Order, purpose: CustomerNotificationPurpose, orderUrl: string): OrderNotificationContent {
  const isTurnitin = order.productId === 'TURNITIN' || order.variantId === 'TURNITIN';
  const greeting = `Hello ${order.customerName},`;
  const reference = `Order: ${order.orderId} — ${order.productName} ${order.versionOrPlan}.`;
  switch (purpose) {
    case 'payment-reminder':
      return {
        subject: `Payment reminder for order ${order.orderId}`,
        message: `${greeting}\n\nThis is a reminder to make payment of ${formatPesewas(order.amountPesewas)} for your Hack-Key Tech order.\n${reference}\n\nOpen your secure order link to review the order and pay: ${orderUrl}`
      };
    case 'customer-input': {
      const detail = order.customerInputType || 'device code';
      return {
        subject: `Next step for order ${order.orderId}: submit your ${detail}`,
        message: `${greeting}\n\nWe have received your payment. Open your secure order link, download the software, follow the installation instructions, and submit your ${detail} so we can complete activation.\n${reference}\n\n${orderUrl}`
      };
    }
    case 'turnitin-document':
      return {
        subject: `Submit your document for Turnitin order ${order.orderId}`,
        message: `${greeting}\n\nWe have received your payment. Please use your secure order link to submit the document for your Turnitin check.\n${reference}\n\n${orderUrl}`
      };
    case 'turnitin-document-received':
      return {
        subject: 'Your document is being processed',
        message: `${greeting}\n\nYour document has been received and is being processed. Your report will be ready in 30 to 40 minutes.\n\nYou can follow its progress through your secure order link: ${orderUrl}`
      };
    case 'turnitin-report':
      return {
        subject: 'Your Turnitin report is ready',
        message: `${greeting}\n\nYour Turnitin report is ready. Use your secure order link to view and download the labelled report files.\n\n${orderUrl}`
      };
    case 'complete':
      return {
        subject: isTurnitin ? 'Your Turnitin order is complete' : `Your Hack-Key Tech order is complete — ${order.orderId}`,
        message: `${greeting}\n\nYour order is complete. Use your secure order link to view your deliverables and any remaining instructions.${isTurnitin ? '' : `\n${reference}`}\n\n${orderUrl}`
      };
    default:
      return {
        subject: isTurnitin && order.paymentStatus === 'paid' ? 'Update on your Turnitin order' : `Update on your Hack-Key Tech order ${order.orderId}`,
        message: `${greeting}\n\nThere is an update on your order. Open your secure order link to see its current status and next step.${isTurnitin && order.paymentStatus === 'paid' ? '' : `\n${reference}`}\n\n${orderUrl}`
      };
  }
}
