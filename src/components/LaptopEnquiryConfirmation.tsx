import React, { useState } from 'react';
import { CreditCard, MessageCircle } from 'lucide-react';
import type { PublicPaymentOptions } from '../../shared/types';
import { formatPesewas } from '../../shared/money';
import { STORE_COPY } from '../config/storeCopy';
import { PaymentMethodPanel } from './PaymentMethodPanel';

export function LaptopEnquiryConfirmation({ reference, pricePesewas, paymentOptions }: { reference: string; pricePesewas?: number; paymentOptions?: PublicPaymentOptions }) {
  const [showPayment, setShowPayment] = useState(false);
  const digits = paymentOptions?.momo.whatsappNumber.replace(/\D/g, '');
  const recipient = digits ? (digits.startsWith('0') ? `233${digits.slice(1)}` : digits) : STORE_COPY.brand.phoneRaw.replace(/\D/g, '');
  const contact = `https://wa.me/${recipient}?text=${encodeURIComponent(`Hello Hack-Key Tech, I would like to discuss my laptop enquiry ${reference}.`)}`;
  const hasMomo = Boolean(paymentOptions && (paymentOptions.momo.merchantId || paymentOptions.momo.transferNumber));
  return <section className="space-y-4" aria-label="Laptop enquiry received">
    <h2 className="text-xl font-black text-[#014040]">Your details have been received</h2>
    <p role="status" className="text-sm text-slate-600">We will contact you within 24 hours.</p>
    <p className="break-all text-xs text-slate-600">Enquiry reference: <b>{reference}</b></p>
    {pricePesewas !== undefined && <p className="text-sm font-bold text-[#014040]">Selected laptop price: {formatPesewas(pricePesewas)}</p>}
    <div className="grid gap-2"><button type="button" onClick={() => setShowPayment(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#014040] px-4 py-3 text-sm font-black text-[#05ef28]"><CreditCard className="h-4 w-4" />Pay now</button><a href={contact} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#014040] px-4 py-3 text-sm font-black text-[#014040]"><MessageCircle className="h-4 w-4" />Contact Hack-Key Tech</a></div>
    {showPayment && (hasMomo ? <PaymentMethodPanel options={{ ...paymentOptions!, mode: 'momo' }} orderIds={[]} reference={reference} referenceLabel="Enquiry reference" intro="Use either payment option below and include your enquiry reference. Contact Hack-Key Tech to confirm the amount due for your selected laptop and delivery time." screenshotMessage={`Hello, I am attaching my MoMo transaction screenshot for laptop enquiry ${reference}.`} /> : <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Mobile Money details are currently unavailable. Contact Hack-Key Tech for payment details.</p>)}
  </section>;
}
