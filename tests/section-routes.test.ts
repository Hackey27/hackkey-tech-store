import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_TABS, sectionForPath } from '../src/config/sections';

/**
 * The section paths are a public URL contract: customers save links and share
 * them on WhatsApp. These assert the mapping rather than the panel, which is
 * where a rename would quietly break a saved link.
 */

test('the software section owns the root path', () => {
  assert.equal(sectionForPath('/').id, 'software');
});

test('every non-software tab resolves from its own path', () => {
  for (const tab of SECTION_TABS.filter((candidate) => candidate.id !== 'software')) {
    assert.equal(sectionForPath(tab.path).id, tab.id, `${tab.path} should resolve to ${tab.id}`);
  }
});

test('a trailing slash resolves to the same section', () => {
  assert.equal(sectionForPath('/preorder/').id, 'preorder');
  assert.equal(sectionForPath('/laptops/').id, 'laptops');
});

test('the existing storefront paths stay with software, not a section', () => {
  // These already work and must keep working: a section that claimed them would
  // take the catalogue, a product page or an order link off the customer.
  for (const path of ['/category/research-tools', '/product/smartpls-4', '/order/HK-1234', '/payment/return']) {
    assert.equal(sectionForPath(path).id, 'software', `${path} must not be captured by a section`);
  }
});

test('a section owns the paths beneath it, so a product page stays in its section', () => {
  // /preorder/{productId} is a shared link. Before sections owned their
  // sub-paths this fell through to the storefront home page with a 200, so a
  // pasted pre-order link quietly opened the software shop instead.
  assert.equal(sectionForPath('/preorder/field-shirt').id, 'preorder');
  assert.equal(sectionForPath('/preorder/field-shirt/').id, 'preorder');
});

test('software never claims a path by prefix, or its root would own everything', () => {
  assert.equal(sectionForPath('/preorder/anything').id, 'preorder');
  assert.equal(sectionForPath('/hacks/anything').id, 'hacks');
});

test('an unknown path falls back to software rather than throwing', () => {
  assert.equal(sectionForPath('/nope').id, 'software');
});

test('only the built sections are live', () => {
  const live = SECTION_TABS.filter((tab) => tab.live).map((tab) => tab.id);
  assert.deepEqual(live, ['software', 'preorder']);
});

test('laptops is present but not live, so stock keeps selling in the catalogue', () => {
  const laptops = SECTION_TABS.find((tab) => tab.id === 'laptops');
  assert.ok(laptops, 'the laptops tab should exist');
  assert.equal(laptops.live, false);
});
