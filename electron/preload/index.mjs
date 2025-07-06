import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveBaseSettings: (settings) => ipcRenderer.invoke('save-base-settings', settings),
  saveProfiles: (data) => ipcRenderer.invoke('save-profiles', data),
  testR2Connection: (data) => ipcRenderer.invoke('r2-test-connection', data),
  getBucketStats: () => ipcRenderer.invoke('r2-get-bucket-stats'),
  checkR2Status: () => ipcRenderer.invoke('check-r2-status'),
  listObjects: (args) => ipcRenderer.invoke('r2-list-objects', args),
  deleteObject: (key) => ipcRenderer.invoke('r2-delete-object', key),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  uploadFile: (filePath, key) => ipcRenderer.invoke('r2-upload-file', { filePath, key }),
  onUploadProgress: (callback) => {
    ipcRenderer.on('upload-progress', (event, data) => {
      callback(data);
    });
    return () => ipcRenderer.removeAllListeners('upload-progress');
  },
  onUploadComplete: (callback) => {
    ipcRenderer.on('upload-complete', (event, data) => {
      callback(data);
    });
    return () => ipcRenderer.removeAllListeners('upload-complete');
  },
  onUploadError: (callback) => {
    ipcRenderer.on('upload-error', (event, data) => {
      callback(data);
    });
    return () => ipcRenderer.removeAllListeners('upload-error');
  },
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => {
      callback(data)
    })
    return () => ipcRenderer.removeAllListeners('download-progress');
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (event, data) => {
      callback(data)
    })
    return () => ipcRenderer.removeAllListeners('download-complete');
  },
  onDownloadError: (callback) => {
    ipcRenderer.on('download-error', (event, data) => {
      callback(data)
    })
    return () => ipcRenderer.removeAllListeners('download-error');
  },
  downloadFile: (key) => ipcRenderer.send('download-file', key),
  openFileInFolder: (filePath) => ipcRenderer.send('open-file-in-folder', filePath),
  removeDownload: (id) => ipcRenderer.invoke('remove-download', id),
  clearCompletedDownloads: () => ipcRenderer.invoke('clear-completed-downloads'),
  retryDownload: (taskId) => ipcRenderer.send('retry-download', taskId),
  getAllDownloads: () => ipcRenderer.invoke('get-all-downloads'),
  onDownloadUpdate: (callback) => {
    const channel = 'download-update';
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onDownloadsCleared: (callback) => {
    const channel = 'downloads-cleared';
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  deleteDownloadTask: (taskId) => ipcRenderer.invoke('delete-download-task', taskId),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
}

// Use `contextBridge` APIs to expose Electron APIs to
// the renderer. For more info, see:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
contextBridge.exposeInMainWorld('api', api)

// ... existing code ... 