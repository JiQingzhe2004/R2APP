import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut, screen, Tray, Menu, nativeImage } from 'electron'
import { join, parse } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import fs from 'fs';
import { execFile } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import serve from 'electron-serve';
import packageJson from '../../package.json' assert { type: 'json' };
import OSS from 'ali-oss';
import { autoUpdater } from 'electron-updater';

const activeUploads = new Map();

autoUpdater.autoDownload = false;

let currentProvider = 'github'; // 'github' or 'gitee'

const githubProvider = {
  provider: 'github',
  owner: 'JiQingzhe2004',
  repo: 'R2APP',
};

// 请确保这里的 owner 和 repo 与您 package.json 中的一致
const giteeProvider = {
  provider: 'generic',
  url: 'https://wpaiupload.aiqji.com'
};

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

async function startUpload(filePath, key, checkpoint) {
  const storage = await getStorageClient();
  if (!storage) {
    const errorMsg = '请先在设置中配置您的存储桶。';
    mainWindow.webContents.send('upload-progress', { key, error: errorMsg, filePath });
    addRecentActivity('upload', `文件 ${key} 上传失败: ${errorMsg}`, 'error');
    return;
  }

  try {
    // Immediately inform renderer to create list item
    mainWindow.webContents.send('upload-progress', { key, percentage: 0, status: 'uploading', filePath, checkpoint: checkpoint || null });
    if (storage.type === 'r2') {
      const fileStream = fs.createReadStream(filePath);
      const upload = new Upload({
        client: storage.client,
        params: { Bucket: storage.bucket, Key: key, Body: fileStream },
        queueSize: 4,
        partSize: 1024 * 1024 * 5, // 5MB
      });

      activeUploads.set(key, upload);

      upload.on('httpUploadProgress', (p) => {
        if (p.total) {
          const percentage = Math.round((p.loaded / p.total) * 100);
          mainWindow.webContents.send('upload-progress', { key, percentage, filePath });
        }
      });

      await upload.done();
      mainWindow.webContents.send('upload-progress', { key, percentage: 100, filePath });
      addRecentActivity('upload', `文件 ${key} 上传成功。`, 'success');

    } else if (storage.type === 'oss') {
      const controller = new AbortController();
      activeUploads.set(key, controller);
      
      await storage.client.multipartUpload(key, filePath, {
        signal: controller.signal,
        checkpoint: checkpoint,
        progress: async (p, cpt) => {
          mainWindow.webContents.send('upload-progress', { 
            key, 
            percentage: Math.round(p * 100),
            checkpoint: cpt,
            filePath,
          });
        }
      });

      mainWindow.webContents.send('upload-progress', { key, percentage: 100, filePath });
      addRecentActivity('upload', `文件 ${key} 上传成功。`, 'success');
    }
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'CancelError') {
      console.log(`Upload of ${key} was aborted/cancelled.`);
      mainWindow.webContents.send('upload-progress', { key, status: 'paused', error: '上传已暂停', filePath });
      addRecentActivity('upload', `文件 ${key} 上传已暂停。`, 'info');
    } else {
      console.error(`Upload failed for ${key}:`, error);
      mainWindow.webContents.send('upload-progress', { key, error: error.message, filePath });
      addRecentActivity('upload', `文件 ${key} 上传失败: ${error.message}`, 'error');
    }
  } finally {
    if (activeUploads.has(key)) {
      activeUploads.delete(key);
    }
  }
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
const previewWindows = new Map();
let tray = null;
let userTrayIconPath = null; // absolute path selected by user

function resolveTrayImage() {
  try {
    const appSettings = store.get('app-settings', {});
    const choice = appSettings['tray-icon-choice'] || 'default'; // 'default' | 'light' | 'dark'

    let image;
    if (choice === 'light') {
      // 浅色托盘背景下需要深色图标以保证对比度
      const p = app.isPackaged ? join(process.resourcesPath, 'BlackLOGO.ico') : join(__dirname, '../../src/assets/BlackLOGO.ico');
      image = nativeImage.createFromPath(p);
    } else if (choice === 'dark') {
      // 深色托盘背景下需要浅色图标以保证对比度
      const p = app.isPackaged ? join(process.resourcesPath, 'WhiteLOGO.ico') : join(__dirname, '../../src/assets/WhiteLOGO.ico');
      image = nativeImage.createFromPath(p);
    }
    if (!image || image.isEmpty()) {
      // Fallback to default icon.ico
      const fallbackPath = app.isPackaged
        ? join(process.resourcesPath, 'icon.ico')
        : join(__dirname, '../../resources/icon.ico');
      image = nativeImage.createFromPath(fallbackPath);
    }
    if (!image || image.isEmpty()) {
      image = nativeImage.createEmpty();
    }
    return image;
  } catch (_) {
    return nativeImage.createEmpty();
  }
}

function pauseAllActiveUploads() {
  try {
    for (const [key, uploadOrController] of activeUploads.entries()) {
      try {
        if (uploadOrController && typeof uploadOrController.abort === 'function') {
          uploadOrController.abort();
        }
      } catch (_) {}
    }
  } catch (_) {}
}
let initialFileInfo = null;

function createPreviewWindow(fileName, filePath, bucket) {
  const key = `${bucket}/${filePath}/${fileName}`;

  if (previewWindows.has(key)) {
    const existingWindow = previewWindows.get(key);
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus();
      return;
    }
  }

  const previewWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
    show: false,
    frame: false,
    titleBarStyle: 'hidden'
  });

  previewWindow.on('ready-to-show', () => {
    previewWindow.show()
  })
  
  previewWindow.on('maximize', () => {
    previewWindow.webContents.send('window-maximized-status-changed', true)
  })
  
  previewWindow.on('unmaximize', () => {
    previewWindow.webContents.send('window-maximized-status-changed', false)
  })
  
  previewWindow.on('closed', () => {
    previewWindows.delete(key);
  });

  // Pass file info via query parameters
  const query = new URLSearchParams({
    fileName,
    filePath,
    bucket
  });

  const previewUrl = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}/#/preview?${query.toString()}`
    : `file://${join(__dirname, '../renderer/index.html')}#/preview?${query.toString()}`;
  
  previewWindow.loadURL(previewUrl);
  previewWindows.set(key, previewWindow);
}

function createWindow() {
  // Resolve icon path for packaged vs dev
  const resolvedIconPath = app.isPackaged
    ? join(process.resourcesPath, process.platform === 'win32' ? 'icon.ico' : 'icon.png')
    : join(__dirname, '../../resources/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'linux' ? {} : { icon: resolvedIconPath }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      devTools: !app.isPackaged
    }
  })
  // Intercept close to support minimize-to-tray
  mainWindow.on('close', (e) => {
    try {
      const action = store.get('app-settings.close-action', 'minimize-to-tray');
      if (action === 'minimize-to-tray') {
        e.preventDefault();
        mainWindow.hide();
      }
    } catch (_) {}
  });

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
  
  mainWindow.on('close', () => {
    if (mainWindow.isMainWindow) {
        // Quit the app if the main window is closed
        app.quit();
    }
  });
  
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    loadURL(mainWindow);
  }

  mainWindow.isMainWindow = true;
}

// ---- Windows Explorer context menu registration ----
ipcMain.handle('register-shell-upload-menu', async () => {
  try {
    if (process.platform !== 'win32') {
      return { success: false, error: '仅支持 Windows' };
    }
    const keyBase = 'HKCU\\Software\\Classes\\*\\shell\\R2ExplorerUpload';
    const exe = process.execPath.replace(/\\/g, '\\\\');
    const title = '上传到 CS-Explorer';

    // Windows 11 现代右键菜单不支持通过纯注册表添加自定义应用项，
    // 以下注册仅会出现在“显示更多选项”的经典菜单中。

    // 仅在已打包状态下注册命令，避免在开发环境把 electron.exe 当作应用入口造成报错
    if (!app.isPackaged) {
      // 仍然允许写入图标和标题，随后返回提示信息
      await new Promise((resolve, reject) => execFile('reg', ['add', keyBase, '/ve', '/d', title, '/f'], (e) => e ? reject(e) : resolve()));
      const devIconPath = join(__dirname, '../../resources/icon.ico').replace(/\\/g, '\\\\');
      await new Promise((resolve, reject) => execFile('reg', ['add', keyBase, '/v', 'Icon', '/t', 'REG_SZ', '/d', devIconPath, '/f'], (e) => e ? reject(e) : resolve()));
      // 移除可能存在的 command，避免误触发
      await new Promise((resolve) => execFile('reg', ['delete', `${keyBase}\\command`, '/f'], () => resolve()));
      return { success: false, error: '开发环境无法正确注册启动命令，请打包后再注册；已设置图标但不会创建命令。' };
    }

    const exeIcon = `${exe},0`;
    await new Promise((resolve, reject) => execFile('reg', ['add', keyBase, '/ve', '/d', title, '/f'], (e) => e ? reject(e) : resolve()));
    await new Promise((resolve, reject) => execFile('reg', ['add', keyBase, '/v', 'Icon', '/t', 'REG_SZ', '/d', exeIcon, '/f'], (e) => e ? reject(e) : resolve()));
    await new Promise((resolve, reject) => execFile('reg', ['add', `${keyBase}\\command`, '/ve', '/d', `"${exe}" --upload "%1"`, '/f'], (e) => e ? reject(e) : resolve()));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unregister-shell-upload-menu', async () => {
  try {
    if (process.platform !== 'win32') {
      return { success: false, error: '仅支持 Windows' };
    }
    const keyBase = 'HKCU\\Software\\Classes\\*\\shell\\R2ExplorerUpload';
    await new Promise((resolve) => execFile('reg', ['delete', keyBase, '/f'], () => resolve()));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle --upload from command line / second instance
function handleUploadArgv(argv) {
  const toUpload = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--upload') {
      // Find the first non-flag argument after --upload as the file path
      let j = i + 1;
      while (j < argv.length && typeof argv[j] === 'string' && argv[j].startsWith('--')) {
        j++;
      }
      if (j < argv.length) {
        let candidate = argv[j];
        if (candidate.startsWith('"') && candidate.endsWith('"')) {
          candidate = candidate.slice(1, -1);
        }
        toUpload.push(candidate);
        i = j; // skip consumed args
      }
    }
  }
  if (toUpload.length === 0) return;
  // Ensure window visible
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  toUpload.forEach((filePath) => {
    try {
      if (!filePath || filePath.startsWith('--')) return;
      const cleanPath = filePath.replace(/^"|"$/g, '');
      if (!fs.existsSync(cleanPath)) {
        addRecentActivity('upload', `右键上传失败: 找不到文件 ${cleanPath}`, 'error');
        return;
      }
      const name = parse(cleanPath).base;
      // 跳转到上传页，但仅加入队列，不自动开始
      mainWindow?.webContents.send('navigate', '/uploads');
      mainWindow?.webContents.send('upload-progress', { key: name, percentage: 0, status: 'pending', filePath: cleanPath });
      // 不立即调用 startUpload，等待用户在上传页点击“开始上传”
      addRecentActivity('upload', `从系统右键上传 ${name}`, 'info');
    } catch (e) {
      addRecentActivity('upload', `右键上传失败: ${e.message}`, 'error');
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    handleUploadArgv(argv);
  });
}

// Defer initial argv handling until after the main window is created

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.r2.explorer')

  // --- Set Feed URL for Updater ---
  // In production, it will automatically use the GitHub provider.
  // In development, we point it to our local server.
  if (is.dev) {
    console.log('Updater: Development mode detected. Using dev-app-update.yml for configuration.');
    autoUpdater.forceDevUpdateConfig = true;
  } else {
    console.log('Updater: Production mode. Setting initial provider to GitHub.');
    currentProvider = 'github';
    autoUpdater.setFeedURL(githubProvider);
  }

  globalShortcut.register('F5', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.reload();
    }
  });

  // Create tray icon
  if (process.platform !== 'linux' && !tray) {
    const image = resolveTrayImage();
    tray = new Tray(image);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: '打开仪表盘',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', '/dashboard');
          }
        }
      },
      {
        label: '打开文件管理',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', '/files');
          }
        }
      },
      {
        label: '新增配置',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', '/settings?tab=profiles&action=new');
          }
        }
      },
      {
        label: '应用设置',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', '/settings?tab=app');
          }
        }
      },
      {
        label: '打开上传页',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', '/uploads');
          }
        }
      },
      {
        label: '开始全部上传',
        click: () => {
          mainWindow?.webContents.send('tray-command', 'start-all-uploads');
          mainWindow?.show();
        }
      },
      {
        label: '暂停全部上传',
        click: () => {
          pauseAllActiveUploads();
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.exit(0);
        }
      }
    ]);
    tray.setToolTip('CS-Explorer');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  createWindow()
  setupAutoUpdater()

  // In production, this will now try GitHub first, then fallback to Gitee.
  // In dev, it will use the local config.
  autoUpdater.checkForUpdates();

  // Now that the main window exists, handle --upload args (first instance)
  handleUploadArgv(process.argv);

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
    mainWindow.webContents.send('update-available', info);
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('Updater: Update not available.', info);
    mainWindow.webContents.send('update-not-available');
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
    console.error(`Updater: Error from ${currentProvider}:`, err);
    // If GitHub fails, try Gitee as a fallback.
    if (currentProvider === 'github') {
      console.log('Updater: GitHub provider failed. Trying Gitee as a fallback...');
      currentProvider = 'gitee';
      autoUpdater.setFeedURL(giteeProvider);
      autoUpdater.checkForUpdates();
    } else {
      // If Gitee also fails, then send the final error to the renderer.
      console.error('Updater: Gitee provider also failed. Reporting error to renderer.');
      mainWindow?.webContents.send('update-error', err);
    }
  });
}

ipcMain.handle('check-for-updates', () => {
  console.log('IPC: Received "check-for-updates". Triggering updater with GitHub as primary.');
  // Always start with GitHub when manually checking
  currentProvider = 'github';
  if (is.dev) {
     // In dev, we use the local yml file, which simulates one provider.
     autoUpdater.checkForUpdates();
  } else {
     autoUpdater.setFeedURL(githubProvider);
     autoUpdater.checkForUpdates();
  }
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

// App-level key/value settings persistence
ipcMain.handle('set-setting', (event, key, value) => {
  try {
    const appSettings = store.get('app-settings', {});
    appSettings[key] = value;
    store.set('app-settings', appSettings);
    // Side effects for some keys
    if (key === 'tray-icon-choice' || key === 'tray-icon') {
      userTrayIconPath = key === 'tray-icon' ? value : userTrayIconPath;
      if (tray) {
        tray.setImage(resolveTrayImage());
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-setting', (event, key) => {
  try {
    const appSettings = store.get('app-settings', {});
    return { success: true, value: appSettings[key] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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

ipcMain.handle('list-objects', async (event, options) => {
  const { continuationToken, prefix, delimiter } = options || {};
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: 'S3 client not initialized' };
  }

  const isSearch = delimiter !== '/';
  const apiPrefix = isSearch ? '' : prefix;
  const apiDelimiter = isSearch ? undefined : delimiter;

  try {
    let rawFiles = [];
    let folders = [];
    let nextContinuationToken = null;

    if (storage.type === 'r2') {
      const command = new ListObjectsV2Command({
        Bucket: storage.bucket,
        ContinuationToken: continuationToken,
        Prefix: apiPrefix,
        Delimiter: apiDelimiter,
      });
      const response = await storage.client.send(command);
      rawFiles = response.Contents || [];
      folders = (response.CommonPrefixes || []).map(p => ({ key: p.Prefix, isFolder: true }));
      nextContinuationToken = response.NextContinuationToken;
    } else if (storage.type === 'oss') {
      const response = await storage.client.list({
        marker: continuationToken,
        prefix: apiPrefix,
        delimiter: apiDelimiter,
        'max-keys': 100
      });
      rawFiles = (response.objects || []).map(f => ({ Key: f.name, LastModified: f.lastModified, Size: f.size, ETag: f.etag }));
      folders = (response.prefixes || []).map(p => ({ key: p, isFolder: true }));
      nextContinuationToken = response.nextMarker;
    }
    
    let filteredFiles = rawFiles;
    if (isSearch && prefix) {
      const lowerCasePrefix = prefix.toLowerCase();
      filteredFiles = rawFiles.filter(item => 
        item.Key.toLowerCase().includes(lowerCasePrefix)
      );
    }
    
    const files = filteredFiles.map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      etag: item.ETag,
      isFolder: false,
    }));

    const combined = [...folders, ...files]
      .sort((a, b) => a.key.localeCompare(b.key))
      .filter(item => !isSearch && item.key === prefix ? false : true);

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

ipcMain.handle('get-object-content', async (event, bucket, key) => {
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: '未找到有效的存储配置' };
  }
  
  // Use the bucket from the client, not the one passed in, for security.
  const { client, type, bucket: clientBucket } = storage;

  try {
    let content = '';
    let fileTooLarge = false;

    if (type === 'r2') {
      const command = new GetObjectCommand({ Bucket: clientBucket, Key: key });
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

ipcMain.handle('show-open-dialog', async (_, options) => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    ...options
  });
  // Keep backward compatibility: sometimes older renderer expects array directly
  return result.filePaths || [];
});

ipcMain.handle('upload-file', async (_, { filePath, key, checkpoint }) => {
  startUpload(filePath, key, checkpoint);
});

ipcMain.handle('pause-upload', async (_, key) => {
  const uploadOrController = activeUploads.get(key);
  if (uploadOrController) {
    await uploadOrController.abort();
  }
});

ipcMain.handle('resume-upload', async (_, { filePath, key, checkpoint }) => {
  startUpload(filePath, key, checkpoint);
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

ipcMain.on('minimize-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.minimize();
});

ipcMain.on('maximize-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    if (window.isMaximized()) {
      window.unmaximize();
  } else {
      window.maximize();
    }
  }
});

ipcMain.on('close-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) window.close();
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

ipcMain.on('resize-preview-window', (event, { width, height }) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const windowWidth = Math.min(Math.round(width), screenWidth - 50);
    const windowHeight = Math.min(Math.round(height + 32), screenHeight - 50); // Add 32px for custom title bar

    window.setSize(windowWidth, windowHeight, true); // true for animate
    window.center();
  }
});

ipcMain.on('open-preview-window', (event, fileInfo) => {
  const { fileName, filePath, bucket } = fileInfo;
  createPreviewWindow(fileName, filePath, bucket);
});

ipcMain.on('get-initial-file-info', (event) => {
  event.reply('file-info-for-preview', initialFileInfo);
});

ipcMain.handle('get-presigned-url', async (event, bucket, key) => {
  const storage = await getStorageClient();
  if (!storage) {
    return { success: false, error: '未找到有效的存储配置' };
  }

  try {
    let url = '';
    if (storage.type === 'r2') {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      // The URL will be valid for 15 minutes.
      url = await getSignedUrl(storage.client, command, { expiresIn: 900 });
    } else if (storage.type === 'oss') {
      // The URL will be valid for 15 minutes.
      url = storage.client.signatureUrl(key, { expires: 900 });
    }
    return url;
  } catch (error) {
    console.error(`Failed to get presigned URL for ${key}:`, error);
    return null;
  }
});

ipcMain.on('start-search', async (event, searchTerm) => {
  const storage = await getStorageClient();
  if (!storage) {
    event.sender.send('search-error', 'S3 client not initialized');
    return;
  }

  const lowerCaseSearchTerm = searchTerm.toLowerCase();
  let continuationToken = undefined;

  try {
    do {
      let response;
      if (storage.type === 'r2') {
        response = await storage.client.send(new ListObjectsV2Command({
          Bucket: storage.bucket,
          ContinuationToken: continuationToken,
        }));
      } else if (storage.type === 'oss') {
        const ossResponse = await storage.client.list({ marker: continuationToken, 'max-keys': 1000 });
        response = { 
          Contents: (ossResponse.objects || []).map(f => ({ Key: f.name, LastModified: f.lastModified, Size: f.size, ETag: f.etag })),
          NextContinuationToken: ossResponse.nextMarker
        };
      }

      const rawFiles = response.Contents || [];
      const filteredChunk = rawFiles.filter(item => 
        item.Key.toLowerCase().includes(lowerCaseSearchTerm)
      );

      if (filteredChunk.length > 0) {
        const filesChunk = filteredChunk.map(item => ({
          key: item.Key,
          size: item.Size,
          lastModified: item.LastModified,
          etag: item.ETag,
          isFolder: false,
        }));
        event.sender.send('search-results-chunk', filesChunk);
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    event.sender.send('search-end');
  } catch (error) {
    event.sender.send('search-error', `搜索失败: ${error.message}`);
  }
});

ipcMain.handle('get-uploads-state', () => {
  return store.get('uploads-state', []);
});

ipcMain.handle('set-uploads-state', (_, uploads) => {
  store.set('uploads-state', uploads);
});