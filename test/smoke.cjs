// SPDX-License-Identifier: GPL-3.0-only
const { app } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ytmusic-test-'));
app.setPath('userData', profile);
const { createPlayer } = require('../src/main.cjs');
const { isAppUrl } = require('../src/navigation.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function native(action = 'inspect') {
  const { stdout } = await execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'media-session.ps1'), '-Action', action], { windowsHide: true });
  return JSON.parse(stdout.trim());
}
app.whenReady().then(async () => {
  const { player, win, show } = createPlayer();
  const js = code => player.webContents.executeJavaScript(code, true);
  try {
    assert.equal(isAppUrl('https://music.youtube.com/watch?v=test'), true);
    assert.equal(isAppUrl('https://music.youtube.com.evil.example'), false);
    assert.equal(isAppUrl('file:///C:/Windows'), false);
    await player.webContents.loadFile(path.join(__dirname, 'player.html'));
    await js('audio.play()');
    await delay(1500);
    win.close();
    assert.equal(win.isDestroyed(), false);
    assert.equal(win.isVisible(), false);
    const before = await js('audio.currentTime');
    await delay(1500);
    assert.ok(await js('audio.currentTime') > before + 0.5, 'Audio advances while hidden');
    assert.equal(await js('document.visibilityState'), 'visible');
    console.log('PASS: close hides window and audio continues');
    const session = await native();
    assert.equal(session.artist, 'Local test');
    assert.equal(session.status, 'Playing');
    for (const action of ['pause', 'play', 'next', 'previous']) {
      assert.equal((await native(action)).result, true);
      await delay(250);
      if (action === 'pause') assert.equal(await js('audio.paused'), true);
      if (action === 'play') assert.equal(await js('audio.paused'), false);
    }
    assert.deepEqual(await js('window.actions'), { next: 1, previous: 1 });
    console.log('PASS: real Windows SMTC metadata, pause, play, next, previous');
    await js('audio.pause()');
    show();
    assert.equal(win.isVisible(), true);
    await player.webContents.loadURL('https://music.youtube.com/');
    await delay(4000);
    assert.equal(new URL(player.webContents.getURL()).hostname, 'music.youtube.com');
    assert.ok(await js("!!document.querySelector('ytmusic-app')"), 'YouTube Music app loaded');
    assert.equal(await js('typeof require'), 'undefined');
    const screenshot = await player.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../artifacts/youtube-music.png'), screenshot.toPNG());
    console.log('PASS: live YouTube Music loaded, Node isolated, screenshot saved');
    app.quit();
  } catch (error) { console.error(error); app.exit(1); }
});


