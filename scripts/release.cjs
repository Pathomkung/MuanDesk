// SPDX-License-Identifier: GPL-3.0-only
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { root, source, copyFiles } = require('./release-files.cjs');
const { auditSource } = require('./audit-release.cjs');
auditSource();
const manifest = require('../package.json');
const output = path.join(root, 'dist/releases');
fs.mkdirSync(output, { recursive: true });
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'muandesk-source-'));
const sourceDirectory = path.join(staging, 'MuanDesk');
copyFiles(source, sourceDirectory);
const archives = [
  [`MuanDesk-${manifest.version}-source.zip`, sourceDirectory],
];
for (const [name, directory] of archives) {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'archive.ps1'), '-Source', directory, '-Destination', path.join(output, name)], { windowsHide: true, stdio: 'inherit' });
}
const setupName = `MuanDesk-Setup-${manifest.version}-x64.exe`;
if (!fs.existsSync(path.join(output, setupName))) throw Error('Build the setup executable before creating a release');
const hashes = [...archives.map(([name]) => name), setupName].map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(output, name))).digest('hex')}  ${name}`);
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
const report = {
  version: manifest.version, checkedAt: new Date().toISOString(), sourceFiles: source.length,
  license: manifest.license,
  sourceAllowlist: source, checks: ['Exact source and runtime allowlists', 'No profile/cookie/cache/log files', 'No matching key, account email or local-user path patterns', 'Runtime ASAR matches allowlist', 'Original app icon', 'Third-party license notices retained', 'Full GPLv3 text and project notice', 'Pinned bundled UI dependency sources included and checksum-verified'],
  limitations: 'Pattern scan and file allowlists, not a guarantee that arbitrary future files contain no private data. Local artifacts and browser profiles are excluded, not deleted.',
};
fs.writeFileSync(path.join(output, 'RELEASE-AUDIT.json'), JSON.stringify(report, null, 2));
console.log('Created source ZIP, setup EXE checksums and RELEASE-AUDIT.json in dist/releases');

