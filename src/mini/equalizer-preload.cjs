// SPDX-License-Identifier: GPL-3.0-only
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('equalizerWindow', {
  get: () => ipcRenderer.invoke('equalizer-window:request', { type: 'get' }),
  set: settings => ipcRenderer.invoke('equalizer-window:request', { type: 'set', settings }),
});

contextBridge.exposeInMainWorld('appLanguage', {
  get: () => ipcRenderer.invoke('language:get'),
  onChange: callback => { const listener = (_event, language) => callback(language); ipcRenderer.on('language:changed', listener); return () => ipcRenderer.removeListener('language:changed', listener); },
});

