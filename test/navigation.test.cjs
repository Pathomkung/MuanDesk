// SPDX-License-Identifier: GPL-3.0-only
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isAppUrl } = require('../src/navigation.cjs');

test('allows the observed password, optional selfie and Thailand session return flow', () => {
  for (const url of [
    'https://accounts.google.com/v3/signin/challenge/pwd',
    'https://accounts.google.com/CheckCookie',
    'https://myaccount.google.com/verification/selfie/precollection',
    'https://myaccount.google.com/accounts/SetOSID',
    'https://accounts.youtube.com/accounts/SetSID',
    'https://accounts.google.co.th/accounts/SetSID',
    'https://www.youtube.com/signin?action_handle_signin=true',
    'https://www.youtube.com/signin_prompt',
    'https://music.youtube.com/',
  ]) assert.equal(isAppUrl(url), true, url);
});

test('allows account services on Google country domains, and only account paths on www', () => {
  for (const url of [
    'https://accounts.google.co.jp/accounts/SetSID',
    'https://accounts.google.co.uk/accounts/SetSID',
    'https://accounts.google.com.hk/accounts/SetSID',
    'https://consent.google.co.th/',
    'https://www.google.co.th/accounts/SetSID',
  ]) assert.equal(isAppUrl(url), true, url);
  assert.equal(isAppUrl('https://www.google.co.th/search?q=test'), false);
});

test('rejects lookalikes, unknown domains, unsafe schemes and unrelated YouTube routes', () => {
  for (const url of [
    'https://accounts.google.co.th.evil.example/accounts/SetSID',
    'https://accounts.google.invalid/accounts/SetSID',
    'https://evil.accounts.google.co.th/accounts/SetSID',
    'https://accounts-google.co.th/accounts/SetSID',
    'https://www.youtube.com/signin_evil',
    'https://www.youtube.com/watch?v=test',
    'https://www.google.co.th/accountsevil',
    'https://accounts.google.co.th:8443/accounts/SetSID',
    'https://evil.example@accounts.google.co.th/accounts/SetSID',
    'http://accounts.google.co.th/accounts/SetSID',
    'file:///C:/Windows',
    'javascript:alert(1)',
    'invalid',
  ]) assert.equal(isAppUrl(url), false, url);
});

