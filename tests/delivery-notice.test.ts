import assert from 'node:assert/strict';
import test from 'node:test';
import { fulfilmentNoticeKind, resolvedDeliveryNotice } from '../server/deliveryNotice';

test('legacy MAXQDA 26 and EViews Enterprise 14 setups start with notices on', () => {
  assert.equal(resolvedDeliveryNotice({ variantId: 'MXQ01' }), true);
  assert.equal(resolvedDeliveryNotice({ variantId: 'EV01' }), true);
});

test('other software defaults off and an explicit admin switch always wins', () => {
  assert.equal(resolvedDeliveryNotice({ variantId: 'OTHER01' }), false);
  assert.equal(resolvedDeliveryNotice({ variantId: 'OTHER01', showDeliveryNotice: true }), true);
  assert.equal(resolvedDeliveryNotice({ variantId: 'MXQ01', showDeliveryNotice: false }), false);
});

test('notice wording is selected from fulfilment type rather than product name', () => {
  assert.equal(fulfilmentNoticeKind('Account Delivery'), 'account');
  assert.equal(fulfilmentNoticeKind('Manual Licence'), 'licence');
});
