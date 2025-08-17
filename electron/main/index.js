import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut, screen, Tray, Menu, nativeImage, session } from 'electron'
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
import COS from 'cos-nodejs-sdk-v5';
import { autoUpdater } from 'electron-updater';
import crypto from 'crypto';
import os from 'os';
import { ANALYTICS_CONFIG } from './analytics-config.js';

const activeUploads = new Map();
// Cache public URL and delete URL for providers that return them (SM.MS, PICUI)
const objectUrlCache = new Map(); // key: provider+":"+objectKey -> url
const objectDeleteUrlCache = new Map(); // key: provider+":"+objectKey -> deleteUrl
const objectHashCache = new Map(); // key: provider+":"+objectKey -> hash (for SM.MS)

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
  delete process.env.HTTPS_PROXY;
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
app.commandLine.appendSwitch('no-proxy-server');

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
    
    const https = require('https');
    const postData = JSON.stringify(analyticsData);
    
    // 解析URL获取hostname和path
    const url = new URL(ANALYTICS_CONFIG.API_URL);
    
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
    
    // 重试机制
    let lastError;
    for (let attempt = 1; attempt <= ANALYTICS_CONFIG.RETRY_COUNT; attempt++) {
      try {
        const result = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
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
          await new Promise(resolve => setTimeout(resolve, ANALYTICS_CONFIG.RETRY_DELAY));
        }
      } catch (error) {
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
    }
  }
}

// 发送使用统计
async function sendUsageAnalytics() {
  const success = await sendAnalytics('usage', {
    sessionId: uuidv4(),
    uptime: process.uptime()
  });
  
  if (success) {
    console.log('[Analytics] 使用统计已发送');
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
    } else if (storage.type === 'cos') {
      const fileSize = fs.statSync(filePath).size;
      let uploadedSize = 0;
      
      const uploadTask = executeWithoutProxy(() => {
        return new Promise((resolve, reject) => {
          storage.client.sliceUploadFile({
            Bucket: storage.bucket,
            Region: storage.region,
            Key: key,
            FilePath: filePath,
            onProgress: (progressData) => {
              uploadedSize = progressData.loaded;
              const percentage = Math.round((progressData.loaded / progressData.total) * 100);
              mainWindow.webContents.send('upload-progress', { 
                key, 
                percentage,
                filePath,
              });
            },
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      });
      
      // Store upload task for cancellation
      activeUploads.set(key, { cancel: () => { /* COS SDK doesn't provide direct cancel */ } });
      
      await uploadTask;
      mainWindow.webContents.send('upload-progress', { key, percentage: 100, filePath });
      addRecentActivity('upload', `文件 ${key} 上传成功。`, 'success');
    } else if (storage.type === 'smms') {
      // SM.MS 图床上传
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = key.split('/').pop();
        const FormData = require('form-data');
        const form = new FormData();
        form.append('smfile', fileBuffer, { filename: fileName, contentType: 'application/octet-stream' });
        
        // 获取 SM.MS API Token
        const active = getActiveProfile();
        const apiToken = active?.smmsToken;
        
        if (!apiToken) {
          throw new Error('SM.MS API Token 未配置');
        }
        
        // 发送请求到 SM.MS API
        const https = require('https');
        const response = await executeWithoutProxy(() => new Promise((resolve, reject) => {
          const options = {
            hostname: 'sm.ms',
            port: 443,
            path: '/api/v2/upload',
            method: 'POST',
            headers: {
              ...form.getHeaders(),
              'Authorization': apiToken?.startsWith('Basic ') ? apiToken : `Basic ${apiToken}`,
              'Accept': 'application/json',
              'Accept-Encoding': 'identity',
              'User-Agent': 'R2APP/4.1'
            }
          };
          
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const result = JSON.parse(data);
                resolve(result);
              } catch (e) {
                reject(new Error('解析响应失败'));
              }
            });
          });
          
          req.on('error', (err) => {
            reject(err);
          });
          
          form.pipe(req);
        }));
        
        if (response.success) {
          // 上传成功，发送图片URL
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
    } else if (storage.type === 'picui') {
      // PICUI 图床上传（参考文档 https://picui.cn/page/api-docs.html ）
      try {
        const FormData = require('form-data');
        const form = new FormData();
        const fileName = key.split('/').pop();
        form.append('file', fs.createReadStream(filePath), fileName);

        const active = getActiveProfile();
        const token = active?.picuiToken?.startsWith('Bearer ') ? active.picuiToken : `Bearer ${active?.picuiToken || ''}`;
        const permission = active?.permission ?? 1;
        const strategyId = active?.strategyId;
        const albumId = active?.albumId;
        form.append('permission', String(permission));
        if (strategyId) form.append('strategy_id', String(strategyId));
        if (albumId) form.append('album_id', String(albumId));

        const https = require('https');
        const response = await executeWithoutProxy(() => new Promise((resolve, reject) => {
          const options = {
            hostname: 'picui.cn',
            port: 443,
            path: '/api/v1/upload',
            method: 'POST',
            headers: {
              ...form.getHeaders(),
              'Authorization': token,
              'Accept': 'application/json'
            }
          };
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('解析响应失败')); }
            });
          });
          req.on('error', reject);
          form.pipe(req);
        }));

        if (response.status) {
          mainWindow.webContents.send('upload-progress', { 
            key,
            percentage: 100,
            filePath,
            imageUrl: response.data?.url,
            deleteUrl: response.data?.delete_url
          });
          try {
            objectUrlCache.set(`picui:${key}`, response.data?.url);
            if (response.data?.delete_url) objectDeleteUrlCache.set(`picui:${key}`, response.data?.delete_url);
          } catch {}
          addRecentActivity('upload', `图片 ${key} 已上传到 PICUI，URL: ${response.data?.url}`, 'success');
        } else {
          throw new Error(response.message || 'PICUI 上传失败');
        }
      } catch (error) {
        console.error(`PICUI upload failed for ${key}:`, error);
        mainWindow.webContents.send('upload-progress', { key, error: error.message, filePath });
        addRecentActivity('upload', `图片 ${key} 上传到 PICUI 失败: ${error.message}`, 'error');
      }
    } else if (storage.type === 'smms') {
      // 读取上传历史作为文件列表
      const https = require('https');
      const token = (getActiveProfile().smmsToken?.startsWith('Basic ') ? getActiveProfile().smmsToken : `Basic ${getActiveProfile().smmsToken}`);
      const doFetch = (host) => new Promise((resolve, reject) => {
        const options = {
          hostname: host,
          port: 443,
          path: '/api/v2/upload_history',
          method: 'GET',
          headers: {
            'Authorization': token,
            'User-Agent': 'R2APP/4.1',
            'Content-Type': 'multipart/form-data',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Host': host
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (c) => data += c);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve({ __status: res.statusCode, __headers: res.headers, __raw: data }); }
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
      rawFiles = items.map(it => ({
        Key: it.filename || it.storename || it.path || it.hash,
        LastModified: it.created_at || new Date().toISOString(),
        Size: Number(it.size || 0),
        ETag: it.hash,
        publicUrl: it.url
      }));
      folders = [];
      nextContinuationToken = null;
    } else if (storage.type === 'picui') {
      // 读取图片列表
      const https = require('https');
      const resp = await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = {
          hostname: 'picui.cn',
          port: 443,
          path: '/api/v1/images?page=1&order=newest&permission=public',
          method: 'GET',
          headers: {
            'Authorization': (getActiveProfile().picuiToken?.startsWith('Bearer ') ? getActiveProfile().picuiToken : `Bearer ${getActiveProfile().picuiToken}`),
            'Accept': 'application/json'
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (c) => data += c);
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
        });
        req.on('error', reject);
        req.end();
      }));
      const arr = (resp && resp.status && Array.isArray(resp.data?.data)) ? resp.data.data : [];
      rawFiles = arr.map(it => ({
        Key: it.pathname || it.md5,
        LastModified: it.date,
        Size: Math.round(Number(it.size || 0) * 1024),
        ETag: it.md5,
        publicUrl: it.links?.url || it.url
      }));
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

function createPreviewWindow(fileName, filePath, bucket, publicUrl) {
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

app.whenReady().then(async () => {
  // 设置直连，禁用所有代理
  await session.defaultSession.setProxy({ proxyRules: 'direct://' });
  
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

  // 发送用户统计
  try {
    // 检查并发送安装统计
    await checkAndSendInstallAnalytics();
    
    // 发送使用统计
    await sendUsageAnalytics();
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
  } else if (profile.type === 'cos') {
    if (!profile.secretId || !profile.secretKey || !profile.bucket || !profile.region) {
      return { success: false, error: '缺少 COS 配置信息。' };
    }
    
    try {
      const cosClient = createCOSClient(profile.secretId, profile.secretKey);
      
      // 测试连接
      await executeWithoutProxy(() => {
        return new Promise((resolve, reject) => {
          cosClient.headBucket({
            Bucket: profile.bucket,
            Region: profile.region,
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      });
      
      return { success: true, message: 'COS 连接成功！' };
    } catch (error) {
      console.error('COS connection error details:', error);
      return { success: false, error: `COS 连接失败: ${error.message}` };
    }
  } else if (profile.type === 'smms') {
    if (!profile.smmsToken) {
      return { success: false, error: '缺少 SM.MS Token' };
    }
    
    try {
      // 测试 SM.MS API 连接
      const https = require('https');
      const response = await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = {
          hostname: 'sm.ms',
          port: 443,
          path: '/api/v2/upload_history',
          method: 'GET',
          headers: {
            'Authorization': profile.smmsToken?.startsWith('Basic ') ? profile.smmsToken : `Basic ${profile.smmsToken}`,
            'Accept': 'application/json',
            'Accept-Encoding': 'identity',
            'User-Agent': 'R2APP/4.1'
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve(result);
            } catch (e) {
              const preview = (data || '').slice(0, 200);
              console.error('SM.MS non-JSON response:', { statusCode: res.statusCode, headers: res.headers, preview });
              resolve({ __nonJson: true, statusCode: res.statusCode, headers: res.headers, preview });
            }
          });
        });
        req.on('error', reject);
        req.end();
      }));
      
      if (response && response.__nonJson) {
        return { success: false, error: `SM.MS 响应非 JSON，状态 ${response.statusCode || '未知'}` };
      }
      if (response && (response.success || response.code === 'success')) {
        return { success: true, message: `SM.MS 连接成功！用户名: ${response.data.username}` };
      } else {
        throw new Error(response.message || 'SM.MS 连接失败');
      }
    } catch (error) {
      console.error('SM.MS connection error details:', error);
      return { success: false, error: `SM.MS 连接失败: ${error.message}` };
    }
  } else if (profile.type === 'picui') {
    if (!profile.picuiToken) {
      return { success: false, error: '缺少 PICUI Token' };
    }
    // 用 profile 校验
    try {
      const https = require('https');
      const tokenHeader = profile.picuiToken?.startsWith('Bearer ') ? profile.picuiToken : `Bearer ${profile.picuiToken}`;
      const response = await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = {
          hostname: 'picui.cn',
          port: 443,
          path: '/api/v1/profile',
          method: 'GET',
          headers: {
            'Authorization': tokenHeader,
            'Accept': 'application/json'
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('解析响应失败')); } });
        });
        req.on('error', reject);
        req.end();
      }));
      if (response.status) {
        return { success: true, message: 'PICUI 连接成功！' };
      }
      return { success: false, error: response.message || 'PICUI 连接失败' };
    } catch (error) {
      return { success: false, error: `PICUI 连接失败: ${error.message}` };
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
    } else if (profile.type === 'cos') {
        if (!profile.secretId || !profile.secretKey || !profile.bucket || !profile.region) return null;
        return {
            client: createCOSClient(profile.secretId, profile.secretKey),
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
    } else if (profile.type === 'picui') {
        if (!profile.picuiToken) return null;
        return {
            client: null,
            type: 'picui',
            bucket: 'picui',
            token: profile.picuiToken,
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
    } else if (storage.type === 'cos') {
      do {
        const response = await executeWithoutProxy(() => {
          return new Promise((resolve, reject) => {
            storage.client.getBucket({
              Bucket: storage.bucket,
              Region: storage.region,
              Marker: continuationToken,
              MaxKeys: 1000,
            }, (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          });
        });
        totalCount += response.Contents?.length || 0;
        totalSize += response.Contents?.reduce((acc, obj) => acc + parseInt(obj.Size), 0) || 0;
        continuationToken = response.IsTruncated ? response.NextMarker : null;
      } while (continuationToken);
    } else if (storage.type === 'smms') {
      // 使用 profile 获取统计（包含图片数量和已使用容量）
      const https = require('https');
      const response = await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = {
          hostname: 'sm.ms',
          port: 443,
          path: '/api/v2/profile',
          method: 'GET',
          headers: {
            'Authorization': activeProfile.smmsToken?.startsWith('Basic ') ? activeProfile.smmsToken : `Basic ${activeProfile.smmsToken}`,
            'Accept': 'application/json',
            'Accept-Encoding': 'identity',
            'User-Agent': 'R2APP/4.1'
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve({}); }
          });
        });
        req.on('error', reject);
        req.end();
      }));
      if (response && (response.success || response.code === 'success') && response.data) {
        totalCount = Number(response.data.image_num || 0);
        // SM.MS 返回 size 单位可能为 MB，按 MB->bytes 估算
        const usedMb = Number(response.data.size || 0);
        totalSize = Math.round(usedMb * 1024 * 1024);
      } else {
        // 退化：用上传历史条数作为数量
        const listResp = await executeWithoutProxy(() => new Promise((resolve, reject) => {
          const options = {
            hostname: 'sm.ms',
            port: 443,
            path: '/api/v2/upload_history',
            method: 'GET',
            headers: {
              'Authorization': activeProfile.smmsToken?.startsWith('Basic ') ? activeProfile.smmsToken : `Basic ${activeProfile.smmsToken}`,
              'Accept': 'application/json',
              'Accept-Encoding': 'identity',
              'User-Agent': 'R2APP/4.1'
            }
          };
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
          });
          req.on('error', reject);
          req.end();
        }));
        const items = Array.isArray(listResp?.data) ? listResp.data : [];
        totalCount = items.length;
      }
    } else if (storage.type === 'picui') {
      // PICUI: 用 /images 的 total 作为数量，size 粗略估算
      const https = require('https');
      const response = await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = {
          hostname: 'picui.cn',
          port: 443,
          path: '/api/v1/images?page=1&order=newest&permission=public',
          method: 'GET',
          headers: {
            'Authorization': activeProfile.picuiToken?.startsWith('Bearer ') ? activeProfile.picuiToken : `Bearer ${activeProfile.picuiToken}`,
            'Accept': 'application/json'
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (c) => data += c);
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
        });
        req.on('error', reject);
        req.end();
      }));
      if (response && response.status && response.data) {
        totalCount = Number(response.data.total || 0);
        const arr = Array.isArray(response.data.data) ? response.data.data : [];
        // 文档 size 单位为 KB
        totalSize = arr.reduce((acc, it) => acc + Math.round(Number(it.size || 0) * 1024), 0);
      }
    } else if (storage.type === 'smms') {
      // SM.MS 统计：通过 upload_history 获取
      const https = require('https');
      const response = await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = {
          hostname: 'sm.ms',
          port: 443,
          path: '/api/v2/upload_history',
          method: 'GET',
          headers: {
            'Authorization': activeProfile.smmsToken?.startsWith('Basic ') ? activeProfile.smmsToken : `Basic ${activeProfile.smmsToken}`,
            'Accept': 'application/json',
            'Accept-Encoding': 'identity',
            'User-Agent': 'R2APP/4.1'
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
        });
        req.on('error', reject);
        req.end();
      }));
      const items = Array.isArray(response?.data) ? response.data : [];
      totalCount = items.length;
      totalSize = items.reduce((acc, item) => acc + (Number(item.size) || 0), 0);
    } else if (storage.type === 'picui') {
      // PICUI 统计：通过 images API 获取
      const https = require('https');
      const response = await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = {
          hostname: 'picui.cn',
          port: 443,
          path: '/api/v1/images?page=1&order=newest&permission=public',
          method: 'GET',
          headers: {
            'Authorization': activeProfile.picuiToken?.startsWith('Bearer ') ? activeProfile.picuiToken : `Bearer ${activeProfile.picuiToken}`,
            'Accept': 'application/json'
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
        });
        req.on('error', reject);
        req.end();
      }));
      if (response && response.status && response.data) {
        totalCount = Number(response.data.total || 0);
        const arr = Array.isArray(response.data.data) ? response.data.data : [];
        totalSize = arr.reduce((acc, it) => acc + Math.round(Number(it.size || 0) * 1024), 0);
      }
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
    } else if (storage.type === 'cos') {
      const response = await executeWithoutProxy(() => {
        return new Promise((resolve, reject) => {
          storage.client.getBucket({
            Bucket: storage.bucket,
            Region: storage.region,
            Marker: continuationToken,
            Prefix: apiPrefix,
            Delimiter: apiDelimiter,
            MaxKeys: 100,
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      });
      rawFiles = (response.Contents || []).map(f => ({ 
        Key: f.Key, 
        LastModified: f.LastModified, 
        Size: parseInt(f.Size), 
        ETag: f.ETag 
      }));
      folders = (response.CommonPrefixes || []).map(p => ({ key: p.Prefix, isFolder: true }));
      nextContinuationToken = response.IsTruncated ? response.NextMarker : null;
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

    } else if (storage.type === 'picui') {
      // PICUI: 列出图片
      const https = require('https');
      const active = getActiveProfile();
      const bearer = active?.picuiToken?.startsWith('Bearer ') ? active.picuiToken : `Bearer ${active?.picuiToken || ''}`;
      const resp = await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = {
          hostname: 'picui.cn',
          port: 443,
          path: '/api/v1/images?page=1&order=newest&permission=public',
          method: 'GET',
          headers: {
            Authorization: bearer,
            Accept: 'application/json',
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
              resolve({});
            }
          });
        });
        req.on('error', reject);
        req.end();
      }));
      const arr = resp && resp.status && Array.isArray(resp.data?.data) ? resp.data.data : [];
      rawFiles = arr.map((it) => {
        // 使用 key 作为主要标识符，pathname 作为显示名称
        const objectKey = it.key || it.pathname || it.md5;
        const fileData = {
          Key: objectKey,
          LastModified: it.date,
          Size: Math.round(Number(it.size || 0) * 1024),
          ETag: it.md5,
          publicUrl: it.links?.url || it.url,
          deleteUrl: it.delete_url || it.links?.delete_url,
          // 保存实际的 key 用于删除
          picuiKey: it.key,
          pathname: it.pathname, // 用于显示
        };
        
        // 缓存 URL 用于下载和删除
        try {
          objectUrlCache.set(`picui:${objectKey}`, fileData.publicUrl);
          if (fileData.deleteUrl) objectDeleteUrlCache.set(`picui:${objectKey}`, fileData.deleteUrl);
          // 缓存真实的 key 用于删除
          if (it.key) objectHashCache.set(`picui:${objectKey}`, it.key);
        } catch {}
        
        return fileData;
      });
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
      const command = new DeleteObjectCommand({ Bucket: storage.bucket, Key: key });
      await storage.client.send(command);
    } else if (storage.type === 'oss') {
      await storage.client.delete(key);
    } else if (storage.type === 'cos') {
      await executeWithoutProxy(() => {
        return new Promise((resolve, reject) => {
          storage.client.deleteObject({
            Bucket: storage.bucket,
            Region: storage.region,
            Key: key,
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      });
    } else if (storage.type === 'smms') {
      // SM.MS 删除：GET /api/v2/delete/:hash
      const https = require('https');
      const activeProfile = getActiveProfile();
      const token = activeProfile?.smmsToken?.startsWith('Basic ') ? activeProfile.smmsToken : `Basic ${activeProfile?.smmsToken || ''}`;
      
      // 尝试从缓存中取 hash；如无，则回退从 upload_history 查找
      let hash = objectHashCache.get(`smms:${key}`);
      if (!hash) {
        const list = await executeWithoutProxy(() => new Promise((resolve, reject) => {
          const options = { 
            hostname: 'sm.ms', 
            port: 443, 
            path: '/api/v2/upload_history', 
            method: 'GET', 
            headers: { 
              'Authorization': token, 
              'Accept': 'application/json',
              'Accept-Encoding': 'identity',
              'User-Agent': 'R2APP/4.1' 
            } 
          };
          const req = https.request(options, (res) => { 
            let data=''; 
            res.on('data', c => data+=c); 
            res.on('end', () => { 
              try { resolve(JSON.parse(data)); } catch { resolve({}); } 
            }); 
          });
          req.on('error', reject); 
          req.end();
        }));
        const items = Array.isArray(list?.data) ? list.data : [];
        const found = items.find(it => (it.filename === key || it.storename === key || it.path === key || it.hash === key));
        if (found) hash = found.hash;
      }
      
      if (!hash) {
        throw new Error('未找到删除哈希');
      }
      
      console.log(`[SMMS DELETE] Attempting to delete hash: ${hash} for key: ${key}`);
      await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = { 
          hostname: 'sm.ms', 
          port: 443, 
          path: `/delete/${encodeURIComponent(hash)}?format=json`, 
          method: 'GET', 
          headers: { 
            'Authorization': token, 
            'Accept': 'application/json',
            'User-Agent': 'R2APP/4.1' 
          } 
        };
        console.log(`[SMMS DELETE] Request: GET https://sm.ms/delete/${hash}?format=json`);
        const req = https.request(options, (res) => { 
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            console.log(`[SMMS DELETE] Response status: ${res.statusCode}, data: ${data.substring(0, 200)}...`);
            
            // SM.MS 删除成功时返回 HTML 页面而不是 JSON
            if (res.statusCode === 200) {
              if (data.includes('File is deleted') || data.includes('File Delete')) {
                console.log(`[SMMS DELETE] Delete successful for ${key} (HTML response)`);
                // 清理缓存
                objectHashCache.delete(`smms:${key}`);
                objectUrlCache.delete(`smms:${key}`);
                objectDeleteUrlCache.delete(`smms:${key}`);
                resolve(true);
                return;
              }
            }
            
            // 尝试解析 JSON 响应
            try {
              const response = JSON.parse(data);
              if (response.success) {
                console.log(`[SMMS DELETE] Delete successful for ${key} (JSON response)`);
                // 清理缓存
                objectHashCache.delete(`smms:${key}`);
                objectUrlCache.delete(`smms:${key}`);
                objectDeleteUrlCache.delete(`smms:${key}`);
                resolve(true);
              } else {
                console.log(`[SMMS DELETE] Delete failed: ${response.message}`);
                reject(new Error(response.message || 'SM.MS 删除失败'));
              }
            } catch (e) {
              console.log(`[SMMS DELETE] Non-JSON response, status: ${res.statusCode}`);
              reject(new Error(`SM.MS 删除失败: ${res.statusCode}`));
            }
          });
        });
        req.on('error', (err) => {
          console.log(`[SMMS DELETE] Request error: ${err.message}`);
          reject(err);
        }); 
        req.end();
      }));
    } else if (storage.type === 'picui') {
      // PICUI 删除：DELETE /images/:key
      const https = require('https');
      const activeProfile = getActiveProfile();
      const token = activeProfile?.picuiToken?.startsWith('Bearer ') ? activeProfile.picuiToken : `Bearer ${activeProfile?.picuiToken || ''}`;
      
      // 尝试从缓存获取真实的 key，如果没有则使用传入的 key
      let picuiKey = objectHashCache.get(`picui:${key}`) || key;
      
      console.log(`[PICUI DELETE] Attempting to delete key: ${key}, picuiKey: ${picuiKey}`);
      await executeWithoutProxy(() => new Promise((resolve, reject) => {
        const options = { 
          hostname: 'picui.cn', 
          port: 443, 
          path: `/api/v1/images/${encodeURIComponent(picuiKey)}`, 
          method: 'DELETE', 
          headers: { 
            'Authorization': token, 
            'Accept': 'application/json'
          } 
        };
        console.log(`[PICUI DELETE] Request: DELETE https://picui.cn/api/v1/images/${picuiKey}`);
        const req = https.request(options, (res) => { 
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            console.log(`[PICUI DELETE] Response status: ${res.statusCode}, data: ${data.substring(0, 200)}...`);
            
            if (res.statusCode === 200 || res.statusCode === 204) {
              // 200 或 204 状态码表示删除成功
              console.log(`[PICUI DELETE] Delete successful for ${key} (status: ${res.statusCode})`);
              // 清理缓存
              objectUrlCache.delete(`picui:${key}`);
              objectDeleteUrlCache.delete(`picui:${key}`);
              objectHashCache.delete(`picui:${key}`);
              resolve(true);
              return;
            }
            
            try {
              const response = JSON.parse(data);
              if (response.status) {
                console.log(`[PICUI DELETE] Delete successful for ${key} (JSON response)`);
                // 清理缓存
                objectUrlCache.delete(`picui:${key}`);
                objectDeleteUrlCache.delete(`picui:${key}`);
                objectHashCache.delete(`picui:${key}`);
                resolve(true);
              } else {
                console.log(`[PICUI DELETE] Delete failed: ${response.message}`);
                reject(new Error(response.message || 'PICUI 删除失败'));
              }
            } catch (e) {
              console.log(`[PICUI DELETE] Non-JSON response, status: ${res.statusCode}`);
              reject(new Error(`PICUI 删除失败: ${res.statusCode}`));
            }
          });
        });
        req.on('error', (err) => {
          console.log(`[PICUI DELETE] Request error: ${err.message}`);
          reject(err);
        }); 
        req.end();
      }));
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
    } else if (type === 'cos') {
      let continuationToken;
      do {
        const response = await executeWithoutProxy(() => {
          return new Promise((resolve, reject) => {
            client.getBucket({
              Bucket: bucket,
              Region: storage.region,
              Prefix: prefix,
              Marker: continuationToken,
              MaxKeys: 1000,
            }, (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          });
        });
        if (response.Contents) {
          allKeys.push(...response.Contents.map(item => ({ Key: item.Key })));
        }
        continuationToken = response.IsTruncated ? response.NextMarker : null;
      } while (continuationToken);

      if (allKeys.length > 0) {
        // COS 批量删除
        for (let i = 0; i < allKeys.length; i += 1000) {
          const chunk = allKeys.slice(i, i + 1000);
          await executeWithoutProxy(() => {
            return new Promise((resolve, reject) => {
              client.deleteMultipleObject({
                Bucket: bucket,
                Region: storage.region,
                Objects: chunk,
              }, (err, data) => {
                if (err) reject(err);
                else resolve(data);
              });
            });
          });
        }
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
      await executeWithoutProxy(() => {
        return new Promise((resolve, reject) => {
          client.putObject({
            Bucket: bucket,
            Region: storage.region,
            Key: folderName,
            Body: '',
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      });
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
    } else if (type === 'cos') {
      const response = await executeWithoutProxy(() => {
        return new Promise((resolve, reject) => {
          client.getObject({
            Bucket: clientBucket,
            Region: storage.region,
            Key: key,
          }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      });
      
      if (response.ContentLength > PREVIEW_FILE_SIZE_LIMIT) {
        fileTooLarge = true;
      } else {
        content = response.Body.toString('utf-8');
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
   
   // 处理包含路径分隔符的 key（如 PICUI 的 2025/08/17/filename.png）
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
     } else if (storage.type === 'cos') {
         await executeWithoutProxy(() => {
           return new Promise((resolve, reject) => {
             storage.client.getObject({
               Bucket: storage.bucket,
               Region: storage.region,
               Key: key,
               Output: fs.createWriteStream(filePath),
               onProgress: (progressData) => {
                 const progress = Math.round((progressData.loaded / progressData.total) * 100);
                 mainWindow.webContents.send('download-update', { 
                   type: 'progress', 
                   data: { id: taskId, progress } 
                 });
               },
             }, (err, data) => {
               if (err) {
                 reject(err);
               } else {
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
                 resolve(data);
               }
             });
           });
         });
     } else if (storage.type === 'smms' || storage.type === 'picui') {
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
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      // The URL will be valid for 15 minutes.
      url = await getSignedUrl(storage.client, command, { expiresIn: 900 });
    } else if (storage.type === 'oss') {
      // The URL will be valid for 15 minutes.
      url = storage.client.signatureUrl(key, { expires: 900 });
    } else if (storage.type === 'cos') {
      // COS 获取预签名URL
      url = await executeWithoutProxy(() => {
        return new Promise((resolve) => {
          storage.client.getObjectUrl({
            Bucket: storage.bucket,
            Region: storage.region,
            Key: key,
            Sign: true,
            Expires: 900, // 15分钟
          }, (err, data) => {
            if (err) {
              console.error('COS getObjectUrl error:', err);
              resolve(null);
            } else {
              resolve(data.Url);
            }
          });
        });
      });
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
      } else if (storage.type === 'cos') {
        const cosResponse = await executeWithoutProxy(() => {
          return new Promise((resolve, reject) => {
            storage.client.getBucket({
              Bucket: storage.bucket,
              Region: storage.region,
              Marker: continuationToken,
              MaxKeys: 1000,
            }, (err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          });
        });
        response = { 
          Contents: (cosResponse.Contents || []).map(f => ({ 
            Key: f.Key, 
            LastModified: f.LastModified, 
            Size: parseInt(f.Size), 
            ETag: f.ETag 
          })),
          NextContinuationToken: cosResponse.IsTruncated ? cosResponse.NextMarker : null
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
      const cosClient = createCOSClient(profile.secretId, profile.secretKey);
      
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