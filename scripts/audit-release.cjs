// SPDX-License-Identifier: GPL-3.0-only
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { root, source } = require('./release-files.cjs');
const forbiddenName = /(?:^|\/)(?:artifacts|node_modules|\.git|\.env(?:\..*)?|user.?data|profile|Partitions|Cache|Code Cache|GPUCache|Local Storage|Session Storage|IndexedDB|Cookies(?:-journal)?|Login Data(?:-journal)?|History(?:-journal)?|Local State|Preferences|Web Data|equalizer\.json|language\.json|.*\.(?:log|dmp|pem|pfx|p12))$/i;
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Google API key', /AIza[\w-]{35}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['personal email address', /\b[\w.+-]+@(?:gmail|hotmail|outlook|yahoo|icloud)\.com\b/i],
  ['Windows home path', /\b[A-Z]:[\\/]Users[\\/][^\s\\/"']+/i],
  ['authorization header', /Authorization\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._~-]{16,}/i],
  ['session cookie value', /\b(?:SAPISID|__Secure-\dPAPISID|__Secure-\dPSID)\s*[:=]\s*["']?[A-Za-z0-9._~-]{12,}/],
];
function auditEntries(entries) {
  const failures = [];
  for (const { name, data } of entries) {
    const normalized = name.replaceAll('\\', '/').replace(/^\//, '');
    if (normalized.split('/').some((_, index, parts) => forbiddenName.test(parts.slice(0, index + 1).join('/')))) failures.push(`${normalized}: private file name`);
    if (/\.(?:png|ico|tar\.gz)$/i.test(normalized)) continue;
    const content = data.toString('utf8');
    for (const [label, regex] of patterns) if (regex.test(content)) failures.push(`${normalized}: ${label}`);
    if (process.env.USERNAME && content.toLowerCase().includes(process.env.USERNAME.toLowerCase())) failures.push(`${normalized}: local user identifier`);
  }
  if (failures.length) throw Error('Release privacy check failed:\n' + failures.join('\n'));
  return entries.length;
}
function auditSource() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.license !== 'GPL-3.0-only' || lock.packages[''].license !== manifest.license) throw Error('Project license metadata must match GPL-3.0-only');
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
  if (license.length < 30000 || !license.includes('Version 3, 29 June 2007') || !license.includes('Conveying Non-Source Forms')) throw Error('Complete GPLv3 license text is missing');
  const sources = JSON.parse(fs.readFileSync(path.join(root, 'third_party/sources.json'), 'utf8')).archives;
  for (const archive of sources) {
    if (path.basename(archive.file) !== archive.file) throw Error('Unsafe dependency source archive name');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'third_party', archive.file))).digest('hex');
    if (hash !== archive.sha256) throw Error('Dependency source archive checksum mismatch: ' + archive.file);
    for (const [name, version] of Object.entries(archive.packages)) if (lock.packages[`node_modules/${name}`]?.version !== version) throw Error('Update dependency source snapshot for ' + name);
  }
  const count = auditEntries(source.map(name => ({ name, data: fs.readFileSync(path.join(root, name)) })));
  console.log(`PASS: ${count} allowlisted source files checked; no account files or matching secret/personal-data patterns`);
  console.log('PASS: full GPLv3 text, metadata and pinned UI dependency source archives verified');
  return count;
}
if (require.main === module) { try { auditSource(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { auditEntries, auditSource };

