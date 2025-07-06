import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron'
import { join, parse } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { Upload } from "@aws-sdk/lib-storage";
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import serve from 'electron-serve';
import packageJson from '../../package.json' assert { type: 'json' };

// Enhanced debugging - Print app paths
console.log('App paths:');
console.log('- App path:', app.getAppPath());
console.log('- App directory structure:');
try {
  // Check if dist directory exists
  const distPath = join(app.getAppPath(), 'dist');
  console.log('- Dist path exists:', fs.existsSync(distPath));
  if (fs.existsSync(distPath)) {
    console.log('- Dist directory contents:', fs.readdirSync(distPath));
    
    // Check if index.html exists
    const indexPath = join(distPath, 'index.html');
    console.log('- index.html exists:', fs.existsSync(indexPath));
  }
} catch (err) {
  console.error('Error checking directory structure:', err);
}

// Configure electron-serve with detailed logging
const loadURL = serve({
  directory: join(app.getAppPath(), 'dist'),
  // Add a custom handler to log file requests
  handler: (request, response) => {
    const url = request.url.replace('app://', '');
    console.log(`[electron-serve] Request for: ${url}`);
    return null; // Let electron-serve handle the request normally
  }
});

// This is the correct way to disable sandbox for the entire app.
app.commandLine.appendSwitch('no-sandbox');

try {
  require('electron-reloader')(module, {});
} catch (_) {}

const store = new Store();

// --- Data Migration ---
function runMigration() {
  const oldSettings = store.get('settings');
  // Check if old structure exists and new structure doesn't
  if (oldSettings && !store.has('profiles')) {
    console.log('Migrating old settings to new profile structure...');
    const newProfileId = uuidv4();
    const newBaseSettings = {
      accountId: oldSettings.accountId,
      accessKeyId: oldSettings.accessKeyId,
      secretAccessKey: oldSettings.secretAccessKey,
    };
    const newProfile = {
      id: newProfileId,
      name: '默认配置',
      bucketName: oldSettings.bucketName,
      publicDomain: oldSettings.publicDomain || '',
    };
    
    store.set('settings', newBaseSettings);
    store.set('profiles', [newProfile]);
    store.set('activeProfileId', newProfileId);
    console.log('Migration complete.');
  }
}

// Run migration on startup
runMigration();

let mainWindow;

function createWindow() {
  console.log('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'linux' ? { icon: null } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      // Enable dev tools in production for debugging
      devTools: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show()
    // Open DevTools in production for debugging
    if (!is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  // Add error listener for failed page loads
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load URL: ${validatedURL}`);
    console.error(`Error code: ${errorCode}, Description: ${errorDescription}`);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  
  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    console.log(`Loading dev URL: ${process.env['ELECTRON_RENDERER_URL']}`);
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    console.log('Loading production app via electron-serve');
    loadURL(mainWindow)
  }
}

app.whenReady().then(() => {
  console.log('App is ready');
  electronApp.setAppUserModelId('com.r2.explorer')

  // Register F5 for refresh
  globalShortcut.register('F5', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.reload();
    }
  });

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers
function getActiveSettings() {
  const baseSettings = store.get('settings', {});
  const profiles = store.get('profiles', []);
  const activeProfileId = store.get('activeProfileId');
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  if (!activeProfile) {
    return null;
  }

  return { ...baseSettings, ...activeProfile };
}

ipcMain.handle('get-settings', () => {
  return {
    settings: store.get('settings', {}),
    profiles: store.get('profiles', []),
    activeProfileId: store.get('activeProfileId')
  }
})

ipcMain.handle('save-base-settings', (event, settings) => {
    store.set('settings', settings)
    return { success: true }
})

ipcMain.handle('save-profiles', (event, { profiles, activeProfileId }) => {
  store.set('profiles', profiles);
  store.set('activeProfileId', activeProfileId);
  return { success: true };
});

ipcMain.handle('r2-test-connection', async (event, { settings, profile }) => {
  const testSettings = { ...settings, ...profile };
  if (!testSettings.accountId || !testSettings.accessKeyId || !testSettings.secretAccessKey || !testSettings.bucketName) {
    return { success: false, error: '缺少必要的配置信息。' }
  }

  const testS3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${testSettings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: testSettings.accessKeyId,
      secretAccessKey: testSettings.secretAccessKey,
    },
  });

  try {
    const command = new ListObjectsV2Command({ Bucket: testSettings.bucketName, MaxKeys: 0 });
    await testS3Client.send(command);
    return { success: true, message: '连接成功！配置信息有效。' };
  } catch (error) {
    let errorMessage = '连接失败。';
    if (error.name === 'NoSuchBucket') {
      errorMessage = '连接失败：找不到指定的存储桶。';
    } else if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      errorMessage = '连接失败：访问密钥 ID 或秘密访问密钥无效。';
    } else {
      errorMessage = `连接失败：${error.message}`;
    }
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('check-r2-status', async () => {
  const settings = getActiveSettings();
  if (!settings || !settings.accountId || !settings.accessKeyId || !settings.secretAccessKey || !settings.bucketName) {
    return { success: false, error: '缺少配置或未选择有效的存储库' };
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });

  try {
    const command = new HeadBucketCommand({ Bucket: settings.bucketName });
    await s3Client.send(command);
    return { success: true, message: '连接成功' };
  } catch (error) {
    return { success: false, error: `连接失败: ${error.message}` };
  }
});

ipcMain.handle('r2-get-bucket-stats', async () => {
  const settings = getActiveSettings();
  if (!settings || !settings.bucketName) {
    return { success: false, error: '请先在设置中配置您的存储桶。' };
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });

  let totalSize = 0;
  let totalCount = 0;
  let ContinuationToken;
  
  try {
    do {
      const command = new ListObjectsV2Command({
        Bucket: settings.bucketName,
        ContinuationToken: ContinuationToken,
      });
      const response = await s3Client.send(command);
      
      if (response.Contents) {
        totalCount += response.Contents.length;
        totalSize += response.Contents.reduce((acc, obj) => acc + obj.Size, 0);
      }
      
      ContinuationToken = response.NextContinuationToken;
    } while (ContinuationToken);

    return { success: true, data: { totalCount, totalSize } };
  } catch (error) {
     return { success: false, error: `获取统计信息失败: ${error.message}` };
  }
});

function getS3Client() {
  const settings = getActiveSettings();
  if (!settings || !settings.bucketName) {
    return null;
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}

ipcMain.handle('show-open-dialog', async () => {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  });
  return result.filePaths;
});

ipcMain.handle('r2-upload-file', async (_, { filePath, key }) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    return { success: false, error: '请先在设置中配置您的存储桶。' };
  }
  const settings = getActiveSettings();
  const bucketName = settings.bucketName;

  try {
    const fileStream = fs.createReadStream(filePath);
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: fileStream,
      },
      queueSize: 4, // optional concurrency
      partSize: 1024 * 1024 * 5, // optional size of each part
      leavePartsOnError: false, // optional manually handle dropped parts
    });

    upload.on('httpUploadProgress', (progress) => {
      if (progress.total) {
        const percentage = Math.round((progress.loaded / progress.total) * 100);
        mainWindow.webContents.send('upload-progress', { key, percentage });
      }
    });

    await upload.done();
    return { success: true };
  } catch (error) {
    mainWindow.webContents.send('upload-progress', { key, percentage: 0, error: error.message });
    return { success: false, error: `文件上传失败: ${error.message}` };
  }
});

ipcMain.on('download-file', async (event, key) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    mainWindow.webContents.send('download-update', { type: 'error', data: { error: 'S3 client not initialized' } });
    return;
  }
  const bucketName = getActiveSettings().bucketName;
  const downloadsPath = app.getPath('downloads');
  let filePath = join(downloadsPath, key);

  // Avoid overwriting existing files
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
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const { Body, ContentLength } = await s3Client.send(command);

    if (!Body) {
      throw new Error('Could not get file body from S3');
    }

    const fileStream = fs.createWriteStream(filePath);
    let downloaded = 0;
    let lastProgressTime = 0;
    let lastDownloaded = 0;

    Body.on('data', (chunk) => {
      downloaded += chunk.length;
      const progress = ContentLength ? Math.round((downloaded / ContentLength) * 100) : 0;
      
      const now = Date.now();
      let speed = 0;
      if (now - lastProgressTime > 500) { // Update speed every 500ms
        const timeDiff = (now - lastProgressTime) / 1000;
        const bytesDiff = downloaded - lastDownloaded;
        speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
        lastProgressTime = now;
        lastDownloaded = downloaded;
      }
      
      const currentTasks = store.get('download-tasks', {});
      if (currentTasks[taskId]) {
        currentTasks[taskId] = { ...currentTasks[taskId], progress, status: 'downloading', speed };
        store.set('download-tasks', currentTasks);
      }
      mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, progress, speed, status: 'downloading' } });
    });

    Body.pipe(fileStream);
    
    await new Promise((resolve, reject) => {
      fileStream.on('finish', () => {
        const finalTasks = store.get('download-tasks', {});
        if (finalTasks[taskId]) {
          finalTasks[taskId].status = 'completed';
          finalTasks[taskId].progress = 100;
          finalTasks[taskId].speed = 0;
          store.set('download-tasks', finalTasks);
        }
        mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, progress: 100, status: 'completed' } });
        resolve();
      });
      const errorHandler = (err) => {
        const errorTasks = store.get('download-tasks', {});
        if (errorTasks[taskId]) {
          errorTasks[taskId].status = 'error';
          errorTasks[taskId].error = err.message;
          store.set('download-tasks', errorTasks);
        }
        mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, status: 'error', error: err.message } });
        reject(err);
      };
      fileStream.on('error', errorHandler);
      Body.on('error', errorHandler);
    });
  } catch (error) {
    const errorTasks = store.get('download-tasks', {});
    if (errorTasks[taskId]) {
      errorTasks[taskId].status = 'error';
      errorTasks[taskId].error = error.message;
      store.set('download-tasks', errorTasks);
    }
    mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, status: 'error', error: error.message } });
  }
});

ipcMain.on('show-item-in-folder', (_, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.on('downloads-clear-completed', () => {
  const currentTasks = store.get('downloads', {});
  const activeTasks = Object.entries(currentTasks).reduce((acc, [id, task]) => {
    if (task.status !== 'completed') {
      acc[id] = task;
    }
    return acc;
  }, {});
  store.set('downloads', activeTasks);
  mainWindow.webContents.send('downloads-cleared', activeTasks);
});

ipcMain.on('downloads-delete-task', (_, taskId) => {
  const currentTasks = store.get('downloads', {});
  // Here you could also add logic to delete the actual file from disk if desired
  // fs.unlinkSync(currentTasks[taskId].filePath);
  delete currentTasks[taskId];
  store.set('downloads', currentTasks);
  mainWindow.webContents.send('downloads-cleared', currentTasks);
});

ipcMain.handle('r2-list-objects', async (_, { continuationToken, prefix }) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    return { success: false, error: '请先在设置中配置您的存储桶。' };
  }
  const settings = getActiveSettings();
  const bucketName = settings.bucketName;

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      Prefix: prefix,
      MaxKeys: 30,
    });
    const response = await s3Client.send(command);
    return {
      success: true, 
      data: {
        files: response.Contents || [],
        nextContinuationToken: response.NextContinuationToken
      }
    };
  } catch (error) {
    return { success: false, error: `获取文件列表失败: ${error.message}` };
  }
});

ipcMain.handle('r2-delete-object', async (_, key) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    return { success: false, error: '客户端未初始化。' };
  }
  const settings = getActiveSettings();
  const bucketName = settings.bucketName;

  try {
    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    return { success: false, error: `删除文件失败: ${error.message}` };
  }
});

// IPC handlers for window controls
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
  // Notify renderer to update its state
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
  // Notify renderer to update its state
  if (mainWindow) {
    mainWindow.webContents.send('downloads-cleared', newTasks);
  }
});

ipcMain.handle('get-all-downloads', () => {
  return store.get('download-tasks', {});
});

ipcMain.handle('show-item-in-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
}); 