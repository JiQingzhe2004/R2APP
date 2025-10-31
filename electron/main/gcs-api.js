import fs from 'fs';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import { getGCSProxyConfig, createProxyAgent } from './proxy-config.js';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { bootstrap as bootstrapGlobalAgent } from 'global-agent';

/**
 * Google Cloud API模块
 */

class GCSAPI {
  constructor(config) {
    // 支持两种认证方式：
    // 1. 直接传入 credentials 对象
    // 2. 传入 keyFilename 路径
    const storageConfig = {
      projectId: config.projectId,
    };

    if (config.keyFilename) {
      storageConfig.keyFilename = config.keyFilename;
    } else if (config.credentials) {
      // credentials 可以是 JSON 对象或 JSON 字符串
      const credentials = typeof config.credentials === 'string' 
        ? JSON.parse(config.credentials) 
        : config.credentials;
      storageConfig.credentials = credentials;
    }

    // 添加代理支持 - 使用全局代理配置
    if (config.proxyConfig && config.proxyConfig.enabled) {
      console.log('[GCS API] Configuring proxy for GCS requests...');
      
      // 获取代理配置
      const proxyConfig = getGCSProxyConfig(config.proxyConfig);
      if (proxyConfig && proxyConfig.url) {
        // 方法1: 设置环境变量（Google Auth Library 会读取）
        process.env.HTTPS_PROXY = proxyConfig.url;
        process.env.HTTP_PROXY = proxyConfig.url;
        process.env.https_proxy = proxyConfig.url;
        process.env.http_proxy = proxyConfig.url;
        process.env.GLOBAL_AGENT_HTTPS_PROXY = proxyConfig.url;
        process.env.GLOBAL_AGENT_HTTP_PROXY = proxyConfig.url;
        
        // 确保不绕过代理
        delete process.env.NO_PROXY;
        delete process.env.no_proxy;
        delete process.env.GLOBAL_AGENT_NO_PROXY;
        
        console.log('[GCS API] Environment proxy set:', proxyConfig.url.replace(/:[^:@]+@/, ':****@'));
        console.log('[GCS API] Verifying HTTPS_PROXY =', process.env.HTTPS_PROXY);
        
        // 方法2: 使用 global-agent 全局代理（最可靠）
        try {
          // Bootstrap global agent 会拦截所有 http/https 请求
          bootstrapGlobalAgent();
          console.log('[GCS API] Global proxy agent bootstrapped');
        } catch (error) {
          console.warn('[GCS API] Failed to bootstrap global agent:', error.message);
        }
        
        // 方法3: 创建代理 agent 供手动使用
        const proxyAgent = createProxyAgent(config.proxyConfig);
        if (proxyAgent) {
          this.proxyAgent = proxyAgent;
          console.log('[GCS API] Proxy agent created for manual use');
        }
      }
    } else {
      // 如果没有启用代理，清除所有代理环境变量
      delete process.env.HTTPS_PROXY;
      delete process.env.HTTP_PROXY;
      delete process.env.https_proxy;
      delete process.env.http_proxy;
      delete process.env.GLOBAL_AGENT_HTTPS_PROXY;
      delete process.env.GLOBAL_AGENT_HTTP_PROXY;
      console.log('[GCS API] Proxy disabled, environment variables cleared');
    }

    try {
      this.client = new Storage(storageConfig);
      console.log('[GCS API] Storage client created successfully');
    } catch (error) {
      console.error('[GCS API] Failed to create Storage client:', error);
      throw error;
    }
    
    this.bucket = config.bucketName;
    this.publicDomain = config.publicDomain; // 自定义域名配置
    this.projectId = config.projectId;
    this.proxyConfig = config.proxyConfig; // 保存代理配置
  }

  /**
   * 获取文件的公共访问URL
   */
  getPublicUrl(key) {
    if (this.publicDomain) {
      let domain = this.publicDomain;
      if (domain.endsWith('/')) {
        domain = domain.slice(0, -1);
      }
      if (!/^(https?:\/\/)/i.test(domain)) {
        domain = `https://${domain}`;
      }
      return `${domain}/${key}`;
    }
    return `https://storage.googleapis.com/${this.bucket}/${key}`;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      console.log('[GCS API] Testing connection...');
      console.log('[GCS API] Proxy config enabled:', this.proxyConfig?.enabled);
      console.log('[GCS API] Environment HTTPS_PROXY:', process.env.HTTPS_PROXY ? 'SET' : 'NOT SET');
      
      const bucket = this.client.bucket(this.bucket);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        return { success: false, error: `存储桶 ${this.bucket} 不存在或无权访问` };
      }
      
      console.log('[GCS API] Connection test successful');
      return { success: true, message: 'GCS 连接成功！' };
    } catch (error) {
      console.error('[GCS API] Connection test failed:', error);
      console.error('[GCS API] Error details:', {
        message: error.message,
        code: error.code,
        status: error.status
      });
      
      // 提供更友好的错误信息
      let errorMessage = error.message;
      if (error.message && error.message.includes('oauth2')) {
        errorMessage = '无法连接到 Google API，请检查代理配置是否正确';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        errorMessage = '网络连接失败，请检查代理配置';
      }
      
      return { success: false, error: `GCS 连接失败: ${errorMessage}` };
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filePath, key, onProgress) {
    try {
      console.log(`[GCS API] Uploading file: ${filePath} to ${key}`);
      
      const bucket = this.client.bucket(this.bucket);
      const file = bucket.file(key);
      
      const fileSize = fs.statSync(filePath).size;
      let uploadedBytes = 0;

      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(filePath);
        const writeStream = file.createWriteStream({
          resumable: true,
          metadata: {
            contentType: this.getContentType(filePath),
          },
        });

        readStream.on('data', (chunk) => {
          uploadedBytes += chunk.length;
          if (onProgress && fileSize > 0) {
            const percentage = Math.round((uploadedBytes / fileSize) * 100);
            onProgress(percentage, uploadedBytes, fileSize);
          }
        });

        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        readStream.pipe(writeStream);
      });

      console.log(`[GCS API] Upload completed: ${key}`);
      
      return {
        success: true,
        data: {
          key: key,
          bucket: this.bucket,
          url: this.getPublicUrl(key)
        }
      };
    } catch (error) {
      console.error(`[GCS API] Upload failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(key, filePath, onProgress) {
    try {
      console.log(`[GCS API] Downloading file: ${key} to ${filePath}`);
      
      const bucket = this.client.bucket(this.bucket);
      const file = bucket.file(key);
      
      const [metadata] = await file.getMetadata();
      const totalSize = parseInt(metadata.size);
      let downloadedBytes = 0;
      let lastProgressTime = 0;
      let lastDownloaded = 0;

      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath);
        const readStream = file.createReadStream();

        readStream.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const progress = totalSize ? Math.round((downloadedBytes / totalSize) * 100) : 0;
          
          if (onProgress) {
            const now = Date.now();
            let speed = 0;
            if (now - lastProgressTime > 500) {
              const timeDiff = (now - lastProgressTime) / 1000;
              const bytesDiff = downloadedBytes - lastDownloaded;
              speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
              lastProgressTime = now;
              lastDownloaded = downloadedBytes;
            }
            onProgress(progress, downloadedBytes, totalSize, speed);
          }
        });

        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        readStream.pipe(writeStream);
      });

      console.log(`[GCS API] Download completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[GCS API] Download failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key) {
    try {
      console.log(`[GCS API] Deleting file: ${key}`);
      const bucket = this.client.bucket(this.bucket);
      await bucket.file(key).delete();
      console.log(`[GCS API] Delete completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[GCS API] Delete failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys) {
    try {
      console.log(`[GCS API] Batch deleting ${keys.length} files`);
      
      if (keys.length === 0) {
        return { success: true, deleted: [] };
      }

      const bucket = this.client.bucket(this.bucket);
      const deleted = [];
      
      // GCS 批量删除需要逐个处理
      for (const key of keys) {
        try {
          await bucket.file(key).delete();
          deleted.push(key);
        } catch (error) {
          console.error(`[GCS API] Failed to delete ${key}:`, error);
          // 继续删除其他文件
        }
      }
      
      console.log(`[GCS API] Batch delete completed: ${deleted.length} files deleted`);
      return { success: true, deleted };
    } catch (error) {
      console.error(`[GCS API] Batch delete failed:`, error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   */
  async listFiles(options = {}) {
    try {
      console.log(`[GCS API] Listing files with options:`, options);
      
      const {
        prefix = '',
        delimiter = undefined,
        continuationToken = undefined,
        maxKeys = 1000
      } = options;

      const bucket = this.client.bucket(this.bucket);
      const [files, , apiResponse] = await bucket.getFiles({
        prefix: prefix,
        delimiter: delimiter,
        pageToken: continuationToken,
        maxResults: maxKeys,
        autoPaginate: false,
      });

      const filesList = files.map(file => ({
        Key: file.name,
        LastModified: file.metadata.updated,
        Size: parseInt(file.metadata.size),
        ETag: file.metadata.etag,
        StorageClass: file.metadata.storageClass
      }));

      const folders = (apiResponse.prefixes || []).map(prefix => ({
        key: prefix,
        isFolder: true
      }));

      console.log(`[GCS API] List completed: ${filesList.length} files, ${folders.length} folders`);
      
      return {
        success: true,
        data: {
          files: filesList,
          folders,
          nextContinuationToken: apiResponse.nextPageToken,
          isTruncated: !!apiResponse.nextPageToken
        }
      };
    } catch (error) {
      console.error(`[GCS API] List files failed:`, error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      console.log('[GCS API] Getting storage stats...');
      
      let totalCount = 0;
      let totalSize = 0;
      let pageToken = undefined;

      const bucket = this.client.bucket(this.bucket);

      do {
        const [files, , apiResponse] = await bucket.getFiles({
          pageToken: pageToken,
          maxResults: 1000,
          autoPaginate: false,
        });

        totalCount += files.length;
        totalSize += files.reduce((acc, file) => acc + parseInt(file.metadata.size), 0);
        pageToken = apiResponse.nextPageToken;
      } while (pageToken);

      console.log(`[GCS API] Storage stats: ${totalCount} files, ${totalSize} bytes`);
      
      return {
        success: true,
        data: {
          totalCount,
          totalSize
        }
      };
    } catch (error) {
      console.error('[GCS API] Get storage stats failed:', error);
      throw error;
    }
  }

  /**
   * 获取预签名URL
   */
  async getPresignedUrl(key, expiresIn = 900) {
    try {
      console.log(`[GCS API] Getting presigned URL for: ${key}`);
      
      // 如果有自定义域名，直接返回公共URL
      if (this.publicDomain) {
        const url = this.getPublicUrl(key);
        console.log(`[GCS API] Using custom domain URL: ${url}`);
        return url;
      }
      
      // 生成签名URL
      const bucket = this.client.bucket(this.bucket);
      const file = bucket.file(key);
      
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });
      
      console.log(`[GCS API] Presigned URL generated for: ${key}`);
      return url;
    } catch (error) {
      console.error(`[GCS API] Get presigned URL failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(searchTerm, options = {}) {
    try {
      console.log(`[GCS API] Searching files with term: ${searchTerm}`);
      
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      let pageToken = undefined;
      const results = [];

      do {
        const response = await this.listFiles({
          ...options,
          continuationToken: pageToken
        });

        if (response.success) {
          const filteredFiles = response.data.files.filter(item => 
            item.Key.toLowerCase().includes(lowerCaseSearchTerm)
          );
          results.push(...filteredFiles);
          pageToken = response.data.nextContinuationToken;
        }
      } while (pageToken);

      console.log(`[GCS API] Search completed: ${results.length} results found`);
      
      return {
        success: true,
        data: {
          files: results,
          total: results.length
        }
      };
    } catch (error) {
      console.error(`[GCS API] Search files failed:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key) {
    try {
      console.log(`[GCS API] Checking if file exists: ${key}`);
      const bucket = this.client.bucket(this.bucket);
      const [exists] = await bucket.file(key).exists();
      console.log(`[GCS API] File ${exists ? 'exists' : 'does not exist'}: ${key}`);
      return exists;
    } catch (error) {
      console.error(`[GCS API] Check file exists failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key) {
    try {
      console.log(`[GCS API] Getting file info: ${key}`);
      const bucket = this.client.bucket(this.bucket);
      const file = bucket.file(key);
      const [metadata] = await file.getMetadata();
      
      const fileInfo = {
        Key: key,
        Size: parseInt(metadata.size),
        LastModified: metadata.updated,
        ETag: metadata.etag,
        ContentType: metadata.contentType,
        StorageClass: metadata.storageClass
      };

      console.log(`[GCS API] File info retrieved: ${key}`);
      return {
        success: true,
        data: fileInfo
      };
    } catch (error) {
      console.error(`[GCS API] Get file info failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件内容（用于预览）
   */
  async getFileContent(key, maxSize = 1024 * 1024) {
    try {
      console.log(`[GCS API] Getting file content for: ${key}`);
      
      const bucket = this.client.bucket(this.bucket);
      const file = bucket.file(key);
      const [metadata] = await file.getMetadata();
      
      // 检查文件大小
      const contentLength = parseInt(metadata.size);
      if (contentLength > maxSize) {
        return {
          success: true,
          data: {
            tooLarge: true,
            size: contentLength
          }
        };
      }

      // 下载文件内容
      const [contents] = await file.download();
      const content = contents.toString('utf-8');

      return {
        success: true,
        data: {
          content: content,
          size: contentLength,
          tooLarge: false
        }
      };
    } catch (error) {
      console.error(`[GCS API] Get file content failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件内容类型
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }
}

export default GCSAPI;

