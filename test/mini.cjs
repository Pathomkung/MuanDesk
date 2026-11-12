// SPDX-License-Identifier: GPL-3.0-only
const { app, screen } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'ytmusic-mini-')));
const { createPlayer } = require('../src/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message, attempts = 40) {
  for (let i = 0; i < attempts; i++) { if (await check()) return; await delay(500); }
  throw new Error(message);
}
app.whenReady().then(async () => {
  const { player, win, mini, tray } = createPlayer();
  const js = source => mini.popup.webContents.executeJavaScript(source, true);
  const remote = source => player.webContents.executeJavaScript(source, true);
  try {
    await player.webContents.loadURL('https://music.youtube.com/watch?v=ObRKDMABsdY&list=RDAMVMObRKDMABsdY');
    await until(() => remote(`document.querySelectorAll('ytmusic-player-queue-item').length > 2`), 'Live queue did not load');
    win.close();
    tray.emit('click');
    await until(() => mini.popup.isVisible(), 'Tray click did not open card');
    await until(() => js(`!!document.querySelector('#title').textContent && document.querySelectorAll('.song').length > 2`), 'Card queue did not load');
    assert.equal(win.isVisible(), false);
    assert.equal(await remote('typeof window.mini'), 'undefined');
    assert.equal(await js('typeof require'), 'undefined');
    const compact = mini.popup.getBounds();
    await js(`document.querySelector('#expand').click()`);
    await until(() => js(`document.querySelector('#expand').getAttribute('aria-expanded') === 'true'`), 'Expand failed');
    assert.ok(mini.popup.getBounds().height > compact.height);
    const bounds = mini.popup.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    assert.ok(bounds.x >= area.x && bounds.y >= area.y && bounds.x + bounds.width <= area.x + area.width && bounds.y + bounds.height <= area.y + area.height);
    const snapshot = await js('window.mini.snapshot()');
    const visibleWebsiteQueue = await remote(`(()=>{
      const root=[...document.querySelectorAll('ytmusic-player-queue')].find(queue=>queue.getClientRects().length>0);
      return [...(root?.querySelectorAll('ytmusic-player-queue-item')||[])].filter(row=>row.getClientRects().length>0)
        .map(row=>({title:row.querySelector('.song-title')?.textContent.trim(),duration:row.querySelector('.duration')?.textContent.trim()||''}));
    })()`);
    assert.deepEqual(snapshot.queue.map(item=>({title:item.title,duration:item.duration})),visibleWebsiteQueue,'Mini queue matches the website row order and track versions');
    assert.equal(snapshot.queue.filter(item=>item.current).length,1,'Exactly one current track');
    const selected = snapshot.queue.findIndex(item => item.current);
    const target = snapshot.queue[selected + 1];
    assert.ok(target, 'Next song available');
    await until(() => js(`document.querySelector('#queue-panel').getBoundingClientRect().height > 100 && document.querySelector('.song').getBoundingClientRect().height > 40`), 'Expanded queue is not visible');
    await delay(350);
    const image = await mini.popup.webContents.capturePage();
    fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../artifacts/mini-expanded.png'), image.toPNG());
    await js(`document.querySelectorAll('.song')[1].click()`);
    await until(() => remote(`document.querySelector('ytmusic-player-queue-item[selected]')?.data?.playlistSetVideoId === ${JSON.stringify(target.key)}`), 'Clicking card song did not select live YouTube Music queue item');
    assert.equal(win.isVisible(), false);
    await until(() => js(`document.querySelector('.song[aria-current="true"]')?.dataset.key === ${JSON.stringify(target.key)}`), 'Current track did not refresh');
    await until(() => remote(`!document.querySelector('.ad-showing') && new URL(location.href).searchParams.get('v') === ${JSON.stringify(target.videoId)} && document.querySelector('video')?.currentTime > 1 && document.querySelector('video')?.paused === false`), 'Selected song did not start after advertisements', 180);
    await delay(500);
    await js(`document.querySelector('#toggle').click()`);
    await until(() => remote(`document.querySelector('video')?.paused === true`), 'Mini pause failed');
    await js(`document.querySelector('#toggle').click()`);
    await until(() => remote(`document.querySelector('video')?.paused === false`), 'Mini play failed');
    await delay(1200);
    fs.writeFileSync(path.join(__dirname, '../artifacts/mini-expanded.png'), (await mini.popup.webContents.capturePage()).toPNG());
    console.log('PASS: tray opens mini card, expands live queue, selects song while main window stays hidden:', target.title);
    await js(`window.mini.select('stale-queue-key').then(() => {throw Error('Accepted stale key')}, error => error.message)`);
    await js(`document.querySelector('#expand').click()`);
    await until(() => mini.popup.getBounds().height === compact.height, 'Collapse failed');
    mini.popup.emit('blur');
    assert.equal(mini.popup.isVisible(), false);
    await delay(250);
    tray.emit('click');
    await until(() => mini.popup.isVisible(), 'Tray reopen failed');
    mini.popup.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    await until(() => !mini.popup.isVisible(), 'Escape did not hide card');
    await mini.open();
    await js(`document.querySelector('#open').click()`);
    await until(() => win.isVisible() && !mini.popup.isVisible(), 'Open full app failed');
    await remote(`document.querySelector('video')?.pause()`);
    console.log('PASS: collapse, blur dismissal, Escape, reopen and full player');
    app.quit();
  } catch (error) {
    console.error(error);
    console.log('Playback diagnostic:', await remote(`JSON.stringify({title:navigator.mediaSession.metadata?.title,ad:!!document.querySelector('.ad-showing'),video:[...document.querySelectorAll('video')].map(v=>({paused:v.paused,time:v.currentTime})),body:document.body.innerText.slice(-1200)})`).catch(String));
    app.exit(1);
  }
});


