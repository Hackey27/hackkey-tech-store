import assert from 'node:assert/strict';
import test from 'node:test';
import { getStepsForMachineCodeType } from '../src/components/OrderProgressBar';

test('order progress preserves the full customer-facing labels', () => {
  assert.deepEqual(
    getStepsForMachineCodeType('lock-code').map((step) => step.label),
    ['Your Selection', 'Your Details', 'Payment', 'Submit Lock Code', 'Licence Delivery'],
  );
  assert.deepEqual(
    getStepsForMachineCodeType('hardware-id').map((step) => step.label),
    ['Your Selection', 'Your Details', 'Payment', 'Submit Hardware ID', 'Licence Delivery'],
  );
  assert.deepEqual(
    getStepsForMachineCodeType('service').map((step) => step.label),
    ['Your Selection', 'Your Details', 'Payment', 'Delivery'],
  );
});
