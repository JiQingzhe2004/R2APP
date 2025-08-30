import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut, screen, Tray, Menu, nativeImage, session } from 'electron'
import { join, parse } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import Store from 'electron-store'

import fs from 'fs';
import { execFile } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import serve from 'electron-serve';
import packageJson from '../../package.json' assert { type: 'json' };

import COS from 'cos-nodejs-sdk-v5';
import { autoUpdater } from 'electron-updater';
import crypto from 'crypto';
import os from 'os';
import { ANALYTICS_CONFIG, getAnalyticsUrl } from './analytics-config.js';
import LskyAPI from './lsky-api.js';
import SmmsAPI from './smms-api.js';
import R2API from './r2-api.js';
import OssAPI from './oss-api.js';
import CosAPI from './cos-api.js';
import { showSplash, hideSplash, destroySplash } from './splash-screen.js';


const activeUploads = new Map();
// Cache public URL and delete URL for providers that return them (SM.MS, LSKY)
const objectUrlCache = new Map(); // key: provider+":"+objectKey -> url
const objectDeleteUrlCache = new Map(); // key: provider+":"+objectKey -> deleteUrl
const objectHashCache = new Map(); // key: provider+":"+objectKey -> hash (for SM.MS)

// API实例缓存
const apiInstances = new Map();



/**
 * 获取API实例
 */
function getAPIInstance(type) {
  if (apiInstances.has(type)) {
    return apiInstances.get(type);
  }

  const profile = getActiveProfile();
  if (!profile) return null;

  let apiInstance = null;

  switch (type) {
    case 'r2':
      if (profile.accountId && profile.accessKeyId && profile.secretAccessKey) {
        apiInstance = new R2API({
          accountId: profile.accountId,
          accessKeyId: profile.accessKeyId,
          secretAccessKey: profile.secretAccessKey,
          bucketName: profile.bucketName,
          publicDomain: profile.publicDomain
        });
      }
      break;
    case 'oss':
      if (profile.region && profile.accessKeyId && profile.accessKeySecret && profile.bucket) {
        apiInstance = new OssAPI({
          region: profile.region,
          accessKeyId: profile.accessKeyId,
          accessKeySecret: profile.accessKeySecret,
          bucket: profile.bucket,
          publicDomain: profile.publicDomain
        });
      }
      break;
    case 'cos':
      if (profile.region && profile.secretId && profile.secretKey && profile.bucket) {
        apiInstance = new CosAPI({
          region: profile.region,
          secretId: profile.secretId,
          secretKey: profile.secretKey,
          bucket: profile.bucket,
          publicDomain: profile.publicDomain
        });
      }
      break;
    case 'lsky':
      if (profile.lskyUrl && profile.lskyToken) {
        apiInstance = new LskyAPI(profile.lskyUrl, profile.lskyToken);
      }
      break;
    case 'smms':
      if (profile.smmsToken) {
        apiInstance = new SmmsAPI(profile.smmsToken);
      }
      break;
  }

  if (apiInstance) {
    apiInstances.set(type, apiInstance);
  }

  return apiInstance;
}

/**
 * 清除API实例缓存
 */
function clearAPIInstances() {
  apiInstances.clear();
}

autoUpdater.autoDownload = false;

// 创建COS客户端的简单函数
function createCOSClient(secretId, secretKey) {
  return new COS({
    SecretId: secretId,
    SecretKey: secretKey,
    Timeout: 30000,
    // 强制禁用代理
    Proxy: '',
    UseAccelerate: false,
  });
}

// 执行COS操作时临时禁用代理的包装函数（异步等待）
async function executeWithoutProxy(operation) {
  // 临时清除进程级代理环境变量
  const originalProxy = {
    HTTP_PROXY: process.env.HTTP_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    ALL_PROXY: process.env.ALL_PROXY,
    http_proxy: process.env.http_proxy,
    https_proxy: process.env.https_proxy,
    all_proxy: process.env.all_proxy,
  };
  
  // 清除代理环境变量
  delete process.env.HTTP_PROXY;
  delete process.env.HTTP_PROXY;
  delete process.env.ALL_PROXY;
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  delete process.env.all_proxy;
  
  try {
    const result = await operation();
    return result;
  } finally {
    // 恢复原有环境变量（如果有的话）
    Object.keys(originalProxy).forEach(key => {
      if (originalProxy[key] !== undefined) {
        process.env[key] = originalProxy[key];
      }
    });
  }
}

// 执行AI操作时确保可以使用代理的包装函数
async function executeWithProxy(operation) {
  // 保持现有的代理环境变量，不做任何修改
  try {
    const result = await operation();
    return result;
  } catch (error) {
    console.error('[Proxy] 请求执行失败:', error);
    throw error;
  }
}

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
// app.commandLine.appendSwitch('no-proxy-server'); // 注释掉，让AI请求可以使用代理

try {
  require('electron-reloader')(module, {});
} catch (_) {}

const store = new Store();

const MAX_ACTIVITIES = 20;

// 生成机器码（基于硬件信息）
function generateMachineId() {
  const platform = os.platform();
  const arch = os.arch();
  const hostname = os.hostname();
  const networkInterfaces = os.networkInterfaces();
  
  // 获取第一个非内部的网络接口MAC地址
  let macAddress = '';
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        macAddress = iface.mac;
        break;
      }
    }
    if (macAddress) break;
  }
  
  // 组合硬件信息生成唯一标识
  const hardwareInfo = `${platform}-${arch}-${hostname}-${macAddress}`;
  const machineId = crypto.createHash('sha256').update(hardwareInfo).digest('hex').substring(0, 16);
  
  return machineId;
}

// 发送统计请求
async function sendAnalytics(type, data = {}) {
  console.log(`[Analytics] 开始发送 ${type} 统计...`);
  
  // 检查是否启用统计
  if (!ANALYTICS_CONFIG.ENABLED) {
    console.log(`[Analytics] 统计已禁用 (${type})`);
    return true;
  }
  
  try {
    const machineId = store.get('machineId') || generateMachineId();
    const version = packageJson.version;
    
    const analyticsData = {
      type, // 'install' 或 'usage'
      machineId,
      version,
      timestamp: new Date().toISOString(),
      platform: os.platform(),
      arch: os.arch(),
      ...data
    };
    
    console.log(`[Analytics] 准备发送数据:`, analyticsData);
    console.log(`[Analytics] 目标URL: ${getAnalyticsUrl('/' + type)}`);
    
    const https = require('https');
    const postData = JSON.stringify(analyticsData);
    
    // 解析URL获取hostname和path
    const url = new URL(getAnalyticsUrl('/' + type));
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': `R2APP/${version}`
      },
      timeout: ANALYTICS_CONFIG.TIMEOUT
    };
    
    console.log(`[Analytics] 请求选项:`, options);
    
    // 重试机制
    let lastError;
    for (let attempt = 1; attempt <= ANALYTICS_CONFIG.RETRY_COUNT; attempt++) {
      try {
        console.log(`[Analytics] 尝试 ${attempt}/${ANALYTICS_CONFIG.RETRY_COUNT}...`);
        
        const result = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              console.log(`[Analytics] 响应状态: ${res.statusCode}, 数据: ${data}`);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log(`[Analytics] ${type} 统计发送成功 (尝试 ${attempt}/${ANALYTICS_CONFIG.RETRY_COUNT})`);
                resolve(true);
              } else {
                console.log(`[Analytics] ${type} 统计发送失败: ${res.statusCode} (尝试 ${attempt}/${ANALYTICS_CONFIG.RETRY_COUNT})`);
                resolve(false);
              }
            });
          });
          
          req.on('error', (err) => {
            console.log(`[Analytics] ${type} 统计发送错误: ${err.message} (尝试 ${attempt}/${ANALYTICS_CONFIG.RETRY_COUNT})`);
            lastError = err;
            resolve(false);
          });
          
          req.on('timeout', () => {
            console.log(`[Analytics] ${type} 统计发送超时 (尝试 ${attempt}/${ANALYTICS_CONFIG.RETRY_COUNT})`);
            req.destroy();
            resolve(false);
          });
          
          req.write(postData);
          req.end();
        });
        
        if (result) {
          return true;
        }
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < ANALYTICS_CONFIG.RETRY_COUNT) {
          console.log(`[Analytics] 等待 ${ANALYTICS_CONFIG.RETRY_DELAY}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, ANALYTICS_CONFIG.RETRY_DELAY));
        }
      } catch (error) {
        console.log(`[Analytics] 尝试 ${attempt} 出现异常:`, error.message);
        lastError = error;
        if (attempt < ANALYTICS_CONFIG.RETRY_COUNT) {
          await new Promise(resolve => setTimeout(resolve, ANALYTICS_CONFIG.RETRY_DELAY));
        }
      }
    }
    
    console.log(`[Analytics] ${type} 统计发送最终失败，已重试 ${ANALYTICS_CONFIG.RETRY_COUNT} 次`);
    return false;
  } catch (error) {
    console.log(`[Analytics] ${type} 统计发送异常:`, error.message);
    return false;
  }
}

// 检查并发送安装统计
async function checkAndSendInstallAnalytics() {
  console.log('[Analytics] 检查并发送安装统计...');
  
  const machineId = store.get('machineId');
  const installReported = store.get('installReported');
  const currentVersion = packageJson.version;
  
  if (!machineId) {
    // 首次安装，生成机器码
    const newMachineId = generateMachineId();
    store.set('machineId', newMachineId);
    console.log(`[Analytics] 生成机器码: ${newMachineId}`);
  }
  
  // 检查是否已经报告过当前版本的安装
  if (!installReported || installReported.version !== currentVersion) {
    console.log(`[Analytics] 发送安装统计，版本: ${currentVersion}`);
    const success = await sendAnalytics('install', {
      installType: 'first_time',
      previousVersion: installReported?.version || null
    });
    
    if (success) {
      store.set('installReported', {
        version: currentVersion,
        timestamp: new Date().toISOString()
      });
      console.log(`[Analytics] 安装统计已发送: ${currentVersion}`);
    } else {
      console.log(`[Analytics] 安装统计发送失败: ${currentVersion}`);
    }
  } else {
    console.log(`[Analytics] 当前版本 ${currentVersion} 已报告过安装`);
  }
}

// 发送使用统计
async function sendUsageAnalytics() {
  console.log('[Analytics] 发送使用统计...');
  
  const success = await sendAnalytics('usage', {
    sessionId: uuidv4(),
    uptime: process.uptime()
  });
  
  if (success) {
    console.log('[Analytics] 使用统计已发送');
  } else {
    console.log('[Analytics] 使用统计发送失败');
  }
}

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
      const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');

      const onProgress = (percentage, loaded, total) => {
        mainWindow.webContents.send('upload-progress', { key, percentage, filePath });
      };

      activeUploads.set(key, { cancel: () => { /* R2 upload doesn't support direct cancel */ } });

      await r2API.uploadFile(filePath, key, onProgress);
      mainWindow.webContents.send('upload-progress', { key, percentage: 100, filePath });
      addRecentActivity('upload', `文件 ${key} 上传成功。`, 'success');

    } else if (storage.type === 'oss') {
      const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');

      const onProgress = (percentage, progress, total, speed) => {
        mainWindow.webContents.send('upload-progress', { 
          key, 
          percentage,
          checkpoint: progress,
          filePath,
        });
      };

      activeUploads.set(key, { cancel: () => { /* OSS upload doesn't support direct cancel */ } });

      await ossAPI.uploadFile(filePath, key, onProgress, checkpoint);
      mainWindow.webContents.send('upload-progress', { key, percentage: 100, filePath });
      addRecentActivity('upload', `文件 ${key} 上传成功。`, 'success');
    } else if (storage.type === 'cos') {
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');

      const onProgress = (percentage, loaded, total) => {
        mainWindow.webContents.send('upload-progress', { key, percentage, filePath });
      };

      activeUploads.set(key, { cancel: () => { /* COS upload doesn't support direct cancel */ } });

      await executeWithoutProxy(() => cosAPI.uploadFile(filePath, key, onProgress));
      mainWindow.webContents.send('upload-progress', { key, percentage: 100, filePath });
      addRecentActivity('upload', `文件 ${key} 上传成功。`, 'success');
    } else if (storage.type === 'smms') {
      // SM.MS 图床上传
      try {
        const active = getActiveProfile();
        const smmsAPI = getAPIInstance('smms');
      if (!smmsAPI) throw new Error('SM.MS API实例创建失败');
        
        const response = await executeWithoutProxy(() => smmsAPI.uploadImage(filePath));
        
        if (response.success) {
          mainWindow.webContents.send('upload-progress', { 
            key, 
            percentage: 100, 
            filePath,
            imageUrl: response.data.url,
            deleteUrl: response.data.delete_url
          });
          try {
            objectUrlCache.set(`smms:${key}`, response.data?.url);
            if (response.data?.delete_url) objectDeleteUrlCache.set(`smms:${key}`, response.data?.delete_url);
            if (response.data?.hash) objectHashCache.set(`smms:${key}`, response.data?.hash);
          } catch {}
          addRecentActivity('upload', `图片 ${key} 已上传到 SM.MS，URL: ${response.data.url}`, 'success');
        } else {
          throw new Error(response.message || 'SM.MS 上传失败');
        }
      } catch (error) {
        console.error(`SM.MS upload failed for ${key}:`, error);
        mainWindow.webContents.send('upload-progress', { key, error: error.message, filePath });
        addRecentActivity('upload', `图片 ${key} 上传到 SM.MS 失败: ${error.message}`, 'error');
      }
    } else if (storage.type === 'lsky') {
      // 兰空图床上传
      try {
        const active = getActiveProfile();
        const lskyAPI = getAPIInstance('lsky');
      if (!lskyAPI) throw new Error('Lsky API实例创建失败');
        
        const uploadOptions = {
          permission: active?.permission ?? 1,
          albumId: active?.albumId
        };

        const response = await executeWithoutProxy(() => lskyAPI.uploadImage(filePath, uploadOptions));

        if (response.success) {
          mainWindow.webContents.send('upload-progress', { 
            key,
            percentage: 100,
            filePath,
            imageUrl: response.data?.url,
            deleteUrl: response.data?.delete_url
          });
          try {
            objectUrlCache.set(`lsky:${key}`, response.data?.url);
            if (response.data?.delete_url) objectDeleteUrlCache.set(`lsky:${key}`, response.data?.delete_url);
            if (response.data?.key) objectHashCache.set(`lsky:${key}`, response.data?.key);
          } catch {}
          addRecentActivity('upload', `图片 ${key} 已上传到兰空图床，URL: ${response.data?.url}`, 'success');
        } else {
          throw new Error(response.message || '兰空图床上传失败');
        }
      } catch (error) {
        console.error(`兰空图床上传失败 ${key}:`, error);
        mainWindow.webContents.send('upload-progress', { key, error: error.message, filePath });
        addRecentActivity('upload', `图片 ${key} 上传到兰空图床失败: ${error.message}`, 'error');
      }
    } else if (storage.type === 'smms') {
      // 读取上传历史作为文件列表
      try {
        const active = getActiveProfile();
        const smmsAPI = getAPIInstance('smms');
      if (!smmsAPI) throw new Error('SM.MS API实例创建失败');
        
        const response = await executeWithoutProxy(() => smmsAPI.getImageList());
        
        if (response.success) {
          rawFiles = response.data.files;
        } else {
          rawFiles = [];
        }
      } catch (error) {
        console.error('SM.MS 获取图片列表失败:', error);
        rawFiles = [];
      }
      folders = [];
      nextContinuationToken = null;
    } else if (storage.type === 'lsky') {
      // 读取图片列表
      const active = getActiveProfile();
      const lskyAPI = getAPIInstance('lsky');
      if (!lskyAPI) throw new Error('Lsky API实例创建失败');
      
      try {
        const response = await executeWithoutProxy(() => lskyAPI.getImageList({
          page: 1,
          order: 'newest',
          permission: 'public'
        }));

        if (response.success) {
          const arr = response.data.files || [];
          rawFiles = arr.map(it => {
            const fileName = it.origin_name || it.name || it.pathname?.split('/').pop() || it.key;
            return {
              Key: fileName, // 使用name字段作为文件名，如果没有则使用origin_name或从pathname提取
              LastModified: it.date || it.created_at,
              Size: Math.round(Number(it.size || 0)), // size字段直接是字节数
              ETag: it.md5,
              publicUrl: it.links?.url // 使用links.url字段
            };
          });
        } else {
          rawFiles = [];
        }
      } catch (error) {
        console.error('兰空图床获取图片列表失败:', error);
        rawFiles = [];
      }
      folders = [];
      nextContinuationToken = null;
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

function createPreviewWindow(fileName, filePath, bucket, publicUrl) {
  const key = `${bucket}/${filePath}/${fileName}`;

  if (previewWindows.has(key)) {
    const existingWindow = previewWindows.get(key);
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus();
      return;
    }
  }

  // 设置初始文件信息
  initialFileInfo = { fileName, filePath, bucket, publicUrl };

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
  const queryObj = { fileName, filePath, bucket };
  if (publicUrl) {
    queryObj.publicUrl = publicUrl;
  }
  const query = new URLSearchParams(queryObj);

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
    // 主窗口准备好后不立即显示，等待启动图关闭后再显示
    // mainWindow.show(); // 注释掉，不立即显示
  })

  // 监听主窗口内容加载完成事件
  mainWindow.webContents.on('did-finish-load', () => {
    // 主应用内容加载完成后，延迟2秒关闭启动图
    setTimeout(() => {
      hideSplash();
    }, 2000);
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
    // 以下注册仅会出现在"显示更多选项"的经典菜单中。

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
      // 不立即调用 startUpload，等待用户在上传页点击"开始上传"
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

app.whenReady().then(async () => {
  // 注释掉强制直连，让请求可以使用代理
  // await session.defaultSession.setProxy({ proxyRules: 'direct://' });
  

  
  // 显示启动图（不传递主窗口，因为此时主窗口还未创建）
  showSplash();
  
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
  // 主窗口创建完成后，将主窗口实例传递给启动图
  if (mainWindow) {
    // 重新调用showSplash，这次传递主窗口实例
    showSplash(mainWindow);
  }
  setupAutoUpdater()

  // 发送用户统计
  console.log('[Analytics] 开始发送用户统计...');
  try {
    // 检查并发送安装统计
    console.log('[Analytics] 检查并发送安装统计...');
    await checkAndSendInstallAnalytics();
    
    // 发送使用统计
    console.log('[Analytics] 发送使用统计...');
    await sendUsageAnalytics();
    
    console.log('[Analytics] 用户统计发送完成');
  } catch (error) {
    console.log('[Analytics] 统计发送失败:', error.message);
  }

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
  // 销毁启动图
  destroySplash();

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

// 发送系统通知
ipcMain.handle('show-notification', (event, notificationData) => {
  try {
    const { title, body, icon, requireInteraction = false, tag, silent = false } = notificationData;
    
    // 创建通知选项
    const options = {
      body: body || '',
      icon: icon || path.join(__dirname, '../resources/icon.ico'),
      requireInteraction: requireInteraction,
      silent: silent,
      tag: tag || 'default'
    };
    
    // 发送通知到渲染进程
    event.sender.send('notification-clicked', { title, body, tag });
    
    // 如果需要在主进程也显示通知（可选）
    if (process.platform === 'win32') {
      // Windows 平台使用 toast 通知
      const { Notification } = require('electron');
      const notification = new Notification({
        title: title,
        body: body,
        icon: options.icon,
        silent: options.silent
      });
      
      notification.show();
      
      // 监听通知点击
      notification.on('click', () => {
        event.sender.send('notification-clicked', { title, body, tag });
      });
      
      return { success: true, message: '通知已发送' };
    } else {
      // 其他平台直接返回成功
      return { success: true, message: '通知已发送' };
    }
  } catch (error) {
    console.error('发送通知失败:', error);
    return { success: false, error: error.message };
  }
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
    const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
    try {
      const result = await r2API.testConnection();
      return result;
    } catch (error) {
      return { success: false, error: `R2 连接失败: ${error.message}` };
    }
  } else if (profile.type === 'oss') {
    if (!profile.accessKeyId || !profile.accessKeySecret || !profile.bucket || !profile.region) {
       return { success: false, error: '缺少 OSS 配置信息。' };
    }
    const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
    try {
      const result = await ossAPI.testConnection();
      return result;
    } catch (error) {
      return { success: false, error: `OSS 连接失败: ${error.message}` };
    }
  } else if (profile.type === 'cos') {
    if (!profile.secretId || !profile.secretKey || !profile.bucket || !profile.region) {
      return { success: false, error: '缺少 COS 配置信息。' };
    }
    
    try {
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');
      const result = await executeWithoutProxy(() => cosAPI.testConnection());
      return result;
    } catch (error) {
      console.error('COS connection error details:', error);
      return { success: false, error: `COS 连接失败: ${error.message}` };
    }
  } else if (profile.type === 'smms') {
    if (!profile.smmsToken) {
      return { success: false, error: '缺少 SM.MS Token' };
    }
    
    try {
      // 使用SM.MS API模块测试连接
      const smmsAPI = getAPIInstance('smms');
      if (!smmsAPI) throw new Error('SM.MS API实例创建失败');
      const result = await executeWithoutProxy(() => smmsAPI.testConnection());
      return result;
    } catch (error) {
      return { success: false, error: `SM.MS 连接失败: ${error.message}` };
    }
  } else if (profile.type === 'lsky') {
    if (!profile.lskyToken || !profile.lskyUrl) {
      return { success: false, error: '缺少兰空图床地址或Token' };
    }
    // 使用兰空图床API模块测试连接
    try {
      const lskyAPI = getAPIInstance('lsky');
      if (!lskyAPI) throw new Error('Lsky API实例创建失败');
      const result = await executeWithoutProxy(() => lskyAPI.testConnection());
      return result;
    } catch (error) {
      return { success: false, error: `兰空图床连接失败: ${error.message}` };
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
            client: null, // R2 现在使用 R2API 模块
            type: 'r2',
            bucket: profile.bucketName,
        };
    } else if (profile.type === 'oss') {
        if (!profile.accessKeyId || !profile.accessKeySecret || !profile.bucket || !profile.region) return null;
        return {
            client: null, // OSS 现在使用 OssAPI 模块
            type: 'oss',
            bucket: profile.bucket,
        };
    } else if (profile.type === 'cos') {
        if (!profile.secretId || !profile.secretKey || !profile.bucket || !profile.region) return null;
        return {
            client: null, // COS 现在使用 CosAPI 模块
            type: 'cos',
            bucket: profile.bucket,
            region: profile.region,
        };
    } else if (profile.type === 'smms') {
        if (!profile.smmsToken) return null;
        return {
            client: null, // SM.MS 不需要客户端对象
            type: 'smms',
            bucket: 'smms',
            token: profile.smmsToken,
        };
    } else if (profile.type === 'lsky') {
        if (!profile.lskyToken || !profile.lskyUrl) return null;
        return {
            client: null,
            type: 'lsky',
            bucket: 'lsky',
            token: profile.lskyToken,
            url: profile.lskyUrl,
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
      const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
      const result = await r2API.testConnection();
      return result;
    } else if (storage.type === 'oss') {
      const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
      const result = await ossAPI.testConnection();
      return result;
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
      const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
      const response = await r2API.getStorageStats();
      
      if (response.success) {
        totalCount = response.data.totalCount;
        totalSize = response.data.totalSize;
      }
    } else if (storage.type === 'oss') {
      const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
      const response = await ossAPI.getStorageStats();
      
      if (response.success) {
        totalCount = response.data.totalCount;
        totalSize = response.data.totalSize;
      }
    } else if (storage.type === 'cos') {
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');
      const response = await executeWithoutProxy(() => cosAPI.getStorageStats());
      
      if (response.success) {
        totalCount = response.data.totalCount;
        totalSize = response.data.totalSize;
      }
    } else if (storage.type === 'smms') {
      // SM.MS 统计
      const smmsAPI = getAPIInstance('smms');
      if (!smmsAPI) throw new Error('SM.MS API实例创建失败');
      const response = await executeWithoutProxy(() => smmsAPI.getStorageStats());
      
      if (response.success) {
        totalCount = response.data.totalCount;
        totalSize = response.data.totalSize;
      }
    } else if (storage.type === 'lsky') {
      // 兰空图床统计
      const lskyAPI = getAPIInstance('lsky');
      if (!lskyAPI) throw new Error('Lsky API实例创建失败');
      const response = await executeWithoutProxy(() => lskyAPI.getStorageStats());
      
      if (response.success) {
        totalCount = response.data.totalCount;
        totalSize = response.data.totalSize;
      }
    }
    
    const quota = parseInt(activeProfile?.storageQuotaGB, 10);
    const quotaUnit = activeProfile?.storageQuotaUnit || 'GB';

    return { success: true, data: { 
      totalCount, 
      totalSize, 
      bucketName: storage.bucket,
      storageQuotaGB: !isNaN(quota) && quota > 0 ? quota : 10,
      storageQuotaUnit: quotaUnit
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
      const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
      const response = await r2API.listFiles({
        prefix: apiPrefix,
        delimiter: apiDelimiter,
        continuationToken: continuationToken
      });
      
      if (response.success) {
        rawFiles = response.data.files || [];
        folders = response.data.folders || [];
        nextContinuationToken = response.data.nextContinuationToken;
      }
    } else if (storage.type === 'oss') {
      const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
      const response = await ossAPI.listFiles({
        prefix: apiPrefix,
        delimiter: apiDelimiter,
        continuationToken: continuationToken
      });
      
      if (response.success) {
        rawFiles = response.data.files || [];
        folders = response.data.folders || [];
        nextContinuationToken = response.data.nextContinuationToken;
      }
    } else if (storage.type === 'cos') {
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');
      const response = await executeWithoutProxy(() => cosAPI.listFiles({
        prefix: apiPrefix,
        delimiter: apiDelimiter,
        continuationToken: continuationToken
      }));
      
      if (response.success) {
        rawFiles = response.data.files || [];
        folders = response.data.folders || [];
        nextContinuationToken = response.data.nextContinuationToken;
      }
    } else if (storage.type === 'smms') {
      // SM.MS: 使用上传历史作为文件列表
      const https = require('https');
      const active = getActiveProfile();
      const token = active?.smmsToken?.startsWith('Basic ') ? active.smmsToken : `Basic ${active?.smmsToken || ''}`;
      const doFetch = (host) => new Promise((resolve, reject) => {
        const options = {
          hostname: host,
          port: 443,
          path: '/api/v2/upload_history',
          method: 'GET',
          headers: {
            Authorization: token,
            'User-Agent': 'R2APP/4.1',
            'Content-Type': 'multipart/form-data',
            Accept: '*/*',
            Connection: 'keep-alive',
            Host: host,
          },
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {

            try {
              const obj = JSON.parse(data);

              resolve(obj);
            } catch {
              resolve({ __status: res.statusCode, __headers: res.headers, __raw: data });
            }
          });
        });
        req.on('error', reject);
        req.end();
      });
      let listResp = await executeWithoutProxy(() => doFetch('sm.ms'));
      if (!listResp || listResp.__status === 405 || listResp.status === false) {

        listResp = await executeWithoutProxy(() => doFetch('api.sm.ms'));
      }
      const items = Array.isArray(listResp?.data) ? listResp.data : [];
      rawFiles = items.map((it) => {
        const objectKey = it.filename || it.storename || it.path || it.hash;
        try {
          objectUrlCache.set(`smms:${objectKey}`, it.url);
          if (it.delete) objectDeleteUrlCache.set(`smms:${objectKey}`, it.delete);
          if (it.hash) objectHashCache.set(`smms:${objectKey}`, it.hash);
        } catch {}
        return {
          Key: objectKey,
          LastModified: it.created_at || new Date().toISOString(),
          Size: Number(it.size || 0),
          ETag: it.hash,
          publicUrl: it.url,
        };
      });
      folders = [];
      nextContinuationToken = null;

    } else if (storage.type === 'lsky') {
      // 兰空图床: 列出图片
      const active = getActiveProfile();
      const lskyAPI = getAPIInstance('lsky');
      if (!lskyAPI) throw new Error('Lsky API实例创建失败');
      
      try {
        const response = await executeWithoutProxy(() => lskyAPI.getImageList({
          page: 1,
          order: 'newest',
          permission: 'public'
        }));

        if (response.success) {
          const arr = response.data.files || [];
          console.log('[LSKY] Raw image data:', arr.slice(0, 2)); // 调试前两个图片的数据
          rawFiles = arr.map((it) => {
            // 根据兰空图床API文档，图片数据结构
            const fileName = it.origin_name || it.name || it.pathname?.split('/').pop() || it.key;
            
            const fileData = {
              Key: fileName, // 使用name字段作为文件名，如果没有则使用origin_name或从pathname提取
              LastModified: it.date || it.created_at,
              Size: Math.round(Number(it.size || 0)), // size字段直接是字节数
              ETag: it.md5,
              publicUrl: it.links?.url, // 使用links.url字段
              deleteUrl: it.links?.delete_url, // 使用links.delete_url字段
              // 保存实际的 key 用于删除
              lskyKey: it.key,
              pathname: it.pathname, // 用于显示
            };
            
            console.log(`[LSKY] Processed file: ${fileName}, key: ${it.key}, url: ${fileData.publicUrl}`);
            
            // 缓存 URL 用于下载和删除 - 使用文件名作为缓存key
            try {
              objectUrlCache.set(`lsky:${fileName}`, fileData.publicUrl);
              if (fileData.deleteUrl) objectDeleteUrlCache.set(`lsky:${fileName}`, fileData.deleteUrl);
              // 缓存真实的 key 用于删除 - 使用文件名作为缓存key
              if (it.key) objectHashCache.set(`lsky:${fileName}`, it.key);
            } catch {}
            
            return fileData;
          });
        } else {
          rawFiles = [];
        }
      } catch (error) {
        console.error('兰空图床获取图片列表失败:', error);
        rawFiles = [];
      }
      folders = [];
      nextContinuationToken = null;
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
      publicUrl: item.publicUrl,
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
      const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
      await r2API.deleteFile(key);
    } else if (storage.type === 'oss') {
      const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
      await ossAPI.deleteFile(key);
    } else if (storage.type === 'cos') {
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');
      await executeWithoutProxy(() => cosAPI.deleteFile(key));
    } else if (storage.type === 'smms') {
      // SM.MS 删除
      try {
        const activeProfile = getActiveProfile();
        const smmsAPI = getAPIInstance('smms');
      if (!smmsAPI) throw new Error('SM.MS API实例创建失败');
        
        // 尝试从缓存中取 hash；如无，则查找
        let hash = objectHashCache.get(`smms:${key}`);
        if (!hash) {
          hash = await executeWithoutProxy(() => smmsAPI.findImageHash(key));
        }
        
        if (!hash) {
          throw new Error('未找到删除哈希');
        }
        
        console.log(`[SMMS DELETE] Attempting to delete hash: ${hash} for key: ${key}`);
        const response = await executeWithoutProxy(() => smmsAPI.deleteImage(hash));
        
        if (response.success) {
          // 清理缓存
          objectHashCache.delete(`smms:${key}`);
          objectUrlCache.delete(`smms:${key}`);
          objectDeleteUrlCache.delete(`smms:${key}`);
        }
      } catch (error) {
        console.error(`[SMMS DELETE] Delete error:`, error);
        throw error;
      }
    } else if (storage.type === 'lsky') {
      // 兰空图床删除
      const activeProfile = getActiveProfile();
      const lskyAPI = getAPIInstance('lsky');
      if (!lskyAPI) throw new Error('Lsky API实例创建失败');
      
      // 尝试从缓存获取真实的 key
      let lskyKey = objectHashCache.get(`lsky:${key}`);
      
      console.log(`[LSKY DELETE] Attempting to delete key: ${key}, cached lskyKey: ${lskyKey}`);
      
      // 如果没有缓存的key，说明缓存有问题，我们需要重新获取图片列表来找到正确的key
      if (!lskyKey) {
        console.log(`[LSKY DELETE] No cached key found, need to find correct key for: ${key}`);
        // 这里可以尝试从文件名中提取key，但更可靠的方法是重新获取图片列表
        // 暂时使用原始key，但这不是最佳解决方案
        lskyKey = key;
      }
      
      try {
        await executeWithoutProxy(() => lskyAPI.deleteImage(lskyKey));
        console.log(`[LSKY DELETE] Delete successful for ${key}`);
        // 清理缓存
        objectUrlCache.delete(`lsky:${key}`);
        objectDeleteUrlCache.delete(`lsky:${key}`);
        objectHashCache.delete(`lsky:${key}`);
      } catch (error) {
        console.log(`[LSKY DELETE] Delete failed: ${error.message}`);
        throw error;
      }
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
      const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
      
      // 获取所有文件
      let continuationToken;
      do {
        const response = await r2API.listFiles({
          prefix: prefix,
          continuationToken: continuationToken
        });
        
        if (response.success && response.data.files) {
          allKeys.push(...response.data.files.map(item => item.Key));
        }
        continuationToken = response.data.nextContinuationToken;
      } while (continuationToken);

      // 批量删除文件
      if (allKeys.length > 0) {
        await r2API.deleteFiles(allKeys);
      }
    } else if (type === 'oss') {
      const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
      
      // 获取所有文件
      let continuationToken;
      do {
        const response = await ossAPI.listFiles({
          prefix: prefix,
          continuationToken: continuationToken
        });
        
        if (response.success && response.data.files) {
          allKeys.push(...response.data.files.map(item => item.Key));
        }
        continuationToken = response.data.nextContinuationToken;
      } while (continuationToken);

      // 批量删除文件
      if (allKeys.length > 0) {
        await ossAPI.deleteFiles(allKeys);
      }
    } else if (type === 'cos') {
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');
      
      // 获取所有文件
      let continuationToken;
      do {
        const response = await executeWithoutProxy(() => cosAPI.listFiles({
          prefix: prefix,
          continuationToken: continuationToken
        }));
        
        if (response.success && response.data.files) {
          allKeys.push(...response.data.files.map(item => ({ Key: item.Key })));
        }
        continuationToken = response.data.nextContinuationToken;
      } while (continuationToken);

      if (allKeys.length > 0) {
        // COS 批量删除
        const keys = allKeys.map(item => item.Key);
        await executeWithoutProxy(() => cosAPI.deleteFiles(keys));
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
    } else if (type === 'cos') {
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');
      await executeWithoutProxy(() => cosAPI.uploadFile('', folderName)); // 创建空文件作为文件夹
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
      const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
      
      // 直接使用R2API的getFileContent方法获取文件内容
      const response = await r2API.getFileContent(key, PREVIEW_FILE_SIZE_LIMIT);
      if (response.success) {
        if (response.data.tooLarge) {
          fileTooLarge = true;
        } else {
          content = response.data.content;
        }
      }
    } else if (type === 'oss') {
      const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
      
      const response = await ossAPI.getFileContent(key, PREVIEW_FILE_SIZE_LIMIT);
      if (response.success) {
        if (response.data.tooLarge) {
          fileTooLarge = true;
        } else {
          content = response.data.content;
        }
      }
    } else if (type === 'cos') {
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');
      
      const response = await executeWithoutProxy(() => cosAPI.getFileContent(key, PREVIEW_FILE_SIZE_LIMIT));
      if (response.success) {
        if (response.data.tooLarge) {
          fileTooLarge = true;
        } else {
          content = response.data.content;
        }
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
   
   // 处理包含路径分隔符的 key（如兰空图床的 2025/08/17/filename.png）
   let fileName = key;
   if (key.includes('/')) {
     // 提取文件名部分
     fileName = key.split('/').pop();
   }
   
   let filePath = join(downloadsPath, fileName);

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
     status: 'preparing',
     progress: 0,
     createdAt: new Date().toISOString(),
   };

   const tasks = store.get('download-tasks', {});
   tasks[taskId] = task;
   store.set('download-tasks', tasks);

   mainWindow.webContents.send('download-update', { type: 'start', task });

   try {
     // 更新任务状态为正在下载
     const downloadingTasks = store.get('download-tasks', {});
     if (downloadingTasks[taskId]) {
       downloadingTasks[taskId].status = 'downloading';
       store.set('download-tasks', downloadingTasks);
     }
     mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, status: 'downloading' } });
     
     if (storage.type === 'r2') {
         const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');

         const onProgress = (progress, downloadedBytes, totalBytes, speed) => {
           mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, progress, speed } });
         };

         await r2API.downloadFile(key, filePath, onProgress);
         
         const finalTasks = store.get('download-tasks', {});
         if (finalTasks[taskId]) {
           finalTasks[taskId].status = 'completed';
           finalTasks[taskId].progress = 100;
           store.set('download-tasks', finalTasks);
         }
         mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, progress: 100, status: 'completed' } });
         addRecentActivity('download', `下载了 ${key}`);
     } else if (storage.type === 'oss') {
         const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');

         await ossAPI.downloadFile(key, filePath);
         
         const finalTasks = store.get('download-tasks', {});
         if (finalTasks[taskId]) {
           finalTasks[taskId].status = 'completed';
           finalTasks[taskId].progress = 100;
           store.set('download-tasks', finalTasks);
         }
         mainWindow.webContents.send('download-update', { type: 'progress', data: { id: taskId, progress: 100, status: 'completed' } });
     } else if (storage.type === 'cos') {
         const cosAPI = getAPIInstance('cos');
         if (!cosAPI) throw new Error('COS API实例创建失败');
         
         const onProgress = (percentage, loaded, total) => {
           mainWindow.webContents.send('download-update', { 
             type: 'progress', 
             data: { id: taskId, progress: percentage } 
           });
         };
         
         await executeWithoutProxy(() => cosAPI.downloadFile(key, filePath, onProgress));
         
         const finalTasks = store.get('download-tasks', {});
         if (finalTasks[taskId]) {
           finalTasks[taskId].status = 'completed';
           finalTasks[taskId].progress = 100;
           store.set('download-tasks', finalTasks);
         }
         mainWindow.webContents.send('download-update', { 
           type: 'progress', 
           data: { id: taskId, progress: 100, status: 'completed' } 
         });
         addRecentActivity('download', `下载了 ${key}`);
     } else if (storage.type === 'smms' || storage.type === 'lsky') {
        // 通用公网 URL 下载器
        const https = require('https');
        const url = objectUrlCache.get(`${storage.type}:${key}`);
        if (!url) throw new Error('未找到文件直链，请在文件列表中复制链接');
        
        const writeStream = fs.createWriteStream(filePath);
        await new Promise((resolve, reject) => {
          https.get(url, (res) => {
            if (res.statusCode !== 200) {
              writeStream.close();
              return reject(new Error(`下载失败: ${res.statusCode}`));
            }
            
            const totalSize = parseInt(res.headers['content-length'], 10);
            let downloadedSize = 0;
            
            res.on('data', (chunk) => {
              downloadedSize += chunk.length;
              if (totalSize > 0) {
                const progress = Math.round((downloadedSize / totalSize) * 100);
                mainWindow.webContents.send('download-update', { 
                  type: 'progress', 
                  data: { id: taskId, progress, status: 'downloading' } 
                });
              }
            });
            
            res.pipe(writeStream);
            res.on('error', reject);
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
            writeStream.on('error', reject);
          }).on('error', reject);
        });
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

ipcMain.handle('get-machine-id', () => {
  const machineId = store.get('machineId') || generateMachineId();
  return {
    machineId,
    installReported: store.get('installReported'),
    currentVersion: packageJson.version
  };
});

// 公告相关配置
const ANNOUNCEMENT_CONFIG = {
  API_URL: 'https://cstj.server.aiqji.cn/api/announcements',
  CACHE_DURATION: 5 * 60 * 1000, // 5分钟缓存
  RETRY_DELAY: 30 * 1000, // 30秒重试间隔
  MAX_RETRIES: 3
};

// 公告缓存
let announcementCache = {
  data: null,
  timestamp: 0,
  error: null
};

// 获取公告数据
async function fetchAnnouncements() {
  try {
    const response = await fetch(ANNOUNCEMENT_CONFIG.API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'R2APP/1.0.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      announcementCache = {
        data: data.data,
        timestamp: Date.now(),
        error: null
      };
      return { success: true, data: data.data };
    } else {
      throw new Error(data.error || '获取公告失败');
    }
  } catch (error) {
    console.error('获取公告失败:', error);
    announcementCache.error = error.message;
    return { success: false, error: error.message };
  }
}

// 公告相关的 IPC 处理器
ipcMain.handle('get-announcements', async () => {
  try {
    const now = Date.now();
    
    // 检查缓存是否有效
    if (announcementCache.data && 
        (now - announcementCache.timestamp) < ANNOUNCEMENT_CONFIG.CACHE_DURATION) {
      return { success: true, data: announcementCache.data };
    }
    
    // 如果缓存过期或不存在，重新获取
    return await fetchAnnouncements();
  } catch (error) {
    console.error('获取公告失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-announcement-cache', () => {
  try {
    announcementCache = {
      data: null,
      timestamp: 0,
      error: null
    };
    return { success: true };
  } catch (error) {
    console.error('清除公告缓存失败:', error);
    return { success: false, error: error.message };
  }
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
  const { fileName, filePath, bucket, publicUrl } = fileInfo || {};
  createPreviewWindow(fileName, filePath, bucket, publicUrl);
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
      const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
      url = await r2API.getPresignedUrl(key, 900);
    } else if (storage.type === 'oss') {
      const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
      url = await ossAPI.getPresignedUrl(key, 900);
    } else if (storage.type === 'cos') {
      // COS 获取预签名URL
      const cosAPI = getAPIInstance('cos');
      if (!cosAPI) throw new Error('COS API实例创建失败');
      url = await executeWithoutProxy(() => cosAPI.getPresignedUrl(key, 900));
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
        const r2API = getAPIInstance('r2');
      if (!r2API) throw new Error('R2 API实例创建失败');
        const searchResponse = await r2API.searchFiles(lowerCaseSearchTerm, { continuationToken });
        response = {
          Contents: searchResponse.data.files,
          NextContinuationToken: null // 搜索已经处理了分页
        };
      } else if (storage.type === 'oss') {
        const ossAPI = getAPIInstance('oss');
      if (!ossAPI) throw new Error('OSS API实例创建失败');
        const searchResponse = await ossAPI.searchFiles(lowerCaseSearchTerm, { continuationToken });
        response = {
          Contents: searchResponse.data.files,
          NextContinuationToken: null // 搜索已经处理了分页
        };
      } else if (storage.type === 'cos') {
        const cosAPI = getAPIInstance('cos');
        if (!cosAPI) throw new Error('COS API实例创建失败');
        const searchResponse = await executeWithoutProxy(() => cosAPI.searchFiles(lowerCaseSearchTerm, { continuationToken }));
        response = {
          Contents: searchResponse.data.files,
          NextContinuationToken: null // 搜索已经处理了分页
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

ipcMain.handle('list-buckets', async (event, profile) => {
  if (!profile) {
    return { success: false, error: '无效的配置' };
  }

  try {
    let buckets = [];
    
    if (profile.type === 'cos') {
      // 腾讯云COS获取存储桶列表
      // 清理配置参数
      const cleanSecretId = profile.secretId?.trim();
      const cleanSecretKey = profile.secretKey?.trim();
      
      if (!cleanSecretId || !cleanSecretKey) {
        throw new Error('COS配置参数不完整，请检查SecretId和SecretKey配置');
      }
      
      const cosClient = createCOSClient(cleanSecretId, cleanSecretKey);
      
      const result = await executeWithoutProxy(() => {
        return new Promise((resolve, reject) => {
          cosClient.getService((err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      });
      
      buckets = (result.Buckets || []).map(b => ({
        name: b.Name,
        region: b.Location,
        creationDate: b.CreationDate
      }));
      
    } else if (profile.type === 'oss') {
      // 阿里云OSS获取存储桶列表
      // OSS SDK不支持直接列出所有bucket，需要用户手动输入
      return { 
        success: false, 
        error: 'OSS需要手动输入存储桶名称' 
      };
      
    } else if (profile.type === 'r2') {
      // Cloudflare R2不支持列出所有bucket，需要用户手动输入
      return { 
        success: false, 
        error: 'R2需要手动输入存储桶名称' 
      };
    }
    
    return { success: true, buckets };
  } catch (error) {
    console.error('Failed to list buckets:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-uploads-state', (_, uploads) => {
  store.set('uploads-state', uploads);
});

// AI配置同步处理器
ipcMain.handle('syncAIConfigs', async () => {
  try {
    console.log('[Main] 开始同步AI配置到数据库...');
    
    // 从localStorage获取AI配置（这里需要访问渲染进程的数据）
    // 由于主进程无法直接访问localStorage，我们需要通过其他方式
    // 方案1：通过渲染进程传递配置数据
    // 方案2：在应用启动时自动同步
    
    // 暂时返回成功，实际实现需要更复杂的逻辑
    return { success: true, message: 'AI配置同步功能待实现' };
  } catch (error) {
    console.error('[Main] AI配置同步失败:', error);
    return { success: false, error: error.message };
  }
});

