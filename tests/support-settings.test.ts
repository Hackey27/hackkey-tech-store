import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SUPPORT_TOOLS,
  normaliseSupportSettings,
  publicSupportTools,
  validateSupportSettings
} from '../server/supportSettings';

const anydesk = { label: 'AnyDesk', url: 'https://anydesk.com/download', active: true };

test('a tool keeps its label, link and note', () => {
  const saved = validateSupportSettings({ tools: [{ ...anydesk, note: 'Send me the 9-digit address.' }] });
  assert.equal(saved.tools.length, 1);
  assert.equal(saved.tools[0].label, 'AnyDesk');
  assert.equal(saved.tools[0].note, 'Send me the 9-digit address.');
});

test('a missing id is derived from the label, so reordering does not rename a tool', () => {
  const saved = validateSupportSettings({ tools: [anydesk, { label: 'Team Viewer', url: 'https://teamviewer.com', active: true }] });
  assert.deepEqual(saved.tools.map((tool) => tool.toolId), ['anydesk', 'team-viewer']);
});

test('an explicit id survives a rename', () => {
  const saved = validateSupportSettings({ tools: [{ ...anydesk, toolId: 'anydesk', label: 'AnyDesk 8' }] });
  assert.equal(saved.tools[0].toolId, 'anydesk');
  assert.equal(saved.tools[0].label, 'AnyDesk 8');
});

test('duplicate ids are refused, because two rows would become one on the next save', () => {
  assert.throws(
    () => validateSupportSettings({ tools: [{ ...anydesk, toolId: 'x' }, { ...anydesk, toolId: 'x' }] }),
    /share the id/
  );
});

// These links are rendered to customers as anchors, so a script URL here would
// be stored cross-site scripting with the admin portal as its delivery route.
test('javascript: links are refused', () => {
  assert.throws(
    () => validateSupportSettings({ tools: [{ ...anydesk, url: 'javascript:alert(1)' }] }),
    /must start with https/i
  );
});

test('data: links are refused', () => {
  assert.throws(
    () => validateSupportSettings({ tools: [{ ...anydesk, url: 'data:text/html,<script>alert(1)</script>' }] }),
    /must start with https/i
  );
});

test('a link with no scheme is refused rather than guessed at', () => {
  assert.throws(() => validateSupportSettings({ tools: [{ ...anydesk, url: 'anydesk.com' }] }), /complete link/i);
});

test('plain http is allowed, since some vendor mirrors still are', () => {
  const saved = validateSupportSettings({ tools: [{ ...anydesk, url: 'http://mirror.example/anydesk.exe' }] });
  assert.equal(saved.tools[0].url, 'http://mirror.example/anydesk.exe');
});

test('a tool needs both a label and a link', () => {
  assert.throws(() => validateSupportSettings({ tools: [{ label: '', url: 'https://a.example', active: true }] }), /needs a label/);
  assert.throws(() => validateSupportSettings({ tools: [{ label: 'AnyDesk', url: '', active: true }] }), /needs a link/);
});

test('the list is capped', () => {
  const many = Array.from({ length: MAX_SUPPORT_TOOLS + 1 }, (_, index) => ({ ...anydesk, toolId: `t${index}` }));
  assert.throws(() => validateSupportSettings({ tools: many }), /or fewer/);
});

test('an inactive tool is stored but never offered to customers', () => {
  const saved = validateSupportSettings({ tools: [anydesk, { label: 'Old tool', url: 'https://old.example', active: false }] });
  assert.equal(saved.tools.length, 2);
  assert.deepEqual(publicSupportTools(saved).map((tool) => tool.label), ['AnyDesk']);
});

test('a malformed stored document serves no tools instead of throwing the portal', () => {
  assert.deepEqual(normaliseSupportSettings({ tools: 'not an array' }).tools, []);
  assert.deepEqual(normaliseSupportSettings(undefined).tools, []);
  assert.deepEqual(normaliseSupportSettings({ tools: [{ label: 'Bad', url: 'javascript:alert(1)' }] }).tools, []);
});
