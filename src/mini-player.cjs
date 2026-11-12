// SPDX-License-Identifier: GPL-3.0-only
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { youtubeCommand } = require('./youtube.cjs');

function createMiniPlayer(player, tray, media, showPlayer, equalizer, language) {
  const file = path.join(__dirname, 'mini/index.html');
  const popup = new BrowserWindow({
    width: 380, height: 238, show: false, frame: false, resizable: false,
    minimizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: true,
    type: 'toolbar',
    title: 'MuanDesk Mini', backgroundColor: '#202020',
    webPreferences: { preload: path.join(__dirname, 'mini/preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  popup.setMenu(null);
  language.register(popup.webContents, file);
  popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  popup.webContents.on('will-navigate', event => event.preventDefault());
  const ready = popup.loadFile(file);
  let expanded = false;
  let hiddenAt = 0;
  function position() {
    const anchor = tray.getBounds();
    const area = screen.getDisplayMatching(anchor).workArea;
    const width = Math.min(380, area.width - 16);
    const height = Math.min(expanded ? 588 : 238, area.height - 16);
    const x = area.x + area.width - width;
    const y = anchor.y < area.y ? area.y + 8 : area.y + area.height - height - 8;
    popup.setBounds({ x, y, width, height });
  }
  async function open() {
    await ready;
    if (popup.isDestroyed()) return;
    position(); popup.show(); popup.focus();
    popup.webContents.send('mini:refresh');
  }
  function hide() { if (!popup.isDestroyed()) popup.hide(); }
  popup.on('blur', hide);
  popup.on('hide', () => { hiddenAt = Date.now(); });
  function toggle() {
    if (popup.isVisible()) hide();
    else if (Date.now() - hiddenAt > 200) open().catch(console.error);
  }
  tray.on('click', toggle);
  tray.on('double-click', showPlayer);

  ipcMain.handle('mini:request', async (event, command) => {
    if (event.sender !== popup.webContents || event.senderFrame !== popup.webContents.mainFrame || event.senderFrame.url !== pathToFileURL(file).href) throw new Error('Untrusted mini player sender');
    switch (command?.type) {
      case 'snapshot': return youtubeCommand(player);
      case 'equalizer': return equalizer.get();
      case 'set-equalizer': return equalizer.set(command.settings);
      case 'media':
        if (!['toggle', 'next', 'previous'].includes(command.action)) throw new Error('Invalid media action');
        await media(command.action); return true;
      case 'select':
        if (typeof command.key !== 'string' || command.key.length > 256) throw new Error('Invalid queue selection');
        return youtubeCommand(player, { type: 'select', key: command.key });
      case 'expand':
        expanded = command.expanded === true; position(); return true;
      case 'show': hide(); showPlayer(); return true;
      case 'hide': hide(); return true;
      default: throw new Error('Unknown mini player command');
    }
  });
  popup.on('closed', () => {
    ipcMain.removeHandler('mini:request');
    tray.removeListener('click', toggle);
    tray.removeListener('double-click', showPlayer);
  });
  return { popup, open, hide };
}

module.exports = { createMiniPlayer };


