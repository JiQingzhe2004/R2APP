import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron'
import { join, parse } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from "@aws-sdk/lib-storage";
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import serve from 'electron-serve';

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
  directory: 'dist',
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

const store = new Store()

let mainWindow;

function createWindow() {
  console.log('Creating main window...');
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
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
ipcMain.handle('get-settings', () => {
    return store.get('settings')
})

ipcMain.handle('save-settings', (event, settings) => {
    store.set('settings', settings)
    return { success: true }
})

ipcMain.handle('r2-test-connection', async (event, settings) => {
  if (!settings || !settings.accountId || !settings.accessKeyId || !settings.secretAccessKey || !settings.bucketName) {
    return { success: false, error: '缺少必要的配置信息。' }
  }

  const testS3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });

  try {
    const command = new ListObjectsV2Command({ Bucket: settings.bucketName, MaxKeys: 0 });
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

ipcMain.handle('r2-get-bucket-stats', async () => {
  const settings = store.get('settings');
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
  const settings = store.get('settings');
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
  const bucketName = store.get('settings').bucketName;

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

const downloadTasks = store.get('downloads', {});

// Function to update and save downloads
function updateDownloads(newTasks) {
  store.set('downloads', newTasks);
}

ipcMain.handle('downloads-get-all', () => {
  return store.get('downloads', {});
});

ipcMain.on('r2-download-file', async (_, { key }) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    // We can't return an error directly, but we can send an event
    // For now, we'll rely on the settings being correct.
    return;
  }
  const bucketName = store.get('settings').bucketName;

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
    total: 0,
    downloaded: 0,
    createdAt: new Date().toISOString()
  };
  
  const currentTasks = store.get('downloads', {});
  currentTasks[taskId] = task;
  updateDownloads(currentTasks);

  mainWindow.webContents.send('download-start', task);
  
  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const { Body, ContentLength } = await s3Client.send(command);
    
    if (!Body) throw new Error('无法获取文件内容。');

    task.status = 'downloading';
    task.total = ContentLength;
    
    const writeStream = fs.createWriteStream(filePath);
    let lastProgressTime = Date.now();
    let lastDownloaded = 0;

    Body.on('data', (chunk) => {
      task.downloaded += chunk.length;
      if (task.total > 0) {
        task.progress = Math.round((task.downloaded / task.total) * 100);
      }
      
      const now = Date.now();
      const timeDiff = (now - lastProgressTime) / 1000;
      if (timeDiff > 0.5) {
        const bytesDiff = task.downloaded - lastDownloaded;
        const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
        lastDownloaded = task.downloaded;
        lastProgressTime = now;
        
        const tasks = store.get('downloads', {});
        tasks[taskId] = { ...tasks[taskId], ...task, speed };
        updateDownloads(tasks);
        mainWindow.webContents.send('download-progress', { id: taskId, progress: task.progress, speed: speed, status: 'downloading' });
      }
    });

    Body.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        task.status = 'completed';
        task.progress = 100;
        
        const tasks = store.get('downloads', {});
        tasks[taskId] = { ...tasks[taskId], ...task, speed: 0 };
        updateDownloads(tasks);
        mainWindow.webContents.send('download-progress', { id: taskId, progress: 100, status: 'completed' });
        resolve();
      });
      const errorHandler = (err) => {
         task.status = 'error';
         task.error = err.message;

         const tasks = store.get('downloads', {});
         tasks[taskId] = { ...tasks[taskId], ...task };
         updateDownloads(tasks);
         mainWindow.webContents.send('download-progress', { id: taskId, status: 'error', error: err.message });
         reject(err);
      }
      writeStream.on('error', errorHandler);
      Body.on('error', errorHandler);
    });

  } catch (error) {
    task.status = 'error';
    task.error = error.message;

    const tasks = store.get('downloads', {});
    tasks[taskId] = task;
    updateDownloads(tasks);
    mainWindow.webContents.send('download-progress', { id: taskId, status: 'error', error: error.message });
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
  updateDownloads(activeTasks);
  mainWindow.webContents.send('downloads-cleared', activeTasks);
});

ipcMain.on('downloads-delete-task', (_, taskId) => {
  const currentTasks = store.get('downloads', {});
  // Here you could also add logic to delete the actual file from disk if desired
  // fs.unlinkSync(currentTasks[taskId].filePath);
  delete currentTasks[taskId];
  updateDownloads(currentTasks);
  mainWindow.webContents.send('downloads-cleared', currentTasks);
});

ipcMain.handle('r2-list-objects', async (_, { continuationToken, prefix }) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    return { success: false, error: '请先在设置中配置您的存储桶。' };
  }
  const settings = store.get('settings');

  try {
    const command = new ListObjectsV2Command({
      Bucket: settings.bucketName,
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

ipcMain.handle('r2-delete-object', async (_, { key }) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    return { success: false, error: '客户端未初始化。' };
  }
  const bucketName = store.get('settings').bucketName;

  try {
    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
    await s3Client.send(command);
    return { success: true };
  } catch (error) {
    return { success: false, error: `删除文件失败: ${error.message}` };
  }
}); 