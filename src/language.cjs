// SPDX-License-Identifier: GPL-3.0-only
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { translate } = require('./i18n.cjs');

function createLanguage(parent) {
  const file = path.join(app.getPath('userData'), 'language.json');
  let language = 'th';
  try { const stored = JSON.parse(fs.readFileSync(file, 'utf8')).language; if (['th', 'en'].includes(stored)) language = stored; } catch {}
  const clients = new Map(), listeners = new Set();
  let menu, ready;
  const menuFile = path.join(__dirname, 'titlebar/language.html');
  function authorize(event) {
    const client = clients.get(event.sender);
    if (!client || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== client.url) throw Error('Untrusted language sender');
    return client;
  }
  function register(contents, localFile, canSet = false) {
    clients.set(contents, { url: pathToFileURL(localFile).href, canSet });
    contents.once('destroyed', () => clients.delete(contents));
  }
  function get() { return language; }
  function set(next) {
    if (!['th', 'en'].includes(next)) throw Error('Unsupported language');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify({ language: next }));
    fs.renameSync(file + '.tmp', file);
    language = next;
    for (const contents of clients.keys()) if (!contents.isDestroyed()) contents.send('language:changed', language);
    for (const listener of listeners) listener(language);
    return language;
  }
  function hide() {
    menu?.hide();
    if (!parent.isDestroyed()) parent.webContents.send('language:closed');
  }
  async function open() {
    if (menu?.isVisible()) { hide(); return false; }
    if (!menu || menu.isDestroyed()) {
      menu = new BrowserWindow({ parent, width: 172, height: 98, show: false, frame: false, resizable: false, minimizable: false, maximizable: false, skipTaskbar: true, type: 'toolbar', backgroundColor: '#29292f', webPreferences: { preload: path.join(__dirname, 'titlebar/language-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
      register(menu.webContents, menuFile, true);
      menu.setMenu(null);
      menu.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      menu.webContents.on('will-navigate', event => event.preventDefault());
      menu.on('blur', hide);
      menu.on('hide', () => { if (!parent.isDestroyed()) parent.webContents.send('language:closed'); });
      ready = menu.loadFile(menuFile);
    }
    await ready;
    const rect = await parent.webContents.executeJavaScript(`(()=>{const r=document.querySelector('#language-button').getBoundingClientRect();return {x:r.x,y:r.bottom};})()`);
    const bounds = parent.getContentBounds(), area = screen.getDisplayMatching(bounds).workArea;
    menu.setPosition(Math.max(area.x, Math.min(bounds.x + Math.round(rect.x), area.x + area.width - 172)), Math.min(bounds.y + Math.round(rect.y) + 5, area.y + area.height - 98));
    menu.show(); menu.focus();
    return true;
  }
  ipcMain.handle('language:get', event => { authorize(event); return get(); });
  ipcMain.handle('language:set', (event, next) => { if (!authorize(event).canSet) throw Error('Language selection is restricted to its menu'); const result = set(next); hide(); return result; });
  ipcMain.handle('language:open', event => { authorize(event); if (event.sender !== parent.webContents) throw Error('Untrusted language opener'); return open(); });
  ipcMain.handle('language:close', event => { authorize(event); if (event.sender !== menu?.webContents) throw Error('Untrusted language menu'); hide(); });
  parent.on('hide', hide); parent.on('move', hide); parent.on('resize', hide);
  parent.once('closed', () => { for (const channel of ['get', 'set', 'open', 'close']) ipcMain.removeHandler(`language:${channel}`); if (menu && !menu.isDestroyed()) menu.destroy(); listeners.clear(); });
  return { get, set, t: (key, values) => translate(language, key, values), register, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, get window() { return menu; } };
}
module.exports = { createLanguage };

