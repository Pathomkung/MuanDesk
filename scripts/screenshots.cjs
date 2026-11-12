// SPDX-License-Identifier: GPL-3.0-only
const { app, desktopCapturer, nativeTheme } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'muandesk-docs-live-')));
const { createPlayer } = require('../src/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message, attempts = 180) {
  for (let i = 0; i < attempts; i++) { if (await check()) return; await delay(500); }
  throw Error(message);
}
app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  const { win, player, mini, equalizerWindow, equalizer, show } = createPlayer();
  const remote = code => player.webContents.executeJavaScript(code, true);
  const ui = code => mini.popup.webContents.executeJavaScript(code, true);
  try {
    await player.webContents.loadURL('https://music.youtube.com/watch?v=ObRKDMABsdY&list=RDAMVMObRKDMABsdY');
    await remote(`document.querySelector('video')?.play().catch(()=>{})`);
    await until(() => remote(`!document.querySelector('.ad-showing') && !!navigator.mediaSession.metadata?.title && document.querySelector('video')?.currentTime > 1 && document.querySelectorAll('ytmusic-player-queue-item').length > 3`), 'Real music/queue did not become ready');
    await until(() => remote(`!!document.querySelector('a[href*="accounts.google.com/ServiceLogin"]')`), 'Expected a signed-out YouTube Music page', 30);
    show();
    await delay(1200);
    const directory = path.join(__dirname, '../docs/screenshots');
    fs.mkdirSync(directory, { recursive: true });
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1600, height: 1200 } });
    const main = sources.find(source => source.id === win.getMediaSourceId());
    if (!main || main.thumbnail.isEmpty()) throw Error('Could not capture the actual composited main window');
    fs.writeFileSync(path.join(directory, 'main-window.png'), main.thumbnail.toPNG());
    win.hide(); await mini.open();
    await until(() => ui(`document.querySelectorAll('.song').length > 3`), 'Live mini queue did not render', 40);
    await ui(`document.querySelector('#expand').click()`);
    await until(() => ui(`!document.querySelector('#queue-panel').hidden && [...document.querySelectorAll('.song img')].slice(0,5).every(img=>img.complete && img.naturalWidth > 0)`), 'Live artwork did not load', 40);
    await delay(500);
    fs.writeFileSync(path.join(directory, 'mini-player.png'), (await mini.popup.webContents.capturePage()).toPNG());
    await equalizer.set({ enabled: true, preset: 'rock', gains: [4,3,1,-1,-2,0,2,3,4,3], customGains: Array(10).fill(0) });
    mini.hide(); show(); await equalizerWindow.open();
    await until(() => equalizerWindow.window.webContents.executeJavaScript(`document.querySelectorAll('.eq-band input').length === 10`, true), 'EQ did not render', 40);
    await delay(500);
    const eqSources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 800, height: 800 } });
    const eqSource = eqSources.find(source => source.id === equalizerWindow.window.getMediaSourceId());
    const eqImage = eqSource && !eqSource.thumbnail.isEmpty() ? eqSource.thumbnail : await equalizerWindow.window.webContents.capturePage();
    fs.writeFileSync(path.join(directory, 'equalizer.png'), eqImage.toPNG());
    console.log('PASS: real signed-out YouTube Music main window, live queue mini player and EQ captured; no mock data or network interception');
    app.quit();
  } catch (error) { console.error(error); app.exit(1); }
});

