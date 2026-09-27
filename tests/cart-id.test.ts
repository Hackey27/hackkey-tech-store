import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../server/orders';

test('a cart id is prefixed and quotable', () => {
  const id = newId('CART');
  assert.match(id, /^CART-[0-9A-HJKMNP-TV-Z]{8}$/);
});

test('the alphabet omits the characters that are misread aloud', () => {
  const codes = Array.from({ length: 400 }, () => newId('CART').split('-')[1]).join('');
  assert.equal(/[ILOU]/.test(codes), false);
});

test('cart ids do not repeat, because a repeat pays a stranger order', () => {
  // applyVerifiedPayment marks every order sharing a cartId paid against one
  // total, so a collision is a cross-customer fulfilment, not a cosmetic clash.
  const ids = new Set(Array.from({ length: 20_000 }, () => newId('CART')));
  assert.equal(ids.size, 20_000);
});
