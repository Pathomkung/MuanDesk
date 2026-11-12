// SPDX-License-Identifier: GPL-3.0-only
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function createEqualizerWindow(parent, equalizer, language) {
  const file = path.join(__dirname, 'mini/equalizer.html');
  let win, ready;
  let quitting = false;
  const beforeQuit = () => { quitting = true; };
  app.on('before-quit', beforeQuit);
  ipcMain.handle('equalizer-window:request', async (event, command) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== pathToFileURL(file).href) throw new Error('Untrusted equalizer sender');
    if (command?.type === 'get') return equalizer.get();
    if (command?.type === 'set') return equalizer.set(command.settings);
    throw new Error('Unknown equalizer command');
  });
  parent.once('closed', () => {
    ipcMain.removeHandler('equalizer-window:request');
    app.removeListener('before-quit', beforeQuit);
    if (win && !win.isDestroyed()) win.destroy();
  });
  return {
    get window() { return win; },
    async open() {
      if (!win || win.isDestroyed()) {
        win = new BrowserWindow({
          parent, width: 420, height: 380, resizable: false, minimizable: false, maximizable: false,
          title: 'Equalizer • MuanDesk', icon: path.join(__dirname, '../assets/icon.ico'),
          backgroundColor: '#19191c', show: false, autoHideMenuBar: true,
          webPreferences: { preload: path.join(__dirname, 'mini/equalizer-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
        });
        win.setMenu(null);
        language.register(win.webContents, file);
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.webContents.on('will-navigate', event => event.preventDefault());
        win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
        ready = win.loadFile(file);
      }
      await ready;
      win.show(); win.focus();
    },
  };
}
module.exports = { createEqualizerWindow };



