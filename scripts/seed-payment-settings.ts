import { COLLECTIONS, getFirestore } from '../server/firestore';
import { DEFAULT_PAYMENT_SETTINGS } from '../server/paymentSettings';

const ref = getFirestore().collection(COLLECTIONS.settings).doc('payments');
const existing = await ref.get();
if (existing.exists) {
  console.log('settings/payments already exists; nothing changed.');
} else {
  await ref.set({ ...DEFAULT_PAYMENT_SETTINGS, updatedAt: new Date().toISOString(), updatedBy: 'seed' });
  console.log('Created settings/payments with Paystack as the live mode.');
}
