import { contextBridge, ipcRenderer, webUtils } from 'electron'

// --- Expose version numbers ---
export const versions = {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  v8: () => process.versions.v8,
}

export const api = {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveProfiles: (data) => ipcRenderer.invoke('save-profiles', data),
  testConnection: (profile) => ipcRenderer.invoke('test-connection', profile),
  
  // Bucket/File Operations
  checkStatus: () => ipcRenderer.invoke('check-status'),
  getBucketStats: () => ipcRenderer.invoke('get-bucket-stats'),
  getRecentActivities: () => ipcRenderer.invoke('get-recent-activities'),
  clearRecentActivities: () => ipcRenderer.invoke('clear-recent-activities'),
  deleteRecentActivity: (id) => ipcRenderer.invoke('delete-recent-activity', id),
  onActivityUpdated: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('activity-updated', handler);
    return () => ipcRenderer.removeListener('activity-updated', handler);
  },
  listObjects: (options) => ipcRenderer.invoke('list-objects', options),
  deleteObject: (key) => ipcRenderer.invoke('delete-object', key),
  deleteFolder: (prefix) => ipcRenderer.invoke('delete-folder', prefix),
  createFolder: (folderName) => ipcRenderer.invoke('create-folder', folderName),
  getObjectContent: (key) => ipcRenderer.invoke('get-object-content', key),
  uploadFile: (filePath, key) => ipcRenderer.invoke('upload-file', { filePath, key }),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  
  // Downloads
  onDownloadUpdate: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('download-update', handler);
    return () => ipcRenderer.removeListener('download-update', handler);
  },
  onDownloadsCleared: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('downloads-cleared', handler);
    return () => ipcRenderer.removeListener('downloads-cleared', handler);
  },
  downloadFile: (key) => ipcRenderer.send('download-file', key),
  getAllDownloads: () => ipcRenderer.invoke('get-all-downloads'),
  deleteDownloadTask: (taskId) => ipcRenderer.invoke('delete-download-task', taskId),
  clearCompletedDownloads: () => ipcRenderer.invoke('clear-completed-downloads'),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),

  // Uploads
  onUploadProgress: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('upload-progress', handler);
    return () => ipcRenderer.removeListener('upload-progress', handler);
  },
  getUploadsState: () => ipcRenderer.invoke('get-uploads-state'),
  setUploadsState: (uploads) => ipcRenderer.invoke('set-uploads-state', uploads),
  pauseUpload: (key) => ipcRenderer.invoke('pause-upload', key),
  resumeUpload: (data) => ipcRenderer.invoke('resume-upload', data),
  
  // The correct way to get file path from a dropped file object
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Updater API
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, ...args) => callback(...args)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, ...args) => callback(...args)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, ...args) => callback(...args)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, ...args) => callback(...args)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, ...args) => callback(...args)),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),

  // Window Controls
  isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  onWindowMaximizedStatusChanged: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('window-maximized-status-changed', handler);
    return () => ipcRenderer.removeListener('window-maximized-status-changed', handler);
  },
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  
  // App Info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Notifications (though managed by context, might be useful)
  onNotification: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('notify', handler);
    return () => ipcRenderer.removeListener('notify', handler);
  },

  // Preview window management
  openPreviewWindow: (fileInfo) => ipcRenderer.send('open-preview-window', fileInfo),
  resizePreviewWindow: (size) => ipcRenderer.send('resize-preview-window', size),

  // R2 operations
  listBuckets: () => ipcRenderer.invoke('list-buckets'),
  listObjects: (bucket, prefix) => ipcRenderer.invoke('list-objects', bucket, prefix),
  getPublicUrl: (key) => ipcRenderer.invoke('get-public-url', key),
  createFolder: (bucket, folderName) => ipcRenderer.invoke('create-folder', bucket, folderName),
  deleteObjects: (bucket, keys) => ipcRenderer.invoke('delete-objects', bucket, keys),
  uploadFile: (bucket, key, filePath) => ipcRenderer.invoke('upload-file', bucket, key, filePath),
  downloadFiles: (bucket, files, localPath) => ipcRenderer.invoke('download-files', bucket, files, localPath),
  getPresignedUrl: (bucket, key) => ipcRenderer.invoke('get-presigned-url', bucket, key),
  getObjectContent: (bucket, key) => ipcRenderer.invoke('get-object-content', bucket, key),

  // Local file system
  getLocalDiskInfo: () => ipcRenderer.invoke('get-local-disk-info'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // App settings
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // New methods
  startSearch: (searchTerm) => ipcRenderer.send('start-search', searchTerm),
  onSearchResults: (callback) => {
    const handler = (event, results) => callback(results);
    ipcRenderer.on('search-results-chunk', handler);
    return () => ipcRenderer.removeListener('search-results-chunk', handler);
  },
  onSearchEnd: (callback) => {
    const handler = (event) => callback();
    ipcRenderer.on('search-end', handler);
    return () => ipcRenderer.removeListener('search-end', handler);
  },
  onSearchError: (callback) => {
    const handler = (event, error) => callback(error);
    ipcRenderer.on('search-error', handler);
    return () => ipcRenderer.removeListener('search-error', handler);
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('versions', versions)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.versions = versions
  // @ts-ignore (define in dts)
  window.api = api
} 