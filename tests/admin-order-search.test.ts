import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminOrderMatchesSearch } from '../src/utils/adminOrderSearch';

const order = {
  orderId: 'HK-123456',
  customerName: 'Ama Serwaa Boateng',
  phone: '0540000000',
  email: 'ama@example.com',
  serviceAnswers: {
    fullName: 'Dr Ama S. Boateng',
    notes: 'Urgent order',
  },
};

test('admin order search matches any part of the submitted customer name', () => {
  assert.equal(adminOrderMatchesSearch(order, 'ama'), true);
  assert.equal(adminOrderMatchesSearch(order, 'serwaa boat'), true);
  assert.equal(adminOrderMatchesSearch(order, 'DR AMA S.'), true);
});

test('admin order search keeps matching existing identifiers', () => {
  assert.equal(adminOrderMatchesSearch(order, 'HK-123'), true);
  assert.equal(adminOrderMatchesSearch(order, '054000'), true);
  assert.equal(adminOrderMatchesSearch(order, 'ama@example'), true);
  assert.equal(adminOrderMatchesSearch(order, 'Urgent order'), false);
});
