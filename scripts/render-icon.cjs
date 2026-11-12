// SPDX-License-Identifier: GPL-3.0-only
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'muandesk-icon-')));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, frame: false, show: false, transparent: true, backgroundColor: '#00000000', webPreferences: { offscreen: true, sandbox: true, nodeIntegration: false, contextIsolation: true } });
  try {
    const svg = fs.readFileSync(path.join(__dirname, '../assets/icon.svg'), 'utf8');
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{width:100%;height:100%;display:block}</style>${svg}`));
    await new Promise(resolve => setTimeout(resolve, 200));
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '../assets/icon.png'), image.toPNG());
    console.log('Rendered original MuanDesk vector icon with transparent background');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});

