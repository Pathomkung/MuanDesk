// SPDX-License-Identifier: GPL-3.0-only
const { app, BrowserWindow, Menu, Tray, shell, dialog, nativeTheme, WebContentsView, ipcMain } = require('electron');
const path = require('node:path');
const { createMiniPlayer } = require('./mini-player.cjs');
const { isAppUrl } = require('./navigation.cjs');
const { createEqualizer } = require('./equalizer.cjs');

const { pathToFileURL } = require('node:url');
const { createEqualizerWindow } = require('./equalizer-window.cjs');
const { configureProfile } = require('./profile.cjs');
const { createLanguage } = require('./language.cjs');

const HOME = 'https://music.youtube.com/';
const APP_ID = 'local.muandesk.desktop';

function openExternal(value) {
  try {
    if (new URL(value).protocol === 'https:') shell.openExternal(value).catch(console.error);
  } catch { /* Malformed links are ignored. */ }
}

function createPlayer() {
  function traceNavigation(kind, value) {
    if (process.env.YTM_NAV_TRACE !== '1') return;
    try { const url = new URL(value); console.log(kind, url.origin + url.pathname); }
    catch { console.log(kind, 'invalid URL'); }
  }
  let quitting = false;
  const icon = path.join(__dirname, '../assets/icon.ico');
  const win = new BrowserWindow({
    width: 1180, height: 800, minWidth: 700, minHeight: 500,
    title: 'MuanDesk', icon, backgroundColor: '#1c1c1f', show: false,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#1c1c1f', symbolColor: '#dddddd', height: 34 },
    webPreferences: { preload: path.join(__dirname, 'titlebar/preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const player = new WebContentsView({
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      backgroundThrottling: false, partition: 'persist:ytmusic',
    },
  });
  win.contentView.addChildView(player);
  function layout() {
    const [width, height] = win.getContentSize();
    const top = win.isFullScreen() ? 0 : 34;
    player.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
  }
  win.on('resize', layout);
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', layout);
  win.once('closed', () => { if (!player.webContents.isDestroyed()) player.webContents.close(); });
  layout();
  const titlebarFile = path.join(__dirname, 'titlebar/index.html');
  const language = createLanguage(win);
  language.register(win.webContents, titlebarFile);
  win.loadFile(titlebarFile).catch(console.error);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const tray = new Tray(icon);
  let mini;
  function show() { mini?.hide(); if (win.isMinimized()) win.restore(); win.show(); win.focus(); player.webContents.focus(); }
  function quit() { quitting = true; app.quit(); }
  async function media(action) {
    if (!player.webContents.getURL().startsWith(HOME)) return;
    const scripts = {
      toggle: `document.querySelector('ytmusic-player-bar #play-pause-button button')?.click()`,
      next: `document.querySelector('ytmusic-player-bar .next-button button')?.click()`,
      previous: `document.querySelector('ytmusic-player-bar .previous-button button')?.click()`,
    };
    try { await player.webContents.executeJavaScript(scripts[action], true); }
    catch (error) { console.error('Media command failed:', error); }
  }
  function updateTray() {
    tray.setToolTip(language.t('trayTip'));
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: language.t('openApp'), click: show }, { type: 'separator' },
      { label: language.t('togglePlayback'), click: () => media('toggle') },
      { label: language.t('next'), click: () => media('next') },
      { label: language.t('previous'), click: () => media('previous') },
      { type: 'separator' }, { label: language.t('quit'), click: quit },
    ]));
  }
  updateTray(); language.subscribe(updateTray);
  const equalizer = createEqualizer(player);
  const equalizerWindow = createEqualizerWindow(win, equalizer, language);
  ipcMain.handle('titlebar:equalizer', event => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== pathToFileURL(titlebarFile).href) throw new Error('Untrusted titlebar sender');
    return equalizerWindow.open();
  });
  win.once('closed', () => ipcMain.removeHandler('titlebar:equalizer'));
  mini = createMiniPlayer(player, tray, media, show, equalizer, language);
  Menu.setApplicationMenu(null);
  win.setMenu(null);
  function handleShortcut(event, input) {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    if (input.control && input.shift && key === 'h') { event.preventDefault(); win.hide(); }
    else if (input.control && key === 'q') { event.preventDefault(); quit(); }
    else if ((input.control && key === 'r') || key === 'f5') { event.preventDefault(); player.webContents.reload(); }
  }
  player.webContents.on('before-input-event', handleShortcut);
  win.webContents.on('before-input-event', handleShortcut);
  win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
  win.once('ready-to-show', show);
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => tray.destroy());
  const session = player.webContents.session;
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    traceNavigation(`permission-denied:${permission}`, details.requestingUrl);
    callback(false);
  });
  session.setPermissionCheckHandler((_contents, permission, origin) => {
    traceNavigation(`permission-check-denied:${permission}`, origin);
    return false;
  });
  if (process.env.YTM_NAV_TRACE === '1') {
    session.webRequest.onCompleted({ urls: ['https://accounts.google.com/*', 'https://accounts.youtube.com/*', 'https://www.youtube.com/signin*'] }, details => {
      traceNavigation(`auth-http:${details.method}:${details.statusCode}:${details.resourceType}`, details.url);
    });
    session.webRequest.onErrorOccurred({ urls: ['https://accounts.google.com/*', 'https://accounts.youtube.com/*', 'https://*.gstatic.com/*'] }, details => {
      traceNavigation(`auth-network-error:${details.error}:${details.resourceType}`, details.url);
    });
    player.webContents.on('did-fail-load', (_event, code, _description, url) => traceNavigation(`load-failed:${code}`, url));
  }
  player.webContents.on('will-navigate', (event, url) => {
    traceNavigation('navigate', url);
    if (!isAppUrl(url)) { traceNavigation('blocked-navigation', url); event.preventDefault(); openExternal(url); }
  });
  player.webContents.on('will-redirect', (event, url) => {
    traceNavigation('redirect', url);
    if (!isAppUrl(url)) { traceNavigation('blocked-redirect', url); event.preventDefault(); }
  });
  player.webContents.setWindowOpenHandler(({ url }) => {
    traceNavigation('window-open', url);
    if (isAppUrl(url)) player.webContents.loadURL(url).catch(console.error);
    else openExternal(url);
    return { action: 'deny' };
  });
  player.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting) dialog.showMessageBox(win, { type: 'error', message: language.t('playerStopped'), detail: `${language.t('reloadPlayer')} (${details.reason})` });
  });
  return { win, player, tray, show, quit, mini, equalizer, equalizerWindow, language };
}

function start() {
  app.setName('MuanDesk');
  configureProfile(app);
  app.setAppUserModelId(APP_ID);
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  let player;
  app.on('second-instance', () => player?.show());
  app.on('activate', () => player?.show());
  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'dark';
    player = createPlayer();
    try { await player.player.webContents.loadURL(HOME); }
    catch (error) {
      console.error(error);
      dialog.showMessageBox(player.win, { type: 'error', message: player.language.t('openFailed'), detail: player.language.t('checkConnection') });
      player.show();
    }
  });
}

if (require.main === module) start();
module.exports = { createPlayer };



