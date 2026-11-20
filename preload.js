'use strict';
/* Arayüze yalnızca gereken dosya işlemlerini açar (Node erişimi verilmez). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('filoDesktop', {
  load: () => ipcRenderer.sendSync('filo:load'),
  save: json => ipcRenderer.sendSync('filo:save', json),
  info: () => ipcRenderer.sendSync('filo:info'),
  openDataFolder: () => ipcRenderer.send('filo:openFolder')
});
