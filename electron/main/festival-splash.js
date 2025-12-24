import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// 节日配置的远程URL（你可以替换为你的服务器地址）
const FESTIVAL_CONFIG_URL = process.env.FESTIVAL_CONFIG_URL || 'https://wpaiupload.aiqji.com/festival-config.json';

// 本地缓存目录
const CACHE_DIR = app.getPath('userData');
const FESTIVAL_CACHE_DIR = join(CACHE_DIR, 'festival-splash');
const CONFIG_CACHE_FILE = join(FESTIVAL_CACHE_DIR, 'festival-config.json');
const IMAGE_CACHE_DIR = join(FESTIVAL_CACHE_DIR, 'images');

// 确保缓存目录存在
function ensureCacheDir() {
  if (!fs.existsSync(FESTIVAL_CACHE_DIR)) {
    fs.mkdirSync(FESTIVAL_CACHE_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGE_CACHE_DIR)) {
    fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
  }
}

/**
 * 下载文件
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const file = fs.createWriteStream(destPath);
    
    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // 处理重定向
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`下载失败: ${response.statusCode}`));
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(destPath);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });
  });
}

/**
 * 从远程获取节日配置
 */
async function fetchFestivalConfig() {
  try {
    const configPath = join(FESTIVAL_CACHE_DIR, 'festival-config-temp.json');
    await downloadFile(FESTIVAL_CONFIG_URL, configPath);
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // 验证配置格式
    if (!Array.isArray(config.festivals)) {
      throw new Error('配置格式错误: festivals 必须是数组');
    }
    
    // 保存到正式缓存文件
    fs.writeFileSync(CONFIG_CACHE_FILE, configContent, 'utf-8');
    fs.unlinkSync(configPath);
    
    return config;
  } catch (error) {
    console.warn('[Festival Splash] 获取节日配置失败:', error.message);
    // 如果远程获取失败，尝试使用本地缓存
    if (fs.existsSync(CONFIG_CACHE_FILE)) {
      try {
        const cachedContent = fs.readFileSync(CONFIG_CACHE_FILE, 'utf-8');
        return JSON.parse(cachedContent);
      } catch (e) {
        console.warn('[Festival Splash] 读取缓存配置失败:', e.message);
      }
    }
    return null;
  }
}

/**
 * 检查日期是否在范围内
 */
function isDateInRange(date, startDate, endDate) {
  const checkDate = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // 设置时间为00:00:00以便比较
  checkDate.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  return checkDate >= start && checkDate <= end;
}

/**
 * 获取当前应该使用的节日配置
 */
function getCurrentFestival(config) {
  if (!config || !config.festivals) {
    return null;
  }
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // 查找匹配的节日
  for (const festival of config.festivals) {
    // 支持相对日期（如 "12-25" 表示每年12月25日）
    if (festival.startDate && festival.endDate) {
      let startDate = festival.startDate.trim();
      let endDate = festival.endDate.trim();
      
      // 如果日期格式是 MM-DD（只有2个部分），添加当前年份
      const startParts = startDate.split('-');
      const endParts = endDate.split('-');
      
      if (startParts.length === 2) {
        startDate = `${currentYear}-${startDate}`;
      }
      if (endParts.length === 2) {
        endDate = `${currentYear}-${endDate}`;
      }
      
      if (isDateInRange(now, startDate, endDate)) {
        return festival;
      }
    }
  }
  
  return null;
}

/**
 * 下载节日启动图
 */
async function downloadFestivalImage(imageUrl, festivalId) {
  try {
    const ext = imageUrl.split('.').pop().split('?')[0] || 'png';
    const imagePath = join(IMAGE_CACHE_DIR, `${festivalId}.${ext}`);
    
    // 如果图片已存在，检查是否需要更新
    if (fs.existsSync(imagePath)) {
      // 可以添加更智能的缓存策略，比如检查文件修改时间等
      // 这里简单返回已存在的路径
      return imagePath;
    }
    
    await downloadFile(imageUrl, imagePath);
    return imagePath;
  } catch (error) {
    console.warn('[Festival Splash] 下载节日启动图失败:', error.message);
    return null;
  }
}

/**
 * 获取当前应该使用的启动图路径
 * @returns {Promise<string|null>} 启动图路径，如果不是节日则返回null
 */
export async function getFestivalSplashImage() {
  try {
    ensureCacheDir();
    
    // 获取节日配置
    const config = await fetchFestivalConfig();
    if (!config) {
      return null;
    }
    
    // 检查当前是否有匹配的节日
    const festival = getCurrentFestival(config);
    if (!festival || !festival.imageUrl) {
      return null;
    }
    
    // 下载并缓存节日启动图
    const imagePath = await downloadFestivalImage(festival.imageUrl, festival.id || 'festival');
    return imagePath;
  } catch (error) {
    console.warn('[Festival Splash] 获取节日启动图失败:', error.message);
    return null;
  }
}

/**
 * 将图片转换为base64
 */
function imageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = imagePath.split('.').pop().toLowerCase();
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn('[Festival Splash] 无法加载图片:', error.message);
    return null;
  }
}

/**
 * 获取当前应该使用的Logo路径（复用启动图）
 * @returns {Promise<string|null>} Logo的base64数据URI，如果不是节日则返回null
 */
export async function getFestivalLogo() {
  try {
    const imagePath = await getFestivalSplashImage();
    if (!imagePath) {
      return null;
    }
    
    // 转换为 base64 数据 URI，供前端使用（避免 file:// 协议的安全问题）
    const base64 = imageToBase64(imagePath);
    return base64;
  } catch (error) {
    console.warn('[Festival Splash] 获取节日Logo失败:', error.message);
    return null;
  }
}

/**
 * 初始化节日启动图系统（在应用启动时调用）
 * 这个方法会在后台异步获取配置，不阻塞应用启动
 */
export function initFestivalSplash() {
  ensureCacheDir();
  
  // 异步获取配置，不阻塞启动
  fetchFestivalConfig().catch(err => {
    console.warn('[Festival Splash] 初始化失败:', err.message);
  });
}

/**
 * 清理过期的节日图片缓存
 */
export function cleanupFestivalCache() {
  try {
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      return;
    }
    
    const files = fs.readdirSync(IMAGE_CACHE_DIR);
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
    
    for (const file of files) {
      const filePath = join(IMAGE_CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`[Festival Splash] 清理过期缓存: ${file}`);
      }
    }
  } catch (error) {
    console.warn('[Festival Splash] 清理缓存失败:', error.message);
  }
}

