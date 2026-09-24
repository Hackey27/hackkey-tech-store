import { CustomerRequest, Order } from '../src/types';
import { formatPesewas } from '../src/utils/money';
import { STORE_COPY } from '../src/config/storeCopy';

/**
 * Seller alerts and customer receipts, over Resend's HTTP API.
 *
 * HTTP rather than SMTP, and deliberately not the Gmail API: an OAuth refresh
 * failure at 2am is a silent, revenue-affecting outage, and nobody notices
 * until a customer asks where their licence is.
 *
 * Every function here is allowed to fail. The caller records the failure on the
 * order and carries on — the money has already arrived, and losing the payment
 * because an email bounced would be the worse outcome by far.
 */

const API_BASE = process.env.MAIL_API_BASE || 'https://api.resend.com';

export interface MailReceipt {
  providerId?: string;
}

function apiKey(): string | undefined {
  return process.env.MAIL_PROVIDER_API_KEY || undefined;
}

function sellerAddress(): string | undefined {
  return process.env.SELLER_ALERT_EMAIL || undefined;
}

/**
 * Mail is sent from the `send.` subdomain, which is what carries the SPF and
 * DKIM records, keeping the root domain's DNS free of sending policy.
 */
function fromAddress(): string {
  return process.env.MAIL_FROM || 'Hack-Key Tech <orders@send.hackeytech.com>';
}

/**
 * Replies go to the real inbox on the root domain, not to the sending
 * subdomain — nobody reads mail at send.hackeytech.com, so without this a
 * customer replying to their receipt would be talking to no one.
 */
function replyToAddress(): string {
  return process.env.MAIL_REPLY_TO || 'orders@hackeytech.com';
}

/** Mail is configured only when both a key and a sender destination exist. */
export function mailConfigured(): boolean {
  return Boolean(apiKey());
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 3_000);
  return attempt === 0 ? 250 : 750;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Retry transient failures with one idempotency key so recovery never sends
 * the same alert twice. */
async function send(to: string, subject: string, text: string, idempotencyKey?: string): Promise<MailReceipt> {
  const key = apiKey();
  if (!key) {
    // Not configured is not a crash: log it so it is visible, and let the
    // caller record it on the order.
    throw new Error('MAIL_PROVIDER_API_KEY is not configured.');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`${API_BASE}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 256) } : {})
        },
        body: JSON.stringify({
          from: fromAddress(),
          reply_to: replyToAddress(),
          to: [to],
          subject,
          text
        })
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({})) as { id?: string };
        console.info(`[MAIL] Provider accepted ${idempotencyKey || 'message'}${body.id ? ` (${body.id})` : ''}.`);
        return { providerId: body.id };
      }

      const body = await res.text().catch(() => '');
      const error = new Error(`Mail send failed: ${res.status} ${body.slice(0, 200)}`);
      if (res.status !== 429 && res.status < 500) throw error;
      lastError = error;
      if (attempt < 2) await wait(retryDelay(res, attempt));
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(attempt === 0 ? 250 : 750);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Mail send failed after retries.');
}

export async function sendSellerAlert(alert: {
  subject: string;
  lines: string[];
  idempotencyKey?: string;
}): Promise<MailReceipt> {
  const to = sellerAddress();
  if (!to) throw new Error('SELLER_ALERT_EMAIL is not configured.');
  return send(to, alert.subject, alert.lines.join('\n'), alert.idempotencyKey);
}

export async function sendSellerRequestAlert(request: CustomerRequest): Promise<MailReceipt> {
  const detailLines = Object.entries(request.details || {}).flatMap(([key, value]) => {
    if (request.kind === 'custom-bundle' && key === 'software' && Array.isArray(value)) {
      return ['software:', ...value.map((item) => `  ${String(item?.name || item?.itemId || '')} — ${String(item?.versionOrPlan || 'Version unspecified')} — ${String(item?.os || 'OS unspecified')}`)];
    }
    const rendered = typeof value === 'string' ? value : JSON.stringify(value);
    return [`${key}: ${rendered || ''}`];
  });
  return sendSellerAlert({
    subject: `Action needed: new ${request.kind.replaceAll('-', ' ')} — ${request.customerName}`,
    idempotencyKey: `seller-request-submitted/${request.requestId}`,
    lines: [
      'A new storefront request has been submitted.',
      '',
      `Reference: ${request.requestId}`,
      `Type: ${request.kind}`,
      `Name: ${request.customerName}`,
      `Phone: ${request.phone}`,
      `Email: ${request.email || ''}`,
      `Notes: ${request.notes || ''}`,
      '',
      ...detailLines
    ]
  });
}

/** Alert the seller as soon as checkout details are submitted, before payment.
 * The later verified-payment alert remains separate, so an abandoned checkout
 * is visible without ever being described as paid. */
export async function sendSellerOrderSubmittedAlert(orders: Order[], totalPesewas: number): Promise<MailReceipt> {
  const order = orders[0];
  if (!order) return {};
  const rows = orders.map((row) => `  ${row.productName} — ${row.versionOrPlan}   ${formatPesewas(row.amountPesewas)}`);
  return sendSellerAlert({
    subject: `Action needed: new checkout — ${order.orderId} — payment pending`,
    idempotencyKey: `seller-order-submitted/${order.orderId}`,
    lines: [
      'A customer submitted their checkout details. Payment has not yet been confirmed.',
      '',
      `Order: ${order.orderId}`,
      `Customer: ${order.customerName}`,
      `Phone: ${order.phone}`,
      `Email: ${order.email}`,
      `Total: ${formatPesewas(totalPesewas)}`,
      '',
      ...rows
    ]
  });
}

export async function sendCustomerOrderNotification(order: Order, subject: string, message: string): Promise<void> {
  if (!order.email) throw new Error('The order has no email address.');
  await send(order.email, subject, `${message}\n\n${STORE_COPY.brand.name} · ${STORE_COPY.brand.phone}`);
}

export async function sendSellerPaymentReminder(order: Order): Promise<void> {
  await sendSellerAlert({
    subject: `Payment follow-up due — ${order.orderId} — ${order.customerName}`,
    lines: [
      'A payment-later reminder is due today.',
      '',
      `Order: ${order.orderId}`,
      `Customer: ${order.customerName}`,
      `Phone: ${order.phone}`,
      `Email: ${order.email}`,
      `Amount: ${formatPesewas(order.amountPesewas)}`,
      `Reminder date: ${order.paymentReminderDate || ''}`,
      '',
      'Contact the customer about payment and update the order in the admin portal.'
    ]
  });
}

/** The WhatsApp deep link, with the order reference already in the message. */
function whatsAppLink(order: Order): string {
  const text = `Order ${order.orderId} — ${order.productName}. Here is my document.`;
  return `${STORE_COPY.brand.whatsAppUrl}?text=${encodeURIComponent(text)}`;
}

/** Next steps that actually match where the order now sits. */
function customerNextSteps(order: Order): string[] {
  const isTurnitin = order.productId === 'TURNITIN' || order.variantId === 'TURNITIN';
  switch (order.fulfilmentStatus) {
    case 'ready':
      return [isTurnitin
        ? 'Your Turnitin report is ready. Download it from the "Find my order" page.'
        : 'Your licence is ready. The details are on the "Find my order" page.'];
    case 'awaiting-licence':
      return [
        'Your licence is being issued by our team and we will contact you as soon',
        'as it is ready. Quote your order reference if you get in touch.'
      ];
    case 'awaiting-customer-input':
      return [
        'We need one more thing from you before we can activate:',
        `your ${order.customerInputType || 'device code'}.`,
        'Open "Find my order", search your phone number, and send it there.'
      ];
    case 'awaiting-document':
      return [
        'Send us your document and we will get started:',
        `  • Upload it: open "Find my order" and search your phone number`,
        `  • Or WhatsApp it: ${whatsAppLink(order)}`
      ];
    case 'awaiting-seller-activation':
      return ['Our team is preparing your order and will contact you shortly.'];
    default:
      return ['Our team will be in touch shortly.'];
  }
}

/**
 * One receipt per cart. A bundle becomes several order rows, and the customer
 * bought one thing — they should be sent one receipt showing what they paid in
 * total, itemised, not several partial ones.
 */
export async function sendCustomerReceipt(
  order: Order,
  rows: Order[] = [order],
  totalPesewas: number = order.amountPesewas
): Promise<void> {
  if (!order.email) throw new Error('The order has no email address.');

  const itemised = rows.map((row) => {
    const quantity = row.quantity && row.quantity > 1 ? ` x${row.quantity}` : '';
    return `  ${row.productName} — ${row.versionOrPlan}${quantity}   ${formatPesewas(row.amountPesewas)}`;
  });

  const lines = [
    `Thank you — we have received your payment.`,
    ``,
    `ORDER REFERENCE:  ${order.orderId}`,
    ``,
    ...itemised,
    ``,
    `  Total paid: ${formatPesewas(totalPesewas)}`,
    ``,
    `WHAT HAPPENS NEXT`,
    ...customerNextSteps(order),
    ``,
    `Keep your order reference — it is how we find your order.`,
    `${STORE_COPY.brand.name} · ${STORE_COPY.brand.phone}`
  ];

  await send(order.email, `Your order ${order.orderId}`, lines.join('\n'));
}

/** Delivery confirmation for seller-fulfilled orders and manual licences. */
export async function sendCustomerDelivery(order: Order): Promise<void> {
  if (!order.email) throw new Error('The order has no email address.');
  const lines = [
    `Your order is ready.`,
    ``,
    `ORDER REFERENCE:  ${order.orderId}`,
    `${order.productName} — ${order.versionOrPlan}`,
    order.activationCodeOrKey ? `Licence / activation code: ${order.activationCodeOrKey}` : '',
    order.windowsInstallerUrl ? `Installer: ${order.windowsInstallerUrl}` : '',
    order.macViaParallels && order.parallelsInstallerUrl ? `Parallels Desktop: ${order.parallelsInstallerUrl}` : '',
    order.macViaParallels && order.windows11DownloadUrl ? `Windows 11: ${order.windows11DownloadUrl}` : '',
    order.guideUrl ? `Guide: ${order.guideUrl}` : '',
    order.reportDocuments?.length ? `Your labelled report files are available on the "Find my order" page.` : '',
    ``,
    `If you need help, reply to this email or contact ${STORE_COPY.brand.phone}.`
  ].filter(Boolean);
  await send(order.email, `Your order ${order.orderId} is ready`, lines.join('\n'));
}
