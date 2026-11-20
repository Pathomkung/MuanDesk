// SPDX-License-Identifier: GPL-3.0-only
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mini', {
  snapshot: () => ipcRenderer.invoke('mini:request', { type: 'snapshot' }),
  equalizer: () => ipcRenderer.invoke('mini:request', { type: 'equalizer' }),
  setEqualizer: settings => ipcRenderer.invoke('mini:request', { type: 'set-equalizer', settings }),
  media: action => ipcRenderer.invoke('mini:request', { type: 'media', action }),
  select: key => ipcRenderer.invoke('mini:request', { type: 'select', key }),
  seek: (occurrence, seconds) => ipcRenderer.invoke('mini:request', { type: 'seek', occurrence, seconds }),
  expand: expanded => ipcRenderer.invoke('mini:request', { type: 'expand', expanded }),
  show: () => ipcRenderer.invoke('mini:request', { type: 'show' }),
  hide: () => ipcRenderer.invoke('mini:request', { type: 'hide' }),
  onRefresh: callback => ipcRenderer.on('mini:refresh', () => callback()),
});

contextBridge.exposeInMainWorld('appLanguage', {
  get: () => ipcRenderer.invoke('language:get'),
  onChange: callback => { const listener = (_event, language) => callback(language); ipcRenderer.on('language:changed', listener); return () => ipcRenderer.removeListener('language:changed', listener); },
});

