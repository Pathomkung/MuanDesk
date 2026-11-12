// SPDX-License-Identifier: GPL-3.0-only
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { root, runtime, copyFiles } = require('./release-files.cjs');
const { auditEntries, auditSource } = require('./audit-release.cjs');
async function main() {
  const manifest = require('../package.json');
  auditSource();
  auditEntries(runtime.map(name => ({ name, data: fs.readFileSync(path.join(root, name)) })));
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'muandesk-package-'));
  copyFiles(runtime, staging);
  const packagedManifest = { name: manifest.name, productName: manifest.productName, version: manifest.version, description: manifest.description, license: manifest.license, main: manifest.main };
  fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify(packagedManifest, null, 2));
  const out = path.resolve(root, 'dist');
  const target = path.resolve(out, `${manifest.productName}-win32-x64`);
  if (path.dirname(target) !== out || !target.startsWith(root + path.sep)) throw Error('Unsafe package output path');
  const { packager } = await import('@electron/packager');
  const [output] = await packager({
    dir: staging, out, name: manifest.productName, executableName: manifest.productName,
    platform: 'win32', arch: 'x64', electronVersion: require('electron/package.json').version,
    overwrite: true, asar: true, prune: false, icon: path.join(root, 'assets/icon.ico'),
    appCopyright: 'Copyright (c) 2026 MuanDesk contributors',
    win32metadata: { CompanyName: 'MuanDesk contributors', ProductName: 'MuanDesk', FileDescription: manifest.description },
  });
  const asar = await import('@electron/asar');
  const archive = path.join(output, 'resources/app.asar');
  const files = asar.listPackage(archive).map(name => name.replace(/^[\\/]/, '')).filter(name => asar.statFile(archive, name).size !== undefined);
  const expected = new Set(runtime);
  for (const name of files) if (!expected.has(name.replaceAll('\\', '/').replace(/^\//, ''))) throw Error('Unexpected packaged file: ' + name);
  if (files.length !== runtime.length) throw Error('Packaged file list differs from runtime allowlist');
  auditEntries(files.map(name => ({ name, data: asar.extractFile(archive, name) })));
  for (const name of ['LICENSE', 'NOTICE', 'SOURCE.md', 'README.md', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md']) {
    fs.copyFileSync(path.join(root, name), path.join(output, name === 'LICENSE' ? 'LICENSE.MuanDesk' : name));
  }
  for (const name of runtime.filter(file => file.startsWith('docs/screenshots/'))) {
    const target = path.join(output, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, name), target);
  }
  console.log(`PASS: packaged ${files.length} allowlisted application files; Electron/Chromium licenses retained`);
  console.log(path.relative(root, output));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

