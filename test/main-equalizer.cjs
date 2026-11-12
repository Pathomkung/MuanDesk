// SPDX-License-Identifier: GPL-3.0-only
const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'ytmusic-main-eq-')));
const { createPlayer } = require('../src/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  for (let i = 0; i < 50; i++) { if (await check()) return; await delay(100); }
  throw Error(message);
}
app.whenReady().then(async () => {
  const { win, player, equalizerWindow, equalizer, mini, show } = createPlayer();
  const titlebar = code => win.webContents.executeJavaScript(code, true);
  const eq = code => equalizerWindow.window.webContents.executeJavaScript(code, true);
  const card = code => mini.popup.webContents.executeJavaScript(code, true);
  try {
    await player.webContents.session.protocol.handle('https', () => new Response('<!doctype html><style>body{background:#080808;color:#aaa;font:18px Segoe UI;padding:30px}</style><h1>YouTube Music</h1><p>Title bar and equalizer test</p>', { headers: { 'content-type': 'text/html' } }));
    await player.webContents.loadURL('https://music.youtube.com/');
    await until(() => titlebar(`!!document.querySelector('#open-equalizer')`), 'Title bar button missing');
    show();
    const button = await titlebar(`JSON.stringify(document.querySelector('#open-equalizer').getBoundingClientRect().toJSON())`);
    const rect = JSON.parse(button), [width] = win.getContentSize();
    assert.ok(rect.right <= width - 100 && rect.right >= width - 200, 'EQ icon should sit directly before native caption controls: ' + button);
    assert.equal(player.getBounds().y, 34);
    assert.equal(await player.webContents.executeJavaScript('typeof window.titlebar'), 'undefined');
    assert.equal(await player.webContents.executeJavaScript('typeof require'), 'undefined');
    await titlebar(`document.querySelector('#open-equalizer').click()`);
    await until(() => equalizerWindow.window?.isVisible(), 'Title bar did not open EQ window');
    await until(() => eq(`document.querySelectorAll('.eq-band input').length === 10`), 'Standalone EQ did not render');
    assert.equal(await eq(`document.querySelector('#eq-panel').scrollHeight > document.querySelector('#eq-panel').clientHeight`), false, 'Standalone EQ should fit without scrolling');
    const first = equalizerWindow.window.id;
    await titlebar(`document.querySelector('#open-equalizer').click()`);
    assert.equal(equalizerWindow.window.id, first, 'Repeated clicks must reuse one EQ window');
    await eq(`document.querySelector('#eq-enabled').click();document.querySelector('#eq-preset').click()`);
    await until(() => eq(`!!document.querySelector('#eq-option-rock')`), 'Standalone custom dropdown missing');
    await eq(`document.querySelector('#eq-option-rock').click()`);
    await until(async () => (await equalizer.get()).settings.preset === 'rock', 'Standalone preset did not reach audio controller');
    await mini.open();
    await card(`document.querySelector('#eq-button').click()`);
    await until(() => card(`document.querySelector('#eq-preset')?.dataset.value === 'rock'`), 'Mini did not reflect standalone preset');
    await card(`{const slider=document.querySelector('#eq-band-0');slider.value=8;slider.dispatchEvent(new Event('input',{bubbles:true}));}`);
    await until(() => eq(`document.querySelector('#eq-band-0').value === '8' && document.querySelector('#eq-preset').dataset.value === 'custom'`), 'Standalone EQ did not reflect mini change');
    mini.hide();
    equalizerWindow.window.close();
    assert.equal(equalizerWindow.window.isVisible(), false);
    await titlebar(`document.querySelector('#open-equalizer').click()`);
    await until(() => equalizerWindow.window.isVisible(), 'EQ window did not reopen');
    assert.equal(equalizerWindow.window.id, first);
    win.setSize(900, 650);
    await delay(200);
    const [resizedWidth, resizedHeight] = win.getContentSize();
    assert.deepEqual(player.getBounds(), { x: 0, y: 34, width: resizedWidth, height: resizedHeight - 34 });
    fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../artifacts/main-titlebar.png'), (await win.capturePage()).toPNG());
    fs.writeFileSync(path.join(__dirname, '../artifacts/equalizer-window.png'), (await equalizerWindow.window.capturePage()).toPNG());
    console.log('PASS: titlebar EQ icon beside native controls, standalone window reuse, two-way EQ sync, resize and isolated player');
    app.once('will-quit', () => console.log('PASS: app quits with EQ window open'));
    setTimeout(() => { console.error('App quit blocked by EQ window'); app.exit(1); }, 2000).unref();
    app.quit();
  } catch (error) { console.error(error); app.exit(1); }
});

