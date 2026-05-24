const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  fsRead: (args) => ipcRenderer.invoke('fs_read', args),
  fsWrite: (args) => ipcRenderer.invoke('fs_write', args),
  fsGlob: (args) => ipcRenderer.invoke('fs_glob', args),
  fsGrep: (args) => ipcRenderer.invoke('fs_grep', args),
  shellExec: (args) => ipcRenderer.invoke('shell_exec', args),
  pickWorkspace: () => ipcRenderer.invoke('workspace_pick'),
  setWorkspace: (p) => ipcRenderer.invoke('workspace_set', { path: p }),
  getWorkspace: () => ipcRenderer.invoke('workspace_get'),
  htmlExport: (args) => ipcRenderer.invoke('html_export', args),
  proxySet: (args) => ipcRenderer.invoke('proxy:set', args),
  proxyGet: () => ipcRenderer.invoke('proxy:get'),
  marketplaceFetch: (args) => ipcRenderer.invoke('marketplace:fetch_text', args),
  // Media persistence
  mediaSave: (args) => ipcRenderer.invoke('media:save', args),
  mediaSaveAs: (args) => ipcRenderer.invoke('media:save_as', args),
  // Auto-updater
  updaterStatus: () => ipcRenderer.invoke('updater:status'),
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdaterState: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('updater:state', handler)
    return () => ipcRenderer.removeListener('updater:state', handler)
  },
  // MiniToken
  minitokenOpen: (opts) => ipcRenderer.invoke('minitoken_open', opts || {}),
  minitokenExtractSession: () => ipcRenderer.invoke('minitoken_extract_session'),
  minitokenApi: (args) => ipcRenderer.invoke('minitoken_api', args),
  onMinitokenSession: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('minitoken-session', handler)
    return () => ipcRenderer.removeListener('minitoken-session', handler)
  },
})
