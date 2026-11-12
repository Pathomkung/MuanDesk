// SPDX-License-Identifier: GPL-3.0-only
const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'muandesk-language-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
const { createPlayer } = require('../src/main.cjs');
const { strings, translateError } = require('../src/i18n.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) { for (let i = 0; i < 50; i++) { if (await check()) return; await delay(100); } throw Error(message); }
app.whenReady().then(async () => {
  const instance = createPlayer();
  const { win, player, mini, equalizerWindow, equalizer, language, show } = instance;
  const title = code => win.webContents.executeJavaScript(code, true);
  const menu = code => language.window.webContents.executeJavaScript(code, true);
  const card = code => mini.popup.webContents.executeJavaScript(code, true);
  const eq = code => equalizerWindow.window.webContents.executeJavaScript(code, true);
  const remote = code => player.webContents.executeJavaScript(code, true);
  async function openMenu() {
    await title(`document.querySelector('#language-button').click()`);
    await until(() => language.window?.isVisible(), 'Language dropdown not visible');
    await until(() => menu(`!!document.querySelector('#language-en')`), 'Language options missing');
  }
  async function choose(code) { await openMenu(); await menu(`document.querySelector('#language-${code}').click()`); await until(() => language.get() === code && !language.window.isVisible(), 'Language selection not saved'); }
  try {
    assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.th).sort(), 'Both languages must cover all interface strings');
    assert.equal(translateError('en', 'เชื่อมต่อกับตัวเล่นไม่ได้'), 'Cannot connect to the player');
    await player.webContents.loadFile(path.join(__dirname, 'player.html'));
    await remote(`audio.play();window.pageMarker='same-player'`);
    await until(() => title(`!!document.querySelector('#language-button')`), 'Language button missing');
    assert.equal(await title(`document.querySelector('#language-button').getBoundingClientRect().right <= document.querySelector('#open-equalizer').getBoundingClientRect().left`), true, 'Language selector must be left of EQ');
    assert.equal(await remote('typeof window.appLanguage'), 'undefined', 'Remote page has no language IPC bridge');
    await equalizerWindow.open();
    await until(() => eq(`!!document.querySelector('#eq-preset-label')`), 'EQ window missing');
    const settings = (await equalizer.get()).settings;
    show();
    await openMenu();
    await menu(`document.querySelector('.language-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))`);
    await delay(50);
    await menu(`document.querySelector('.language-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
    await until(() => language.get() === 'en', 'Keyboard did not select English');
    await until(() => title(`document.querySelector('#language-button').textContent === 'English' && document.querySelector('#open-equalizer').title === 'Open equalizer'`), 'Title bar did not translate');
    await until(() => eq(`document.querySelector('#eq-preset-label').textContent === 'Sound preset' && document.querySelector('#eq-preset').textContent === 'Flat'`), 'Open EQ window did not translate');
    await mini.open();
    await until(() => card(`document.querySelector('#expand').textContent.includes('Up next') && document.querySelector('#empty').textContent.startsWith('No songs')`), 'Mini player did not translate');
    assert.equal(await card('document.documentElement.lang'), 'en');
    assert.deepEqual((await equalizer.get()).settings, settings, 'Language switch must preserve EQ settings');
    assert.equal(await remote(`window.pageMarker === 'same-player' && !audio.paused && audio.currentTime > 0`), true, 'Language switch must not reload or stop playback');
    show();
    await win.webContents.reload();
    await until(() => title(`document.querySelector('#language-button')?.textContent === 'English'`), 'Stored language missing after title bar reload');
    assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'language.json'), 'utf8')).language, 'en');
    await choose('th');
    await until(() => eq(`document.querySelector('#eq-preset-label').textContent === 'พรีเซ็ตเสียง'`), 'Thai not restored in open EQ window');
    await mini.open();
    await until(() => card(`document.querySelector('#expand').textContent.includes('เพลงถัดไป')`), 'Thai not restored in mini');
    show(); await openMenu();
    await menu(`document.querySelector('.language-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    await until(() => !language.window.isVisible(), 'Escape did not close language menu');
    assert.equal(win.isVisible(), true);
    await openMenu(); language.window.emit('blur');
    assert.equal(language.window.isVisible(), false, 'Outside focus should dismiss menu');
    assert.throws(() => language.set('xx'), /Unsupported/);
    assert.equal(language.get(), 'th');
    await choose('en');
    fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../artifacts/language-titlebar.png'), (await win.capturePage()).toPNG());
    await openMenu();
    fs.writeFileSync(path.join(__dirname, '../artifacts/language-menu.png'), (await language.window.capturePage()).toPNG());
    language.window.hide();
    equalizerWindow.window.destroy();
    await delay(100);
    mini.popup.destroy();
    equalizer.dispose();
    win.destroy();
    await delay(100);
    const reopened = createPlayer();
    assert.equal(reopened.language.get(), 'en', 'Stored language must survive a new app instance');
    await until(() => reopened.win.webContents.executeJavaScript(`document.querySelector('#language-button')?.textContent === 'English'`, true), 'Reopened interface did not restore English');
    console.log('PASS: custom language dropdown left of EQ, Thai/English sync, keyboard, persistence, validation, isolated IPC and uninterrupted audio');
    app.quit();
  } catch (error) { console.error(error); app.exit(1); }
});

