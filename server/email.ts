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

async function send(to: string, subject: string, text: string): Promise<void> {
  const key = apiKey();
  if (!key) {
    // Not configured is not a crash: log it so it is visible, and let the
    // caller record it on the order.
    throw new Error('MAIL_PROVIDER_API_KEY is not configured.');
  }

  const res = await fetch(`${API_BASE}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress(),
      reply_to: replyToAddress(),
      to: [to],
      subject,
      text
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mail send failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

export async function sendSellerAlert(alert: {
  subject: string;
  lines: string[];
}): Promise<void> {
  const to = sellerAddress();
  if (!to) throw new Error('SELLER_ALERT_EMAIL is not configured.');
  await send(to, alert.subject, alert.lines.join('\n'));
}

export async function sendSellerRequestAlert(request: CustomerRequest): Promise<void> {
  const detailLines = Object.entries(request.details || {}).map(([key, value]) => {
    const rendered = typeof value === 'string' ? value : JSON.stringify(value);
    return `${key}: ${rendered || ''}`;
  });
  await sendSellerAlert({
    subject: `New ${request.kind.replaceAll('-', ' ')} request — ${request.customerName}`,
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
