import fs from 'fs';
import qiniu from 'qiniu';
import https from 'https';
import http from 'http';

/**
 * 七牛云 Kodo API模块
 * 基于七牛云 Node.js SDK 实现
 */

class QiniuAPI {
  constructor(config) {
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.bucket = config.bucket;
    this.zone = config.zone || 'z0'; // 默认华东
    this.publicDomain = config.publicDomain; // 自定义域名配置
    this.isPrivate = config.isPrivate || false; // 是否为私有空间
    
    // 创建认证对象
    this.mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
    
    // 配置上传区域
    this.setZoneConfig(this.zone);
    
    console.log('[Qiniu API] Initialized with config:', {
      bucket: this.bucket,
      zone: this.zone,
      hasPublicDomain: !!this.publicDomain,
      isPrivate: this.isPrivate
    });
  }

  /**
   * 设置上传区域配置
   */
  setZoneConfig(zone) {
    const zoneMap = {
      'z0': qiniu.zone.Zone_z0, // 华东
      'z1': qiniu.zone.Zone_z1, // 华北
      'z2': qiniu.zone.Zone_z2, // 华南
      'na0': qiniu.zone.Zone_na0, // 北美
      'as0': qiniu.zone.Zone_as0, // 东南亚
    };
    
    this.zoneConfig = zoneMap[zone] || qiniu.zone.Zone_z0;
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
      // 对文件名进行 URL 编码，处理中文字符
      const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/');
      return `${domain}/${encodedKey}`;
    }
    
    // 如果没有自定义域名，返回空字符串（需要用户配置域名）
    return '';
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      console.log('[Qiniu API] Testing connection...');
      
      // 通过列举文件来测试连接
      const bucketManager = new qiniu.rs.BucketManager(this.mac, new qiniu.conf.Config());
      
      return new Promise((resolve, reject) => {
        bucketManager.listPrefix(this.bucket, {
          limit: 1
        }, (err, respBody, respInfo) => {
          if (err) {
            console.error('[Qiniu API] Connection test failed:', err);
            resolve({ success: false, error: `七牛云连接失败: ${err.message}` });
            return;
          }
          
          if (respInfo.statusCode === 200) {
            console.log('[Qiniu API] Connection test successful');
            resolve({ success: true, message: '七牛云 Kodo 连接成功！' });
          } else {
            console.error('[Qiniu API] Connection test failed:', respInfo.statusCode);
            resolve({ success: false, error: `七牛云连接失败: ${respBody.error || respInfo.statusCode}` });
          }
        });
      });
    } catch (error) {
      console.error('[Qiniu API] Connection test exception:', error);
      return { success: false, error: `七牛云连接失败: ${error.message}` };
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filePath, key, onProgress) {
    try {
      console.log(`[Qiniu API] Uploading file: ${filePath} to ${key}`);
      
      const options = {
        scope: this.bucket,
      };
      const putPolicy = new qiniu.rs.PutPolicy(options);
      const uploadToken = putPolicy.uploadToken(this.mac);
      
      const config = new qiniu.conf.Config();
      config.zone = this.zoneConfig;
      config.useHttpsDomain = true;
      config.useCdnDomain = false;
      
      const formUploader = new qiniu.form_up.FormUploader(config);
      const putExtra = new qiniu.form_up.PutExtra();
      
      // 获取文件大小
      const fileStats = fs.statSync(filePath);
      const fileSize = fileStats.size;
      
      return new Promise((resolve, reject) => {
        formUploader.putFile(uploadToken, key, filePath, putExtra, (err, respBody, respInfo) => {
          if (err) {
            console.error(`[Qiniu API] Upload failed for ${key}:`, err);
            reject(err);
            return;
          }
          
          if (respInfo.statusCode === 200) {
            console.log(`[Qiniu API] Upload completed: ${key}`);
            resolve({
              success: true,
              data: {
                key: respBody.key,
                hash: respBody.hash,
                bucket: this.bucket,
                url: this.getPublicUrl(respBody.key)
              }
            });
          } else {
            console.error(`[Qiniu API] Upload failed with status ${respInfo.statusCode}`);
            reject(new Error(`上传失败: ${respBody.error || respInfo.statusCode}`));
          }
        });
      });
    } catch (error) {
      console.error(`[Qiniu API] Upload exception for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(key, filePath, onProgress) {
    try {
      console.log(`[Qiniu API] Downloading file: ${key} to ${filePath}`);
      
      // 获取下载链接
      const downloadUrl = await this.getPresignedUrl(key, 3600);
      console.log(`[Qiniu API] Download URL: ${downloadUrl}`);
      
      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        const protocol = downloadUrl.startsWith('https') ? https : http;
        
        // 配置请求选项，忽略证书错误
        const options = new URL(downloadUrl);
        const requestOptions = {
          hostname: options.hostname,
          port: options.port,
          path: options.pathname + options.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          // 忽略证书错误
          rejectUnauthorized: false
        };
        
        const request = protocol.get(requestOptions, (response) => {
          // 处理重定向
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
            const redirectUrl = response.headers.location;
            console.log(`[Qiniu API] Following redirect to: ${redirectUrl}`);
            file.close();
            fs.unlink(filePath, () => {});
            
            // 递归调用以处理重定向
            this.downloadFile(key, filePath, onProgress).then(resolve).catch(reject);
            return;
          }
          
          if (response.statusCode !== 200) {
            file.close();
            fs.unlink(filePath, () => {});
            reject(new Error(`下载失败: HTTP ${response.statusCode}`));
            return;
          }
          
          const totalSize = parseInt(response.headers['content-length'] || '0');
          let downloadedSize = 0;
          
          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (onProgress && totalSize > 0) {
              const percentage = Math.round((downloadedSize / totalSize) * 100);
              onProgress(percentage, downloadedSize, totalSize);
            }
          });
          
          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            console.log(`[Qiniu API] Download completed: ${key}`);
            resolve({ success: true });
          });
          
          file.on('error', (err) => {
            console.error(`[Qiniu API] File write error:`, err);
            fs.unlink(filePath, () => {});
            reject(err);
          });
        });
        
        request.on('error', (err) => {
          console.error(`[Qiniu API] Request error:`, err);
          file.close();
          fs.unlink(filePath, () => {});
          reject(err);
        });
        
        request.end();
      });
    } catch (error) {
      console.error(`[Qiniu API] Download failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key) {
    try {
      console.log(`[Qiniu API] Deleting file: ${key}`);
      
      const config = new qiniu.conf.Config();
      config.zone = this.zoneConfig;
      const bucketManager = new qiniu.rs.BucketManager(this.mac, config);
      
      return new Promise((resolve, reject) => {
        bucketManager.delete(this.bucket, key, (err, respBody, respInfo) => {
          if (err) {
            console.error(`[Qiniu API] Delete failed for ${key}:`, err);
            reject(err);
            return;
          }
          
          if (respInfo.statusCode === 200 || respInfo.statusCode === 612) {
            // 612 表示文件不存在，也认为删除成功
            console.log(`[Qiniu API] Delete completed: ${key}`);
            resolve({ success: true });
          } else {
            console.error(`[Qiniu API] Delete failed with status ${respInfo.statusCode}`);
            reject(new Error(`删除失败: ${respBody.error || respInfo.statusCode}`));
          }
        });
      });
    } catch (error) {
      console.error(`[Qiniu API] Delete exception for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys) {
    try {
      console.log(`[Qiniu API] Batch deleting ${keys.length} files`);
      
      if (keys.length === 0) {
        return { success: true, deleted: [] };
      }

      const config = new qiniu.conf.Config();
      config.zone = this.zoneConfig;
      const bucketManager = new qiniu.rs.BucketManager(this.mac, config);
      
      // 七牛云批量操作最多1000个
      const deleteOps = keys.map(key => qiniu.rs.deleteOp(this.bucket, key));
      
      return new Promise((resolve, reject) => {
        bucketManager.batch(deleteOps, (err, respBody, respInfo) => {
          if (err) {
            console.error(`[Qiniu API] Batch delete failed:`, err);
            reject(err);
            return;
          }
          
          if (respInfo.statusCode === 200) {
            console.log(`[Qiniu API] Batch delete completed: ${keys.length} files`);
            resolve({ success: true, deleted: keys });
          } else {
            console.error(`[Qiniu API] Batch delete failed with status ${respInfo.statusCode}`);
            reject(new Error(`批量删除失败: ${respInfo.statusCode}`));
          }
        });
      });
    } catch (error) {
      console.error(`[Qiniu API] Batch delete exception:`, error);
      throw error;
    }
  }

  /**
   * 列举对象
   */
  async listObjects(options = {}) {
    try {
      console.log(`[Qiniu API] Listing objects with options:`, options);
      
      const {
        prefix = '',
        delimiter = undefined,
        continuationToken = undefined,
        maxKeys = 1000
      } = options;

      const config = new qiniu.conf.Config();
      config.zone = this.zoneConfig;
      const bucketManager = new qiniu.rs.BucketManager(this.mac, config);
      
      return new Promise((resolve, reject) => {
        bucketManager.listPrefix(this.bucket, {
          prefix: prefix,
          delimiter: delimiter,
          marker: continuationToken,
          limit: maxKeys
        }, (err, respBody, respInfo) => {
          if (err) {
            console.error(`[Qiniu API] List objects failed:`, err);
            reject(err);
            return;
          }
          
          if (respInfo.statusCode === 200) {
            const files = (respBody.items || []).map(item => ({
              Key: item.key,
              LastModified: new Date(item.putTime / 10000), // 七牛云时间戳是100纳秒
              Size: item.fsize,
              ETag: item.hash,
              StorageClass: item.type === 0 ? 'STANDARD' : 'INFREQUENT'
            }));

            const folders = (respBody.commonPrefixes || []).map(prefix => ({
              key: prefix,
              isFolder: true
            }));

            console.log(`[Qiniu API] List completed: ${files.length} files, ${folders.length} folders`);
            
            resolve({
              success: true,
              data: {
                files,
                folders,
                nextContinuationToken: respBody.marker || undefined,
                isTruncated: !!respBody.marker
              }
            });
          } else {
            console.error(`[Qiniu API] List failed with status ${respInfo.statusCode}`);
            reject(new Error(`列举失败: ${respBody.error || respInfo.statusCode}`));
          }
        });
      });
    } catch (error) {
      console.error(`[Qiniu API] List objects exception:`, error);
      throw error;
    }
  }

  /**
   * listFiles 方法作为 listObjects 的别名
   */
  async listFiles(options = {}) {
    return this.listObjects(options);
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      console.log('[Qiniu API] Getting storage stats...');
      
      let totalCount = 0;
      let totalSize = 0;
      let continuationToken = undefined;
      let isTruncated = true;

      while (isTruncated) {
        const response = await this.listObjects({ 
          continuationToken,
          maxKeys: 1000 
        });
        
        if (!response.success) {
          break;
        }
        
        const files = response.data.files || [];
        totalCount += files.length;
        totalSize += files.reduce((acc, file) => acc + (file.Size || 0), 0);
        
        isTruncated = response.data.isTruncated;
        continuationToken = response.data.nextContinuationToken;
        
        console.log(`[Qiniu API] Stats progress: ${totalCount} files, ${totalSize} bytes`);
        
        if (!isTruncated || !continuationToken) {
          break;
        }
      }

      console.log(`[Qiniu API] Final storage stats: ${totalCount} files, ${totalSize} bytes`);
      
      return {
        success: true,
        data: {
          totalCount,
          totalSize
        }
      };
    } catch (error) {
      console.error('[Qiniu API] Get storage stats failed:', error);
      throw error;
    }
  }

  /**
   * 获取预签名URL（私有下载链接）
   */
  async getPresignedUrl(key, expiresIn = 900) {
    try {
      console.log(`[Qiniu API] Getting presigned URL for: ${key}, isPrivate: ${this.isPrivate}`);
      
      // 如果有自定义域名，使用自定义域名
      const domain = this.publicDomain;
      if (!domain) {
        console.error('[Qiniu API] No public domain configured');
        throw new Error('七牛云需要配置自定义域名才能预览文件。请在设置中配置您的自定义域名（如 https://cdn.yourdomain.com）。');
      }
      
      let cleanDomain = domain;
      if (cleanDomain.endsWith('/')) {
        cleanDomain = cleanDomain.slice(0, -1);
      }
      if (!/^(https?:\/\/)/i.test(cleanDomain)) {
        cleanDomain = `https://${cleanDomain}`;
      }
      
      // 对文件名进行 URL 编码，处理中文字符
      const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/');
      const publicUrl = `${cleanDomain}/${encodedKey}`;
      
      // 如果是公开空间，直接返回公共URL
      if (!this.isPrivate) {
        console.log(`[Qiniu API] Public space, returning public URL: ${publicUrl}`);
        return publicUrl;
      }
      
      // 如果是私有空间，生成带签名的URL
      console.log(`[Qiniu API] Private space, generating signed URL...`);
      const config = new qiniu.conf.Config();
      const bucketManager = new qiniu.rs.BucketManager(this.mac, config);
      const deadline = Math.floor(Date.now() / 1000) + expiresIn;
      
      // 使用未编码的key，让SDK自己处理编码
      const originalUrl = `${cleanDomain}/${key}`;
      const privateDownloadUrl = bucketManager.privateDownloadUrl(originalUrl, deadline);
      
      console.log(`[Qiniu API] Generated private URL: ${privateDownloadUrl}`);
      return privateDownloadUrl;
    } catch (error) {
      console.error(`[Qiniu API] Get presigned URL failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(searchTerm, options = {}) {
    try {
      console.log(`[Qiniu API] Searching files with term: ${searchTerm}`);
      
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      let continuationToken = undefined;
      const results = [];

      do {
        const response = await this.listFiles({
          ...options,
          continuationToken
        });

        if (response.success) {
          const filteredFiles = response.data.files.filter(item => 
            item.Key.toLowerCase().includes(lowerCaseSearchTerm)
          );
          results.push(...filteredFiles);
          continuationToken = response.data.nextContinuationToken;
        }
      } while (continuationToken);

      console.log(`[Qiniu API] Search completed: ${results.length} results found`);
      
      return {
        success: true,
        data: {
          files: results,
          total: results.length
        }
      };
    } catch (error) {
      console.error(`[Qiniu API] Search files failed:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key) {
    try {
      console.log(`[Qiniu API] Checking if file exists: ${key}`);
      
      const config = new qiniu.conf.Config();
      config.zone = this.zoneConfig;
      const bucketManager = new qiniu.rs.BucketManager(this.mac, config);
      
      return new Promise((resolve, reject) => {
        bucketManager.stat(this.bucket, key, (err, respBody, respInfo) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (respInfo.statusCode === 200) {
            console.log(`[Qiniu API] File exists: ${key}`);
            resolve(true);
          } else if (respInfo.statusCode === 612) {
            console.log(`[Qiniu API] File does not exist: ${key}`);
            resolve(false);
          } else {
            reject(new Error(`检查文件失败: ${respBody.error || respInfo.statusCode}`));
          }
        });
      });
    } catch (error) {
      console.error(`[Qiniu API] Check file exists failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key) {
    try {
      console.log(`[Qiniu API] Getting file info: ${key}`);
      
      const config = new qiniu.conf.Config();
      config.zone = this.zoneConfig;
      const bucketManager = new qiniu.rs.BucketManager(this.mac, config);
      
      return new Promise((resolve, reject) => {
        bucketManager.stat(this.bucket, key, (err, respBody, respInfo) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (respInfo.statusCode === 200) {
            const fileInfo = {
              Key: key,
              Size: respBody.fsize,
              LastModified: new Date(respBody.putTime / 10000),
              ETag: respBody.hash,
              ContentType: respBody.mimeType,
              StorageClass: respBody.type === 0 ? 'STANDARD' : 'INFREQUENT'
            };

            console.log(`[Qiniu API] File info retrieved: ${key}`);
            resolve({
              success: true,
              data: fileInfo
            });
          } else {
            reject(new Error(`获取文件信息失败: ${respBody.error || respInfo.statusCode}`));
          }
        });
      });
    } catch (error) {
      console.error(`[Qiniu API] Get file info failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件内容（用于预览）
   */
  async getFileContent(key, maxSize = 1024 * 1024) {
    try {
      console.log(`[Qiniu API] Getting file content for: ${key}`);
      
      // 先获取文件信息
      const fileInfoResponse = await this.getFileInfo(key);
      if (!fileInfoResponse.success) {
        throw new Error('获取文件信息失败');
      }
      
      const fileSize = fileInfoResponse.data.Size;
      
      // 检查文件大小
      if (fileSize > maxSize) {
        return {
          success: true,
          data: {
            tooLarge: true,
            size: fileSize
          }
        };
      }

      // 获取下载链接并下载内容
      const downloadUrl = await this.getPresignedUrl(key, 3600);
      
      return new Promise((resolve, reject) => {
        const protocol = downloadUrl.startsWith('https') ? https : http;
        
        protocol.get(downloadUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`获取文件内容失败: HTTP ${response.statusCode}`));
            return;
          }
          
          const chunks = [];
          
          response.on('data', (chunk) => {
            chunks.push(chunk);
          });
          
          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const content = buffer.toString('utf-8');
            
            resolve({
              success: true,
              data: {
                content: content,
                size: fileSize,
                tooLarge: false
              }
            });
          });
          
          response.on('error', (err) => {
            reject(err);
          });
        }).on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error(`[Qiniu API] Get file content failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 列出所有存储空间
   */
  async listBuckets() {
    try {
      console.log('[Qiniu API] Listing buckets...');
      
      const config = new qiniu.conf.Config();
      const bucketManager = new qiniu.rs.BucketManager(this.mac, config);
      
      return new Promise((resolve, reject) => {
        bucketManager.buckets((err, respBody, respInfo) => {
          if (err) {
            console.error('[Qiniu API] List buckets failed:', err);
            reject(err);
            return;
          }
          
          if (respInfo.statusCode === 200) {
            const buckets = (respBody || []).map(bucketName => ({
              name: bucketName,
              region: 'unknown', // 七牛云API不直接返回区域信息
              creationDate: null
            }));
            
            console.log(`[Qiniu API] Buckets listed: ${buckets.length} buckets`);
            
            resolve({
              success: true,
              data: buckets
            });
          } else {
            console.error(`[Qiniu API] List buckets failed with status ${respInfo.statusCode}`);
            reject(new Error(`列举存储空间失败: ${respBody.error || respInfo.statusCode}`));
          }
        });
      });
    } catch (error) {
      console.error('[Qiniu API] List buckets exception:', error);
      throw error;
    }
  }

  /**
   * 创建文件夹（通过创建空对象实现）
   */
  async createFolder(folderName) {
    try {
      console.log(`[Qiniu API] Creating folder: ${folderName}`);
      
      // 确保文件夹名以 / 结尾
      const key = folderName.endsWith('/') ? folderName : `${folderName}/`;
      
      // 七牛云通过上传空文件实现文件夹
      const options = {
        scope: this.bucket,
      };
      const putPolicy = new qiniu.rs.PutPolicy(options);
      const uploadToken = putPolicy.uploadToken(this.mac);
      
      const config = new qiniu.conf.Config();
      config.zone = this.zoneConfig;
      const formUploader = new qiniu.form_up.FormUploader(config);
      const putExtra = new qiniu.form_up.PutExtra();
      
      return new Promise((resolve, reject) => {
        formUploader.put(uploadToken, key, '', putExtra, (err, respBody, respInfo) => {
          if (err) {
            console.error(`[Qiniu API] Create folder failed for ${key}:`, err);
            reject(err);
            return;
          }
          
          if (respInfo.statusCode === 200) {
            console.log(`[Qiniu API] Folder created: ${key}`);
            resolve({ success: true });
          } else {
            console.error(`[Qiniu API] Create folder failed with status ${respInfo.statusCode}`);
            reject(new Error(`创建文件夹失败: ${respBody.error || respInfo.statusCode}`));
          }
        });
      });
    } catch (error) {
      console.error(`[Qiniu API] Create folder exception for ${folderName}:`, error);
      throw error;
    }
  }

  /**
   * 删除文件夹（删除所有带有该前缀的对象）
   */
  async deleteFolder(prefix) {
    try {
      console.log(`[Qiniu API] Deleting folder: ${prefix}`);
      
      // 列出所有带有该前缀的对象
      let continuationToken = undefined;
      let allKeys = [];
      
      do {
        const response = await this.listFiles({
          prefix,
          continuationToken
        });
        
        if (response.success) {
          const keys = response.data.files.map(file => file.Key);
          allKeys = allKeys.concat(keys);
          continuationToken = response.data.nextContinuationToken;
        }
      } while (continuationToken);
      
      // 批量删除所有对象
      if (allKeys.length > 0) {
        await this.deleteFiles(allKeys);
      }
      
      console.log(`[Qiniu API] Folder deleted: ${prefix} (${allKeys.length} objects)`);
      return { success: true, deletedCount: allKeys.length };
    } catch (error) {
      console.error(`[Qiniu API] Delete folder failed for ${prefix}:`, error);
      throw error;
    }
  }
}

export default QiniuAPI;

