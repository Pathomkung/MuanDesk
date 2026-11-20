// SPDX-License-Identifier: GPL-3.0-only
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { createMiniPlayer } = require('../src/mini-player.cjs');
const { createLanguage } = require('../src/language.cjs');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'muandesk-seek-')));

const fixture = `<!doctype html>
<style>ytmusic-player-queue, ytmusic-player-queue-item { display: block; }</style>
<div id="movie_player"><video></video></div>
<ytmusic-player-bar><span class="title">Fixture song</span></ytmusic-player-bar>
<ytmusic-player-queue>
  <ytmusic-player-queue-item selected><span class="song-title">Fixture song</span></ytmusic-player-queue-item>
  <ytmusic-player-queue-item><span class="song-title">Fixture song</span></ytmusic-player-queue-item>
</ytmusic-player-queue>
<script>
const video = document.querySelector('video');
const player = document.querySelector('#movie_player');
player.getVideoData = () => ({ video_id: 'track' });
const rows = [...document.querySelectorAll('ytmusic-player-queue-item')];
for (const row of rows) row.data = { videoId: 'track', playlistSetVideoId: 'duplicate' };
window.loadTrack = () => {
  const rate = 8000, bytes = 24 * rate * 2;
  const buffer = new ArrayBuffer(44 + bytes), data = new DataView(buffer);
  function text(offset, value) {
    for (let i = 0; i < value.length; i++) data.setUint8(offset + i, value.charCodeAt(i));
  }
  text(0, 'RIFF'); data.setUint32(4, 36 + bytes, true); text(8, 'WAVE');
  text(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, 1, true); data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true);
  data.setUint16(32, 2, true); data.setUint16(34, 16, true); text(36, 'data'); data.setUint32(40, bytes, true);
  video.src = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};
</script>`;

async function until(check, message) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await check()) return;
    await delay(75);
  }
  throw new Error(message);
}

app.whenReady().then(async () => {
  const player = new BrowserWindow({
    show: false,
    webPreferences: { partition: 'seek-fixture', sandbox: true, contextIsolation: true, backgroundThrottling: false },
  });
  try {
    const session = player.webContents.session;
    await session.protocol.handle('https', () => new Response(fixture, { headers: { 'content-type': 'text/html' } }));
    await player.loadURL('https://music.youtube.com/watch?v=track');
    const language = createLanguage(player);
    const tray = Object.assign(new EventEmitter(), { getBounds: () => player.getBounds() });
    const { popup } = createMiniPlayer(player, tray, null, () => player.show(), null, language);
    popup.webContents.setBackgroundThrottling(false);
    const remote = source => player.webContents.executeJavaScript(source, true);
    const ui = source => popup.webContents.executeJavaScript(source);
    const refresh = () => popup.webContents.send('mini:refresh');
    const position = () => remote('video.currentTime');
    const slider = 'document.querySelector("#progress")';
    const mediaNear = (seconds, tolerance = 0.2) => until(async () => Math.abs(await position() - seconds) < tolerance, `Playback did not seek to ${seconds}s`);
    const debuggerSession = popup.webContents.debugger;
    const mouse = (type, { x, y }, pressed) => debuggerSession.sendCommand('Input.dispatchMouseEvent', {
      type, x, y, buttons: Number(pressed), button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1,
    });
    const key = async (name, code) => {
      const event = { key: name, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
      await debuggerSession.sendCommand('Input.dispatchKeyEvent', { ...event, type: 'rawKeyDown' });
      await debuggerSession.sendCommand('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
    };
    const point = fraction => ui(`(() => {
      const { x, y, width, height } = ${slider}.getBoundingClientRect();
      return { x: x + width * ${fraction}, y: y + height / 2 };
    })()`);
    const click = async fraction => {
      const target = await point(fraction);
      await mouse('mousePressed', target, true);
      await mouse('mouseReleased', target, false);
    };
    const assertLayout = () => ui(`(() => {
      const rail = ${slider}.getBoundingClientRect();
      const elapsed = document.querySelector('#time').getBoundingClientRect();
      const duration = document.querySelector('#duration').getBoundingClientRect();
      const queue = document.querySelector('#expand').getBoundingClientRect();
      return rail.height >= 24 && rail.width > 0 && elapsed.right <= rail.left
        && rail.right <= duration.left && duration.right < innerWidth
        && rail.bottom <= queue.top && queue.bottom <= innerHeight;
    })()`);

    await until(() => ui(`${slider}?.tagName === 'INPUT' && ${slider}.disabled`), 'Timeline is not disabled before media loads');
    debuggerSession.attach('1.3');
    await remote('window.loadTrack()');
    await until(() => remote('video.seekable.length > 0 && video.readyState >= 1'), 'Local audio fixture did not load');
    refresh();
    await until(() => ui(`!${slider}.disabled`), 'Seekable media did not enable the timeline');
    assert.equal(await assertLayout(), true, 'Compact timeline is clipped or too small to use');
    assert.equal(await ui(`${slider}.getAttribute('aria-label')`), language.t('seekPosition'));
    await click(0.5);
    await mediaNear(12, 0.6);
    assert.equal(await remote('video.paused'), true, 'Click to seek resumed paused playback');
    assert.equal(player.isVisible(), false, 'Seeking opened the main player window');
    console.log('PASS: ready and disabled timeline, compact geometry, and click-to-seek with the main window hidden');

    await ui("document.querySelector('#next').focus()");
    await key('Tab', 9);
    assert.equal(await ui('document.activeElement.id'), 'progress');
    const beforeArrow = await position();
    await key('ArrowRight', 39);
    await mediaNear(beforeArrow + 5, 0.6);
    await key('ArrowLeft', 37);
    await mediaNear(beforeArrow, 0.6);
    await key('Home', 36);
    await mediaNear(0);
    await key('End', 35);
    await mediaNear(24);
    await key('Tab', 9);
    assert.equal(await ui('document.activeElement.id'), 'expand');
    assert.equal(await remote('video.paused'), true);
    console.log('PASS: tab order, five-second arrows, Home and End, and paused playback');

    await remote('video.currentTime = 2; video.play()');
    refresh();
    await until(() => ui("document.querySelector('#time').textContent === '0:02'"), 'Playing position did not reach the timeline');
    const dragStart = await point(0.25);
    const dragEnd = await point(0.75);
    await mouse('mousePressed', dragStart, true);
    await mouse('mouseMoved', dragEnd, true);
    await until(() => ui("Number(document.querySelector('#time').textContent.split(':').at(-1)) >= 17"), 'Drag did not preview the target time');
    assert.ok(await position() < 6, 'Dragging moved the real player before release');
    refresh();
    await delay(150);
    assert.ok(await ui(`Number(${slider}.value) >= 17`), 'Polling overwrote the drag preview');
    await mouse('mouseReleased', dragEnd, false);
    await mediaNear(18, 1);
    assert.equal(await remote('video.paused'), false, 'Seeking interrupted playback');
    console.log('PASS: drag preview survives a refresh, release seeks, and active playback continues');

    await remote('video.pause(); video.currentTime = 2');
    refresh();
    await until(() => ui("document.querySelector('#time').textContent === '0:02'"), 'Paused position did not reach the timeline');
    const original = await ui('window.mini.snapshot()');
    await mouse('mousePressed', dragStart, true);
    await mouse('mouseMoved', dragEnd, true);
    await remote("rows[0].removeAttribute('selected'); rows[1].setAttribute('selected', '')");
    const repeat = await ui('window.mini.snapshot()');
    assert.notEqual(repeat.seek.occurrence, original.seek.occurrence, 'Repeated tracks have the same seek identity');
    await mouse('mouseReleased', dragEnd, false);
    assert.deepEqual(await ui(`window.mini.seek(${JSON.stringify(original.seek.occurrence)}, 18)`), { status: 'stale' });
    refresh();
    await until(() => ui("document.querySelector('#time').textContent === '0:02'"), 'Track change left a stale preview');
    await mediaNear(2);
    assert.equal(await ui("document.querySelector('#error').hidden"), true, 'A stale drag showed an error');
    console.log('PASS: a duplicate occurrence rejects a drag intended for the previous occurrence');

    await remote("document.querySelector('#movie_player').classList.add('ad-showing')");
    refresh();
    await until(() => ui(`${slider}.disabled`), 'An ad did not disable seeking');
    await click(0.75);
    await mediaNear(2);
    await remote(`document.querySelector('#movie_player').classList.remove('ad-showing');
      Object.defineProperty(video, 'seekable', { configurable: true, value: { length: 0 } })`);
    refresh();
    assert.equal((await ui('window.mini.snapshot()')).seek, null, 'Media without seekable ranges allowed seeking');
    await remote('delete video.seekable');
    refresh();
    await until(() => ui(`!${slider}.disabled`), 'Timeline did not re-enable after the ad');

    language.set('en');
    await until(() => ui("document.documentElement.lang === 'en'"), 'Mini player did not switch to English');
    await remote(`video.currentTime = 4;
      Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime').get,
      set: () => { throw new Error('Simulated media failure'); },
    })`);
    await click(0.7);
    await until(() => ui("!document.querySelector('#error').hidden"), 'Seek failure did not display a status message');
    assert.equal(await ui("document.querySelector('#error').textContent"), language.t('seekFailed'));
    assert.equal(await ui("document.querySelector('#time').textContent"), '0:04');
    await remote('delete video.currentTime');
    console.log('PASS: ads and unseekable media disable the control, and failed seeks recover to the actual time');

    await ui("document.querySelector('#expand').click()");
    await until(() => ui("!document.querySelector('#queue-panel').hidden"), 'Up next did not expand');
    popup.setContentSize(300, 420);
    await until(() => ui('innerWidth === 300 && innerHeight === 420'), 'Mini player did not resize to the narrow layout');
    assert.equal(await assertLayout(), true, 'Timeline overflows the expanded narrow window');
    assert.equal(await ui("document.querySelectorAll('.song[aria-current=true]').length"), 1);
    const tap = await point(0.5);
    await debuggerSession.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tap] });
    await debuggerSession.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mediaNear(12, 0.6);
    console.log('PASS: narrow expanded layout keeps the timeline above Up next, marks one current song, and accepts touch input');
    debuggerSession.detach();
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
