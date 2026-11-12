// SPDX-License-Identifier: GPL-3.0-only
const fs = require('node:fs');
const path = require('node:path');
const { build, Platform, Arch } = require('electron-builder');
const { root, runtime } = require('./release-files.cjs');
const { auditEntries } = require('./audit-release.cjs');
async function main() {
  const directory = path.join(root, 'dist/MuanDesk-win32-x64');
  const asar = await import('@electron/asar');
  const archive = path.join(directory, 'resources/app.asar');
  const entries = asar.listPackage(archive).map(name => name.replace(/^[\\/]/, '')).filter(name => asar.statFile(archive, name).size !== undefined);
  const names = entries.map(name => name.replaceAll('\\', '/')).sort();
  if (JSON.stringify(names) !== JSON.stringify([...runtime].sort())) throw Error('Installer input does not match the runtime allowlist');
  auditEntries(entries.map(name => ({ name, data: asar.extractFile(archive, name) })));
  const config = JSON.parse(fs.readFileSync(path.join(root, 'electron-builder.json'), 'utf8'));
  const results = await build({ projectDir: root, prepackaged: directory, targets: Platform.WINDOWS.createTarget('nsis', Arch.x64), publish: 'never', config });
  const installer = results.find(file => file.endsWith('.exe'));
  if (!installer || !fs.existsSync(installer)) throw Error('Setup executable was not created');
  const published = path.join(root, 'dist/releases', path.basename(installer));
  fs.mkdirSync(path.dirname(published), { recursive: true });
  fs.copyFileSync(installer, published);
  console.log('PASS: setup built from the reviewed application payload');
  console.log(path.relative(root, published));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

