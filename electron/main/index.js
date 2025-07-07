import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron'
import { join, parse } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { Upload } from "@aws-sdk/lib-storage";
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import serve from 'electron-serve';
import packageJson from '../../package.json' assert { type: 'json' };
import OSS from 'ali-oss';
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = false;

const loadURL = serve({
  directory: join(__dirname, '../renderer')
});

// This is the correct way to disable sandbox for the entire app.
app.commandLine.appendSwitch('no-sandbox');

try {
  require('electron-reloader')(module, {});
} catch (_) {}

const store = new Store();

const MAX_ACTIVITIES = 20;

function addRecentActivity(type, message, status) {
  const activities = store.get('recent-activities', []);
  const newActivity = {
    id: uuidv4(),
    type,
    message,
    status,
    timestamp: new Date().toISOString(),
  };
  const updatedActivities = [newActivity, ...activities].slice(0, MAX_ACTIVITIES);
  store.set('recent-activities', updatedActivities);
  mainWindow?.webContents.send('activity-updated');
}

// --- Data Migration ---
function runMigration() {
  const oldSettings = store.get('settings');
  const oldProfiles = store.get('profiles');

  // Check if old structure with base settings exists and new unified profiles don't
  if (oldSettings && oldSettings.accountId && (!oldProfiles || oldProfiles.length === 0 || !oldProfiles[0].type)) {
    console.log('Migrating old settings to new profile structure...');
    
    const migratedProfiles = (oldProfiles || []).map(p => ({
      id: p.id || uuidv4(),
      name: p.name || '默认R2配置',
      bucketName: p.bucketName,
      publicDomain: p.publicDomain || '',
      // Add R2 specific fields from old base settings
      type: 'r2',
      accountId: oldSettings.accountId,
      accessKeyId: oldSettings.accessKeyId,
      secretAccessKey: oldSettings.secretAccessKey,
    }));
    
    store.set('profiles', migratedProfiles);
    
    // If there was an active ID, keep it, otherwise set the first one as active.
    if (!store.has('activeProfileId') && migratedProfiles.length > 0) {
        store.set('activeProfileId', migratedProfiles[0].id);
    }
    
    // Delete the old base settings key
    store.delete('settings');
    
    console.log('Migration complete. Old base settings removed.');
  }
}

// Run migration on startup
runMigration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'linux' ? {} : { icon: join(__dirname, '../../resources/icon.ico') }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      devTools: !app.isPackaged
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-status-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-status-changed', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    loadURL(mainWindow);
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.r2.explorer')

  // --- Set Feed URL for Updater ---
  // In production, it will automatically use the GitHub provider.
  // In development, we point it to our local server.
  if (is.dev) {
    console.log('Updater: Development mode detected. Using dev-app-update.yml for configuration.');
    autoUpdater.forceDevUpdateConfig = true;
  } else {
    console.log('Updater: Production mode. Will use package.json provider (GitHub).');
  }

  globalShortcut.register('F5', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.reload();
    }
  });

  createWindow()
  setupAutoUpdater()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// --- Auto-updater handlers ---
function setupAutoUpdater() {
  console.log('Updater: Initializing event listeners...');

  autoUpdater.on('checking-for-update', () => {
    console.log('Updater: Checking for update...');
  })

  autoUpdater.on('update-available', (info) => {
    console.log('Updater: Update available.', info);
    mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Updater: Update not available.');
    mainWindow?.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Updater: Download progress: ${progressObj.percent.toFixed(2)}%`);
    mainWindow?.webContents.send('update-download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Updater: Update downloaded.', info);
    mainWindow?.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    console.error('Updater: Error in auto-updater.', err);
    mainWindow?.webContents.send('update-error', err);
  });
}

ipcMain.handle('check-for-updates', () => {
  console.log('IPC: Received "check-for-updates". Triggering updater.');
  autoUpdater.checkForUpdates();
});

ipcMain.handle('download-update', () => {
  console.log('IPC: Received "download-update". Triggering download.');
  autoUpdater.downloadUpdate();
});

ipcMain.handle('quit-and-install-update', () => {
  console.log('IPC: Received "quit-and-install-update". Triggering quit and install.');
  autoUpdater.quitAndInstall();
});

// IPC handlers
function getActiveProfile() {
  const profiles = store.get('profiles', []);
  const activeProfileId = store.get('activeProfileId');
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  if (!activeProfile) {
    console.error('No active profile found.');
    return null;
  }

  return activeProfile;
}

ipcMain.handle('get-settings', () => {
  return {
    profiles: store.get('profiles', []),
    activeProfileId: store.get('activeProfileId')
  }
})

ipcMain.handle('save-profiles', (event, { profiles, activeProfileId }) => {
  try {
    store.set('profiles', profiles);
    store.set('activeProfileId', activeProfileId);
    return { success: true };
  } catch (error) {
    console.error('Failed to save profiles:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-connection', async (event, profile) => {
  if (profile.type === 'r2') {
    if (!profile.accountId || !profile.accessKeyId || !profile.secretAccessKey || !profile.bucketName) {
      return { success: false, error: '缺少 R2 配置信息。' }
    }
    const testS3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${profile.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: profile.accessKeyId,
        secretAccessKey: profile.secretAccessKey,
      },
    });
    try {
      await testS3Client.send(new ListObjectsV2Command({ Bucket: profile.bucketName, MaxKeys: 0 }));
      return { success: true, message: 'R2 连接成功！' };
    } catch (error) {
      return { success: false, error: `R2 连接失败: ${error.message}` };
    }
  } else if (profile.type === 'oss') {
    if (!profile.accessKeyId || !profile.accessKeySecret || !profile.bucket || !profile.region) {
       return { success: false, error: '缺少 OSS 配置信息。' };
    }
    try {
      const client = new OSS({
        region: profile.region,
        accessKeyId: profile.accessKeyId,
        accessKeySecret: profile.accessKeySecret,
        bucket: profile.bucket,
        secure: true,
      });
      await client.list({ 'max-keys': 1 });
      return { success: true, message: 'OSS 连接成功！' };
    } catch (error) {
       return { success: false, error: `OSS 连接失败: ${error.message}` };
    }
  } else {
    return { success: false, error: '未知的配置类型。' };
  }
});

async function getStorageClient() {
    const profile = getActiveProfile();
    if (!profile) return null;

    if (profile.type === 'r2') {
        if (!profile.accountId || !profile.accessKeyId || !profile.secretAccessKey) return null;
        return {
            client: new S3Client({
                region: 'auto',
                endpoint: `https://${profile.accountId}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: profile.accessKeyId,
                    secretAccessKey: profile.secretAccessKey,
                },
            }),
            type: 'r2',
            bucket: profile.bucketName,
        };
    } else if (profile.type === 'oss') {
        if (!profile.accessKeyId || !profile.accessKeySecret || !profile.bucket || !profile.region) return null;
        return {
            client: new OSS({
                region: profile.region,
                accessKeyId: profile.accessKeyId,
                accessKeySecret: profile.accessKeySecret,
                bucket: profile.bucket,
                secure: true,
            }),
            type: 'oss',
            bucket: profile.bucket,
        };
    }
    return null;
}

ipcMain.handle('check-status', async () => {
  const storage = await getStorageClient();
  if (!storage) {
     return { success: false, error: '缺少配置或未选择有效的存储库' };
   }
 
  try {
    if (storage.type === 'r2') {
      const command = new HeadBucketCommand({ Bucket: storage.bucket });
      await storage.client.send(command);
    } else if (storage.type === 'oss') {
      await storage.client.list({ 'max-keys': 1 });
    }
     return { success: true, message: '连接成功' };
   } catch (error) {
     console.error('Check status failed:', error);
     return { success: false, error: `连接检查失败: ${error.message}` };
   }
});

ipcMain.handle('get-bucket-stats', async () => {
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: '未找到活动的存储配置' };
  }
  const activeProfile = getActiveProfile();

  try {
    let totalCount = 0;
    let totalSize = 0;
    let continuationToken = undefined;

    if (storage.type === 'r2') {
      do {
        const command = new ListObjectsV2Command({
          Bucket: storage.bucket,
          ContinuationToken: continuationToken,
        });
        const response = await storage.client.send(command);
        totalCount += response.KeyCount || 0;
        totalSize += response.Contents?.reduce((acc, obj) => acc + obj.Size, 0) || 0;
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
    } else if (storage.type === 'oss') {
      do {
        const response = await storage.client.list({ marker: continuationToken, 'max-keys': 1000 });
        totalCount += response.objects?.length || 0;
        totalSize += response.objects?.reduce((acc, obj) => acc + obj.size, 0) || 0;
        continuationToken = response.nextMarker;
      } while (continuationToken);
    }
    
    const quota = parseInt(activeProfile?.storageQuotaGB, 10);

    return { success: true, data: { 
      totalCount, 
      totalSize, 
      bucketName: storage.bucket,
      storageQuotaGB: !isNaN(quota) && quota > 0 ? quota : 10
    } };
  } catch (error) {
    console.error('Failed to get bucket stats:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-objects', async (_, { continuationToken, prefix, delimiter }) => {
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: '未找到活动的存储配置' };
  }

  try {
    let files = [];
    let folders = [];
    let nextContinuationToken = null;

    if (storage.type === 'r2') {
      const command = new ListObjectsV2Command({
        Bucket: storage.bucket,
        ContinuationToken: continuationToken,
        Prefix: prefix,
        Delimiter: delimiter,
        MaxKeys: 50,
      });
      const response = await storage.client.send(command);
      files = (response.Contents || []).map(f => ({
        key: f.Key,
        lastModified: f.LastModified,
        size: f.Size,
        etag: f.ETag
      }));
      folders = (response.CommonPrefixes || []).map(p => ({
        key: p.Prefix,
        type: 'folder'
      }));
      nextContinuationToken = response.NextContinuationToken;
    } else if (storage.type === 'oss') {
      const response = await storage.client.list({
        marker: continuationToken,
        prefix: prefix,
        delimiter: delimiter,
        'max-keys': 50
      });
      files = (response.objects || []).map(f => ({
        key: f.name,
        lastModified: f.lastModified,
        size: f.size,
        etag: f.etag
      }));
      folders = (response.prefixes || []).map(p => ({
        key: p,
        type: 'folder'
      }));
      nextContinuationToken = response.nextMarker;
    }
    
    // Combine folders and files, with folders first
    const combined = [
      ...folders.map(f => ({ ...f, isFolder: true })),
      ...files.map(f => ({ ...f, isFolder: false }))
    ].filter(item => item.key !== prefix); // Don't show the current folder itself

    return { success: true, data: { files: combined, nextContinuationToken } };
  } catch (error) {
    return { success: false, error: `获取文件列表失败: ${error.message}` };
  }
});

ipcMain.handle('delete-object', async (_, key) => {
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: '未找到活动的存储配置' };
  }

  try {
    if (storage.type === 'r2') {
      const command = new DeleteObjectCommand({ Bucket: storage.bucket, Key: key });
      await storage.client.send(command);
    } else if (storage.type === 'oss') {
      await storage.client.delete(key);
    }
    addRecentActivity('delete', `删除了 ${key}`, 'success');
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete object ${key}:`, error);
    addRecentActivity('delete', `删除对象 ${key} 失败`, 'error');
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-folder', async (event, prefix) => {
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: '未找到有效的存储配置' };
  }
  const { client, type, bucket } = storage;

  try {
    let allKeys = [];
    if (type === 'r2') {
      let continuationToken;
      do {
        const response = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }));
        if (response.Contents) {
          allKeys.push(...response.Contents.map(item => item.Key));
        }
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      if (allKeys.length > 0) {
        // AWS S3 DeleteObjects can handle 1000 keys at a time
        for (let i = 0; i < allKeys.length; i += 1000) {
          const chunk = allKeys.slice(i, i + 1000);
          await client.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: chunk.map(k => ({ Key: k })) },
          }));
        }
      }
    } else if (type === 'oss') {
      let continuationToken;
      do {
        const response = await client.list({
          prefix: prefix,
          marker: continuationToken,
          'max-keys': 1000,
        });
        if (response.objects) {
          allKeys.push(...response.objects.map(item => item.name));
        }
        continuationToken = response.nextMarker;
      } while (continuationToken);

      if (allKeys.length > 0) {
        // OSS deleteMulti can handle 1000 keys at a time
        await client.deleteMulti(allKeys, { quiet: true });
      }
    }

    addRecentActivity('delete', `文件夹 "${prefix}" 已删除`, 'success');
    return { success: true, deletedCount: allKeys.length };
  } catch (error) {
    console.error(`Failed to delete folder ${prefix}:`, error);
    addRecentActivity('delete', `删除文件夹 "${prefix}" 失败`, 'error');
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-folder', async (event, folderName) => {
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: '未找到有效的存储配置' };
  }

  const { client, type, bucket } = storage;

  try {
    if (type === 'r2') {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: folderName,
        Body: '',
      }));
    } else if (type === 'oss') {
      await client.put(folderName, Buffer.from(''));
    } else {
      return { success: false, error: '不支持的存储类型' };
    }
    
    addRecentActivity('create-folder', `文件夹 "${folderName}" 已创建`, 'success');
    return { success: true };
  } catch (error) {
    console.error(`Failed to create folder ${folderName}:`, error);
    addRecentActivity('create-folder', `创建文件夹 "${folderName}" 失败`, 'error');
    return { success: false, error: error.message };
  }
});

const PREVIEW_FILE_SIZE_LIMIT = 1024 * 1024; // 1MB

ipcMain.handle('get-object-content', async (event, key) => {
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: '未找到有效的存储配置' };
  }
  const { client, type, bucket } = storage;

  try {
    let content = '';
    let fileTooLarge = false;

    if (type === 'r2') {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await client.send(command);

      if (response.ContentLength > PREVIEW_FILE_SIZE_LIMIT) {
        fileTooLarge = true;
      } else {
        content = await response.Body.transformToString();
      }
    } else if (type === 'oss') {
      const response = await client.get(key);
      if (response.res.size > PREVIEW_FILE_SIZE_LIMIT) {
        fileTooLarge = true;
      } else {
        content = response.content.toString('utf-8');
      }
    }

    if (fileTooLarge) {
      return { success: false, error: '文件过大，无法预览。' };
    }

    return { success: true, content };
  } catch (error) {
    console.error(`Failed to get content for ${key}:`, error);
    return { success: false, error: `获取文件内容失败: ${error.message}` };
  }
});

ipcMain.handle('get-downloads', (event) => {
  return store.get('downloads', []);
});

ipcMain.handle('show-open-dialog', async () => {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  });
  return result.filePaths;
});

ipcMain.handle('upload-file', async (_, { filePath, key }) => {
  const storage = await getStorageClient();
  if (!storage) {
     return { success: false, error: '请先在设置中配置您的存储桶。' };
   }

   try {
    if (storage.type === 'r2') {
     const fileStream = fs.createReadStream(filePath);
     const upload = new Upload({
        client: storage.client,
        params: { Bucket: storage.bucket, Key: key, Body: fileStream },
     });
      upload.on('httpUploadProgress', (p) => {
        if (p.total) {
          mainWindow.webContents.send('upload-progress', { key, percentage: Math.round((p.loaded / p.total) * 100) });
       }
     });
 
     await upload.done();
    } else if (storage.type === 'oss') {
      await storage.client.multipartUpload(key, filePath, {
        progress: (p) => {
            mainWindow.webContents.send('upload-progress', { key, percentage: Math.round(p * 100) });
        }
      });
    }
     return { success: true };
   } catch (error) {
     console.error('Upload failed:', error);
     return { success: false, error: `文件上传失败: ${error.message}` };
   }
 });

ipcMain.on('download-file', async (event, key) => {
  const storage = await getStorageClient();
  if (!storage) {
    mainWindow.webContents.send('download-update', { type: 'error', data: { error: '存储客户端未初始化' } });
     return;
   }
  
   const downloadsPath = app.getPath('downloads');
   let filePath = join(downloadsPath, key);

   if (fs.existsSync(filePath)) {
     const timestamp = new Date().getTime();
     const pathData = parse(filePath);
     filePath = join(pathData.dir, `${pathData.name}-${timestamp}${pathData.ext}`);
   }

   const taskId = uuidv4();
   const task = {
     id: taskId,
     key,
     filePath,
     status: 'starting',
     progress: 0,
     createdAt: new Date().toISOString(),
   };

   const tasks = store.get('download-tasks', {});
   tasks[taskId] = task;
   store.set('download-tasks', tasks);

   mainWindow.webContents.send('download-update', { type: 'start', task });

   try {
     if (storage.type === 'r2') {
         const command = new GetObjectCommand({ Bucket: storage.bucket, Key: key });
         const { Body, ContentLength } = await storage.client.send(command);
 
      if (!Body) {
        throw new Error('No response body from S3');
      }

      const writeStream = fs.createWriteStream(filePath);
      let downloadedBytes = 0;
      let lastProgressTime = 0;
      let lastDownloaded = 0;

      Body.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = ContentLength ? Math.round((downloadedBytes / ContentLength) * 100) : 0;
        
        const now = Date.now();
        let speed = 0;
        if (now - lastProgressTime > 500) {
          const timeDiff = (now - lastProgressTime) / 1000;
          const bytesDiff = downloadedBytes - lastDownloaded;
          speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
          lastProgressTime = now;
          lastDownloaded = downloadedBytes;
        }
        
        mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, progress, speed } });
      });

      Body.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        const errorHandler = (err) => {
          writeStream.end();
          const errorTasks = store.get('download-tasks', {});
          if (errorTasks[taskId]) {
            errorTasks[taskId].status = 'failed';
            errorTasks[taskId].error = err.message;
            store.set('download-tasks', errorTasks);
          }
          mainWindow.webContents.send('download-update', { type: 'error', data: { id: taskId, error: err.message } });
          reject(err);
        };

        writeStream.on('finish', () => {
          const finalTasks = store.get('download-tasks', {});
          if (finalTasks[taskId]) {
            finalTasks[taskId].status = 'completed';
            finalTasks[taskId].progress = 100;
            store.set('download-tasks', finalTasks);
          }
          mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, progress: 100, status: 'completed' } });
          addRecentActivity('download', `下载了 ${key}`);
          resolve();
        });
        writeStream.on('error', errorHandler);
        Body.on('error', errorHandler);
      });
     } else if (storage.type === 'oss') {
         const result = await storage.client.get(key, filePath);
         if (result.res.status === 200) {
             const finalTasks = store.get('download-tasks', {});
             if (finalTasks[taskId]) {
                 finalTasks[taskId].status = 'completed';
                 finalTasks[taskId].progress = 100;
                 store.set('download-tasks', finalTasks);
             }
             mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, progress: 100, status: 'completed' } });
         } else {
             throw new Error(`OSS download failed with status: ${result.res.status}`);
         }
     }
   } catch (error) {
     const errorTasks = store.get('download-tasks', {});
     if (errorTasks[taskId]) {
       errorTasks[taskId].status = 'failed';
       errorTasks[taskId].error = error.message;
       store.set('download-tasks', errorTasks);
     }
     mainWindow.webContents.send('download-update', { type: 'error', data: { id: taskId, error: error.message } });
   }
 });

ipcMain.handle('get-all-downloads', () => {
  return store.get('download-tasks', {});
});

ipcMain.handle('show-item-in-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('close-window', () => {
  mainWindow?.close();
});

ipcMain.handle('get-app-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    author: packageJson.author,
    description: packageJson.description,
    license: packageJson.license,
  };
});

ipcMain.handle('delete-download-task', (event, taskId) => {
  const tasks = store.get('download-tasks', {});
  delete tasks[taskId];
  store.set('download-tasks', tasks);
  if (mainWindow) {
    mainWindow.webContents.send('downloads-cleared', tasks);
  }
});

ipcMain.handle('clear-completed-downloads', () => {
  const tasks = store.get('download-tasks', {});
  const newTasks = {};
  for (const taskId in tasks) {
    if (tasks[taskId].status !== 'completed') {
      newTasks[taskId] = tasks[taskId];
    }
  }
  store.set('download-tasks', newTasks);
  if (mainWindow) {
    mainWindow.webContents.send('downloads-cleared', newTasks);
  }
});

ipcMain.handle('get-recent-activities', async () => {
  try {
    const activities = store.get('recent-activities', []);
    return { success: true, data: activities };
  } catch (error) {
    console.error('Failed to get recent activities:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('is-window-maximized', () => {
  return mainWindow?.isMaximized() || false;
});

ipcMain.handle('clear-recent-activities', () => {
  try {
    store.set('recent-activities', []);
    return { success: true };
  } catch (error) {
    console.error('Failed to clear recent activities:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-recent-activity', (event, activityId) => {
  try {
    const activities = store.get('recent-activities', []);
    const updatedActivities = activities.filter(a => a.id !== activityId);
    store.set('recent-activities', updatedActivities);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete recent activity:', error);
    return { success: false, error: error.message };
  }
});