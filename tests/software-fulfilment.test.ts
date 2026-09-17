import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultCustomerInputType,
  defaultDeliveryCodeType,
  effectiveActivationWebsiteUrl
} from '../src/utils/softwareFulfilment';

test('software families use the correct customer activation detail', () => {
  assert.equal(defaultCustomerInputType('SPSS'), 'Lock Code');
  assert.equal(defaultCustomerInputType('AMOS'), 'Lock Code');
  assert.equal(defaultCustomerInputType('MP'), 'Hardware ID');
  assert.equal(defaultCustomerInputType('MXQ'), 'Hardware ID');
  assert.equal(defaultCustomerInputType('EV'), 'Hardware ID');
  assert.equal(defaultCustomerInputType('PLS'), undefined);
  assert.equal(defaultCustomerInputType('NV'), undefined);
});

test('only seller-activation software defaults to Sales ID stock', () => {
  assert.equal(defaultDeliveryCodeType('SPSS'), 'sales-code');
  assert.equal(defaultDeliveryCodeType('AMOS'), 'sales-code');
  assert.equal(defaultDeliveryCodeType('MP'), 'sales-code');
  assert.equal(defaultDeliveryCodeType('PLS'), 'licence');
  assert.equal(defaultDeliveryCodeType('NV'), 'licence');
});

test('legacy workbook activation links remain available in Software Setup', () => {
  assert.equal(effectiveActivationWebsiteUrl({ activationLink: 'https://reg32.spss-soft.com/' }), 'https://reg32.spss-soft.com/');
  assert.equal(effectiveActivationWebsiteUrl({ activationWebsiteUrl: 'https://custom.example/', activationLink: 'https://legacy.example/' }), 'https://custom.example/');
});
