// SPDX-License-Identifier: GPL-3.0-only
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('appLanguage', {
  get: () => ipcRenderer.invoke('language:get'),
  set: language => ipcRenderer.invoke('language:set', language),
  close: () => ipcRenderer.invoke('language:close'),
  onChange: callback => { const listener = (_event, language) => callback(language); ipcRenderer.on('language:changed', listener); return () => ipcRenderer.removeListener('language:changed', listener); },
});

