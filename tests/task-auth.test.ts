import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyGoogleTaskToken } from '../server/taskAuth';

test('scheduled reminder authentication rejects malformed bearer tokens before any network lookup', async () => {
  assert.equal(await verifyGoogleTaskToken('not-a-jwt', 'https://service.example', 'scheduler@example.iam.gserviceaccount.com'), false);
});
