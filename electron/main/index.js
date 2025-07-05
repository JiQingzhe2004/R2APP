import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from "@aws-sdk/lib-storage";
import fs from 'fs';
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
    });

    await upload.done();
    return { success: true };
  } catch (error) {
    return { success: false, error: `文件上传失败: ${error.message}` };
  }
});

ipcMain.handle('r2-download-file', async (_, { key }) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    return { success: false, error: '请先在设置中配置您的存储桶。' };
  }
  const bucketName = store.get('settings').bucketName;

  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: key
  });

  if (!filePath) {
    return { success: false, error: '用户取消了下载。' };
  }

  try {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const { Body } = await s3Client.send(command);
    
    if (!Body) {
      return { success: false, error: '无法获取文件内容。' };
    }

    const writeStream = fs.createWriteStream(filePath);
    Body.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: `下载文件失败: ${error.message}` };
  }
});

ipcMain.handle('r2-list-objects', async (_, { continuationToken }) => {
  const s3Client = getS3Client();
  if (!s3Client) {
    return { success: false, error: '请先在设置中配置您的存储桶。' };
  }
  const bucketName = store.get('settings').bucketName;

  try {
    const command = new ListObjectsV2Command({ 
      Bucket: bucketName,
      ContinuationToken: continuationToken,
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