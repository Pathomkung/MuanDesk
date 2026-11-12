// SPDX-License-Identifier: GPL-3.0-only
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { auditEntries, auditSource } = require('../scripts/audit-release.cjs');
const { source, runtime, root } = require('../scripts/release-files.cjs');
const { configureProfile } = require('../src/profile.cjs');
const os = require('node:os');
test('publication allowlists contain only reviewed source and runtime files', () => {
  assert.equal(new Set(source).size, source.length);
  assert.equal(new Set(runtime).size, runtime.length);
  assert.ok(!source.some(name => /^(?:artifacts|dist|node_modules)\//.test(name)));
  assert.ok(source.includes('LICENSE') && source.includes('src/mini/app.jsx'));
  assert.ok(!source.includes('src/mini/app.bundle.js'));
  assert.ok(runtime.includes('src/mini/app.bundle.js'));
  for (const name of source) assert.ok(fs.statSync(path.join(root, name)).isFile(), name);
  auditSource();
});
test('privacy audit rejects account files and local account paths without echoing contents', () => {
  const sensitive = ['Partitions/ytmusic/Cookies', 'artifacts/screenshot.png', '.env', 'equalizer.json', 'profile/History'];
  for (const name of sensitive) assert.throws(() => auditEntries([{ name, data: Buffer.from('private') }]));
  const personalPath = ['D:', 'Users', 'private-person', 'profile'].join('\\');
  assert.throws(() => auditEntries([{ name: 'README.md', data: Buffer.from(personalPath) }]), error => error.message.includes('Windows home path') && !error.message.includes('private-person'));
});
test('rename reuses only an existing local legacy app profile; fresh installs get new brand', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'muandesk-profile-test-'));
  let selected;
  const app = { getPath: () => directory, setPath: (_key, value) => { selected = value; } };
  configureProfile(app);
  assert.equal(selected, path.join(directory, 'MuanDesk'));
  const legacy = path.join(directory, 'YT Music');
  fs.mkdirSync(path.join(legacy, 'Partitions/ytmusic'), { recursive: true });
  fs.writeFileSync(path.join(legacy, 'equalizer.json'), '{}');
  configureProfile(app);
  assert.equal(selected, legacy);
  fs.mkdirSync(path.join(directory, 'MuanDesk'));
  configureProfile(app);
  assert.equal(selected, legacy, 'An empty directory or render cache is not a website profile');
  fs.mkdirSync(path.join(directory, 'MuanDesk', 'Partitions', 'ytmusic'), { recursive: true });
  configureProfile(app);
  assert.equal(selected, path.join(directory, 'MuanDesk'));
});

