// SPDX-License-Identifier: GPL-3.0-only
const fs = require('node:fs');
const path = require('node:path');

// Google's published domain list, bundled so sign-in policy works offline.
const googleDomains = new Set(fs.readFileSync(path.join(__dirname, '../assets/google-domains.txt'), 'utf8')
  .trim().split(/\s+/).map(domain => domain.replace(/^\./, '')));
const googleAccountHosts = new Set([...googleDomains]
  .flatMap(domain => ['accounts', 'myaccount', 'consent'].map(service => `${service}.${domain}`)));
const playerHosts = new Set(['music.youtube.com', 'accounts.youtube.com', 'consent.youtube.com']);

function isAppUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    if (playerHosts.has(url.hostname) || googleAccountHosts.has(url.hostname)) return true;
    if (url.hostname === 'www.youtube.com') return /^\/signin(?:_prompt)?(?:\/|$)/.test(url.pathname);
    return url.hostname.startsWith('www.') && googleDomains.has(url.hostname.slice(4)) && /^\/accounts(?:\/|$)/.test(url.pathname);
  } catch { return false; }
}

module.exports = { isAppUrl };


