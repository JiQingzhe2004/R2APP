import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  testConnection: (settings) => ipcRenderer.invoke('r2-test-connection', settings),
  getBucketStats: () => ipcRenderer.invoke('r2-get-bucket-stats'),
  listObjects: (continuationToken) => ipcRenderer.invoke('r2-list-objects', { continuationToken }),
  deleteObject: (key) => ipcRenderer.invoke('r2-delete-object', { key }),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  uploadFile: (filePath, key) => ipcRenderer.invoke('r2-upload-file', { filePath, key }),
  onUploadProgress: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('upload-progress', handler);
    return () => {
      ipcRenderer.removeListener('upload-progress', handler);
    };
  },
  downloadFile: (key) => ipcRenderer.send('r2-download-file', { key }),
  getAllDownloads: () => ipcRenderer.invoke('downloads-get-all'),
  onDownloadUpdate: (callback) => {
    const startHandler = (_event, task) => callback({ type: 'start', task });
    const progressHandler = (_event, data) => callback({ type: 'progress', data });

    ipcRenderer.on('download-start', startHandler);
    ipcRenderer.on('download-progress', progressHandler);

    return () => {
      ipcRenderer.removeListener('download-start', startHandler);
      ipcRenderer.removeListener('download-progress', progressHandler);
    };
  },
  showItemInFolder: (filePath) => ipcRenderer.send('show-item-in-folder', filePath),
  clearCompletedDownloads: () => ipcRenderer.send('downloads-clear-completed'),
  deleteDownloadTask: (taskId) => ipcRenderer.send('downloads-delete-task', taskId),
  onDownloadsCleared: (callback) => {
    const handler = (_event, tasks) => callback(tasks);
    ipcRenderer.on('downloads-cleared', handler);
    return () => {
      ipcRenderer.removeListener('downloads-cleared', handler);
    };
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// the renderer. For more info, see:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
contextBridge.exposeInMainWorld('api', api)

// ... existing code ... 