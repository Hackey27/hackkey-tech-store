import type { Firestore } from "@google-cloud/firestore";
import { COLLECTIONS, getFirestore } from './firestore';
import { RMB_SETTINGS_ID, storedRmbSettings } from './rmbPricingSettings';
import { priceRmbProduct } from '../shared/rmbPricing';
import {
  Preorder,
  PreorderCustomer,
  PreorderDelivery,
  PreorderItem,
  PreorderProduct,
} from '../shared/types';
import { readableSelections } from '../shared/preorderCombinations';
import { newId } from './orders';
import { recordPreorderAlert } from './preorderData';
import { sendSellerPreorderAlert } from './email';

/**
 * Turning a browser's basket into a pre-order.
 *
 * WHAT THE CLIENT SENDS IS WHAT WAS CHOSEN, NEVER WHAT IT COSTS. The request
 * names a product, a combination and a delivery speed; every price on the
 * stored order is read here from the combination in Firestore. This mirrors
 * the software checkout, which prices entirely from the catalogue for the same
 * reason: a price that arrives from a browser is a price a customer can edit.
 *
 * The price is then COPIED onto the line. Pre-order prices change while stock
 * is being sourced, and an order that looked up its price later would quietly
 * restate what someone agreed to pay.
 */

/** Matches the cart's own ceiling, so a basket cannot submit what it could not hold. */
const MAX_QUANTITY = 99;

export interface PreorderSubmissionItem {
  productId: string;
  combinationId: string;
  delivery: PreorderDelivery;
  quantity: number;
  expectedPricePesewas?: number;
}

export interface PreorderSubmission {
  customer: PreorderCustomer;
  items: PreorderSubmissionItem[];
}

export class PreorderSubmissionError extends Error {}

function requireText(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new PreorderSubmissionError(`${field} is required.`);
  return text;
}

function cleanCustomer(customer: PreorderCustomer | undefined): PreorderCustomer {
  if (!customer) throw new PreorderSubmissionError('Customer details are required.');
  return {
    name: requireText(customer.name, 'Name'),
    phone: requireText(customer.phone, 'Phone number'),
    email: requireText(customer.email, 'Email'),
    location: requireText(customer.location, 'Delivery location'),
  };
}

export function priceFor(
  product: PreorderProduct,
  combinationId: string,
  delivery: PreorderDelivery
): { pricePesewas: number; selectionLabel: string } {
  const combination = product.combinations.find((entry) => entry.combinationId === combinationId);
  if (!combination) {
    throw new PreorderSubmissionError(
      `${product.name} no longer offers that option. Please rebuild your pre-order.`
    );
  }
  if (!product.deliveryOptions.includes(delivery)) {
    throw new PreorderSubmissionError(`${product.name} is not available for that delivery speed.`);
  }

  const pricePesewas =
    delivery === 'express' ? combination.priceExpressPesewas : combination.priceTwoMonthsPesewas;
  // A blank price means "ask", never free. Refusing here is what stops an
  // unpriced combination becoming an order nobody can invoice.
  if (!Number.isSafeInteger(pricePesewas) || typeof pricePesewas !== 'number' || pricePesewas <= 0) {
    throw new PreorderSubmissionError(`${product.name} has no price for that delivery speed.`);
  }

  return {
    pricePesewas,
    // Copied at submission, so a later axis rename cannot relabel a past order.
    selectionLabel: readableSelections(combination.selections, product.variantAxes),
  };
}

export async function submitPreorder(submission: PreorderSubmission, dependencies: { db?: Firestore; notify?: (record: Preorder) => Promise<void> } = {}): Promise<Preorder> {
  const customer = cleanCustomer(submission.customer);
  const requested = Array.isArray(submission.items) ? submission.items : [];
  if (!requested.length) throw new PreorderSubmissionError('Your pre-order is empty.');

  const db = dependencies.db || getFirestore();
  // Settings, source products and the immutable order snapshot share a
  // transaction. A concurrent rate/product change retries before any write.
  const preorder = await db.runTransaction(async transaction => {
    const settingsDoc = await transaction.get(db.collection(COLLECTIONS.settings).doc(RMB_SETTINGS_ID));
    const settings = storedRmbSettings(settingsDoc.data());
    const products = new Map<string, PreorderProduct>();
    for (const item of requested) {
      const productId = requireText(item.productId, 'Product');
      if (products.has(productId)) continue;
      const snapshot = await transaction.get(db.collection(COLLECTIONS.preorderProducts).doc(productId));
      const source = snapshot.data() as PreorderProduct | undefined;
      if (!source?.active) throw new PreorderSubmissionError('One of these products is no longer available.');
      products.set(productId, priceRmbProduct(source, settings).product);
    }
    const now = new Date().toISOString();
    const items: PreorderItem[] = requested.map((item, index) => {
      const product = products.get(requireText(item.productId, 'Product'))!;
      const quantity = Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(Number(item.quantity) || 1)));
      const { pricePesewas, selectionLabel } = priceFor(product, item.combinationId, item.delivery);
      if (item.expectedPricePesewas !== undefined && item.expectedPricePesewas !== pricePesewas) throw new PreorderSubmissionError('Prices have changed. Refresh and review your basket before submitting again.');
      return { itemId: `${index + 1}`, productId: product.productId, combinationId: item.combinationId, selectionLabel, productName: product.name, delivery: item.delivery, pricePesewas, quantity, status: 'awaiting-order', packageId: null };
    });
    const record: Preorder = { preorderId: newId('PRE'), customer, items, submittedAt: now, lastUpdated: now, sellerAlertStatus: 'pending' };
    transaction.create(db.collection(COLLECTIONS.preorders).doc(record.preorderId), record);
    return record;
  });

  /* The alert is sent after the write and is never allowed to fail it. The
     pre-order is the record; an email that did not go out is a thing to chase,
     not a reason to lose the order. Same rule the payment path follows. */
  if (dependencies.notify) { await dependencies.notify(preorder); return preorder; }
  try {
    await sendSellerPreorderAlert(preorder);
    await recordPreorderAlert(preorder.preorderId, 'sent');
  } catch (err) {
    console.error('[preorder] seller alert failed:', err);
    await recordPreorderAlert(
      preorder.preorderId,
      'failed',
      err instanceof Error ? err.message : 'Unknown mail error'
    ).catch(() => undefined);
  }

  return preorder;
}

export function preorderTotalPesewas(preorder: Preorder): number {
  return preorder.items.reduce((sum, item) => sum + item.pricePesewas * item.quantity, 0);
}
