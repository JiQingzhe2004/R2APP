import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveProfiles: (data) => ipcRenderer.invoke('save-profiles', data),
  testConnection: (profile) => ipcRenderer.invoke('test-connection', profile),
  
  // Bucket/File Operations
  checkStatus: () => ipcRenderer.invoke('check-status'),
  getBucketStats: () => ipcRenderer.invoke('get-bucket-stats'),
  getRecentActivities: () => ipcRenderer.invoke('get-recent-activities'),
  clearRecentActivities: () => ipcRenderer.invoke('clear-recent-activities'),
  deleteRecentActivity: (activityId) => ipcRenderer.invoke('delete-recent-activity', activityId),
  onActivityUpdated: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('activity-updated', listener);
    return () => ipcRenderer.removeListener('activity-updated', listener);
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
  
  // The correct way to get file path from a dropped file object
  getPathForFile: (file) => webUtils.getPathForFile(file),

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
}

contextBridge.exposeInMainWorld('api', api); 