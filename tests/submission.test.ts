/**
 * Server-side validation of a service submission.
 *
 * The showIf case matters: a customer who chooses WhatsApp never sees the
 * upload field, so requiring it would make their form impossible to submit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateServiceAnswers, validateUpload, documentObjectPath, MAX_UPLOAD_BYTES } from '../server/storage';
import { TURNITIN_FIELDS } from '../server/seed/turnitin';

test('a hidden conditional field is not treated as missing', () => {
  // WhatsApp chosen: the upload is hidden, so it is not required.
  const whatsapp = validateServiceAnswers(TURNITIN_FIELDS, {
    submissionMethod: 'Send it on WhatsApp',
    fullName: 'Ama Mensah',
    phone: '0541234567',
    email: 'ama@example.com',
    deadline: '2026-10-01T12:00'
  });
  assert.equal(whatsapp.ok, true, `unexpectedly missing: ${whatsapp.missing.join(', ')}`);
});

test('a visible conditional field is required', () => {
  // Upload chosen but no document: the form is incomplete.
  const upload = validateServiceAnswers(TURNITIN_FIELDS, {
    submissionMethod: 'Upload it here',
    fullName: 'Ama Mensah',
    phone: '0541234567',
    email: 'ama@example.com',
    deadline: '2026-10-01T12:00'
  });
  assert.equal(upload.ok, false);
  assert.deepEqual(upload.missing, ['Upload your document']);
});

test('the other required fields are still enforced on both routes', () => {
  const result = validateServiceAnswers(TURNITIN_FIELDS, {
    submissionMethod: 'Send it on WhatsApp'
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    'Full name',
    'Phone / WhatsApp number',
    'Email address',
    'When do you need it by?'
  ]);
});

test('optional fields never block submission', () => {
  const result = validateServiceAnswers(TURNITIN_FIELDS, {
    submissionMethod: 'Send it on WhatsApp',
    fullName: 'Ama',
    phone: '0541234567',
    email: 'a@example.com',
    deadline: '2026-10-01T12:00'
    // notes deliberately absent
  });
  assert.equal(result.ok, true);
});

test('whitespace does not satisfy a required field', () => {
  const result = validateServiceAnswers(TURNITIN_FIELDS, {
    submissionMethod: 'Send it on WhatsApp',
    fullName: '   ',
    phone: '0541234567',
    email: 'a@example.com',
    deadline: '2026-10-01T12:00'
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['Full name']);
});

test('upload limits are enforced by type and size', () => {
  assert.equal(validateUpload('application/pdf', 1024).ok, true);
  assert.equal(
    validateUpload('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024).ok,
    true
  );
  assert.equal(validateUpload('application/msword', 1024).ok, true);

  assert.equal(validateUpload('image/png', 1024).ok, false, 'images are not documents');
  assert.equal(validateUpload('application/zip', 1024).ok, false);
  assert.equal(validateUpload('application/pdf', MAX_UPLOAD_BYTES + 1).ok, false, 'over 20 MB');
  assert.equal(validateUpload('application/pdf', MAX_UPLOAD_BYTES).ok, true, '20 MB exactly is allowed');
  assert.equal(validateUpload('application/pdf', 0).ok, false);
});

test('object paths are namespaced per order, so one customer cannot reach another', () => {
  assert.equal(documentObjectPath('HK-111111', 'application/pdf'), 'orders/HK-111111/document.pdf');
  assert.equal(documentObjectPath('HK-222222', 'application/pdf'), 'orders/HK-222222/document.pdf');
  assert.notEqual(
    documentObjectPath('HK-111111', 'application/pdf'),
    documentObjectPath('HK-222222', 'application/pdf')
  );
});
