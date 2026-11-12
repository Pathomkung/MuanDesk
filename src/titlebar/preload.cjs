// SPDX-License-Identifier: GPL-3.0-only
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('titlebar', { openEqualizer: () => ipcRenderer.invoke('titlebar:equalizer'), openLanguages: () => ipcRenderer.invoke('language:open'), onMenuClosed: callback => { const listener = () => callback(); ipcRenderer.on('language:closed', listener); return () => ipcRenderer.removeListener('language:closed', listener); } });

contextBridge.exposeInMainWorld('appLanguage', {
  get: () => ipcRenderer.invoke('language:get'),
  onChange: callback => { const listener = (_event, language) => callback(language); ipcRenderer.on('language:changed', listener); return () => ipcRenderer.removeListener('language:changed', listener); },
});


