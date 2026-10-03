import test from 'node:test';
import assert from 'node:assert/strict';
import { preorderSharePath, shareProductLink } from '../src/utils/productSharing';

const data = { title: 'Test product', url: 'https://example.com/preorder/TEST' };
test('preorder share links open the product and preserve a selected combination', () => {
  assert.equal(preorderSharePath('P /1'), '/preorder/P%20%2F1');
  assert.equal(preorderSharePath('P /1', 'Black / 512'), '/preorder/P%20%2F1?combination=Black%20%2F%20512');
});
test('native product sharing receives the same link without copying', async () => {
  let received: ShareData | undefined;
  assert.equal(await shareProductLink(data, async () => assert.fail('should not copy'), { share: async value => { received = value; } }), 'Shared');
  assert.deepEqual(received, data);
});
test('desktop and rejected native sharing copy the product link', async () => {
  for (const platform of [{}, { share: async () => { throw new Error('Unavailable'); } }]) {
    let copied = '';
    assert.equal(await shareProductLink(data, async url => { copied = url; }, platform), 'Link copied');
    assert.equal(copied, data.url);
  }
});
test('cancelling native sharing does not copy or show an error', async () => {
  assert.equal(await shareProductLink(data, async () => assert.fail('should not copy'), { share: async () => { throw new DOMException('Cancelled', 'AbortError'); } }), null);
});
test('an unavailable copy fallback surfaces a failure', async () => {
  await assert.rejects(shareProductLink(data, async () => { throw new Error('Clipboard unavailable'); }, {}), /Clipboard unavailable/);
});
