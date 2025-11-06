import fs from 'fs';
import ObsClient from 'esdk-obs-nodejs';

/**
 * 华为云OBS API模块
 * 基于华为云OBS SDK实现
 */

class ObsHuaweiAPI {
  constructor(config) {
    // 确保 server 参数格式正确（需要包含协议）
    let serverUrl = config.server;
    if (serverUrl && !serverUrl.startsWith('http')) {
      serverUrl = `https://${serverUrl}`;
    }
    
    console.log('[OBS Huawei API] Initializing with config:', {
      server: serverUrl,
      bucket: config.bucket,
      hasAccessKey: !!config.accessKeyId,
      hasSecretKey: !!config.secretAccessKey
    });
    
    this.client = new ObsClient({
      access_key_id: config.accessKeyId,
      secret_access_key: config.secretAccessKey,
      server: serverUrl,
      signature: 'v4' // 使用签名版本 v4
    });
    this.bucket = config.bucket;
    this.server = config.server;
    this.publicDomain = config.publicDomain; // 自定义域名配置
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
    
    // 移除 server 中的协议前缀（如果有）
    let serverHost = this.server;
    if (serverHost) {
      serverHost = serverHost.replace(/^https?:\/\//, '');
    }
    
    return `https://${this.bucket}.${serverHost}/${key}`;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      console.log('[OBS Huawei API] Testing connection...');
      const result = await new Promise((resolve, reject) => {
        this.client.listObjects({
          Bucket: this.bucket,
          MaxKeys: 1
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      // 检查响应状态
      if (result.CommonMsg.Status >= 300) {
        throw new Error(`${result.CommonMsg.Code}: ${result.CommonMsg.Message}`);
      }
      
      console.log('[OBS Huawei API] Connection test successful');
      return { success: true, message: '华为云 OBS 连接成功！' };
    } catch (error) {
      console.error('[OBS Huawei API] Connection test failed:', error);
      return { success: false, error: `华为云 OBS 连接失败: ${error.message || error.Code || '未知错误'}` };
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filePath, key, onProgress) {
    try {
      console.log(`[OBS Huawei API] Uploading file: ${filePath} to ${key}`);
      
      const fileStats = fs.statSync(filePath);
      const fileSize = fileStats.size;
      
      const result = await new Promise((resolve, reject) => {
        this.client.putObject({
          Bucket: this.bucket,
          Key: key,
          SourceFile: filePath,
          ProgressCallback: (transferredAmount, totalAmount, totalSeconds) => {
            if (onProgress) {
              const percentage = (transferredAmount / totalAmount) * 100;
              onProgress(Math.round(percentage), transferredAmount / totalAmount, totalAmount, transferredAmount);
            }
          }
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      // 检查响应状态
      if (result.CommonMsg.Status >= 300) {
        throw new Error(`上传文件失败: ${result.CommonMsg.Code} - ${result.CommonMsg.Message}`);
      }

      console.log(`[OBS Huawei API] Upload completed: ${key}`);
      
      return {
        success: true,
        data: {
          key: key,
          bucket: this.bucket,
          url: this.getPublicUrl(key),
          etag: result?.InterfaceResult?.ETag
        }
      };
    } catch (error) {
      console.error(`[OBS Huawei API] Upload failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(key, filePath, onProgress) {
    try {
      console.log(`[OBS Huawei API] Downloading file: ${key} to ${filePath}`);
      
      const result = await new Promise((resolve, reject) => {
        this.client.getObject({
          Bucket: this.bucket,
          Key: key,
          SaveAsFile: filePath,
          ProgressCallback: (transferredAmount, totalAmount, totalSeconds) => {
            if (onProgress) {
              const percentage = (transferredAmount / totalAmount) * 100;
              onProgress(Math.round(percentage));
            }
          }
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      // 检查响应状态
      if (result.CommonMsg.Status >= 300) {
        throw new Error(`下载文件失败: ${result.CommonMsg.Code} - ${result.CommonMsg.Message}`);
      }
      
      console.log(`[OBS Huawei API] Download completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[OBS Huawei API] Download failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key) {
    try {
      console.log(`[OBS Huawei API] Deleting file: ${key}`);
      
      const result = await new Promise((resolve, reject) => {
        this.client.deleteObject({
          Bucket: this.bucket,
          Key: key
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      // 检查响应状态
      if (result.CommonMsg.Status >= 300) {
        throw new Error(`删除对象失败: ${result.CommonMsg.Code} - ${result.CommonMsg.Message}`);
      }
      
      console.log(`[OBS Huawei API] Delete completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[OBS Huawei API] Delete failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys) {
    try {
      console.log(`[OBS Huawei API] Batch deleting ${keys.length} files`);
      
      if (keys.length === 0) {
        return { success: true, deleted: [] };
      }

      const objects = keys.map(key => ({ Key: key }));
      
      await new Promise((resolve, reject) => {
        this.client.deleteObjects({
          Bucket: this.bucket,
          Quiet: true,
          Objects: objects
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      console.log(`[OBS Huawei API] Batch delete completed: ${keys.length} files deleted`);
      return { success: true, deleted: keys };
    } catch (error) {
      console.error(`[OBS Huawei API] Batch delete failed:`, error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   */
  /**
   * 列举桶内对象（根据华为云官方文档实现）
   */
  async listObjects(options = {}) {
    try {
      console.log(`[OBS Huawei API] Listing objects with options:`, options);
      
      const {
        prefix = '',
        delimiter = undefined,
        continuationToken = undefined,
        maxKeys = 1000
      } = options;

      const result = await new Promise((resolve, reject) => {
        this.client.listObjects({
          Bucket: this.bucket,
          Prefix: prefix,
          Delimiter: delimiter,
          Marker: continuationToken,
          MaxKeys: maxKeys
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      // 检查响应状态
      if (result.CommonMsg.Status >= 300) {
        throw new Error(`列举对象失败: ${result.CommonMsg.Code} - ${result.CommonMsg.Message}`);
      }

      // 根据华为云文档，数据在 InterfaceResult 中
      const files = (result.InterfaceResult.Contents || []).map(obj => {
        // 确保 Size 是数字类型
        let size = obj.Size;
        if (typeof size === 'string') {
          size = parseInt(size, 10);
        }
        if (isNaN(size)) {
          size = 0;
        }
        
        return {
          Key: obj.Key,
          LastModified: obj.LastModified,
          Size: size,
          ETag: obj.ETag,
          StorageClass: obj.StorageClass
        };
      });

      const folders = (result.InterfaceResult.CommonPrefixes || []).map(prefix => ({
        key: prefix.Prefix,
        isFolder: true
      }));

      console.log(`[OBS Huawei API] List completed: ${files.length} files, ${folders.length} folders`);
      
      return {
        success: true,
        data: {
          files,
          folders,
          nextContinuationToken: result.InterfaceResult.NextMarker,
          isTruncated: result.InterfaceResult.IsTruncated === 'true'
        }
      };
    } catch (error) {
      console.error(`[OBS Huawei API] List objects failed:`, error);
      throw error;
    }
  }

  /**
   * listFiles 方法作为 listObjects 的别名，保持向后兼容
   */
  async listFiles(options = {}) {
    return this.listObjects(options);
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      console.log('[OBS Huawei API] Getting storage stats...');
      
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
        
        // 累加文件大小，确保处理数字类型
        for (const file of files) {
          const size = parseInt(file.Size, 10) || 0;
          totalSize += size;
          
          // 调试：输出前几个文件的大小
          if (totalCount <= 5) {
            console.log(`[OBS Huawei API] File: ${file.Key}, Size: ${file.Size} (${typeof file.Size}), Parsed: ${size}`);
          }
        }
        
        // 检查是否还有更多数据
        isTruncated = response.data.isTruncated === true || response.data.isTruncated === 'true';
        continuationToken = response.data.nextContinuationToken;
        
        console.log(`[OBS Huawei API] Batch stats: ${files.length} files, current total: ${totalCount} files, ${totalSize} bytes, isTruncated: ${isTruncated}`);
        
        // 如果没有更多数据，退出循环
        if (!isTruncated || !continuationToken) {
          break;
        }
      }

      console.log(`[OBS Huawei API] Final storage stats: ${totalCount} files, ${totalSize} bytes`);
      
      return {
        success: true,
        data: {
          totalCount,
          totalSize
        }
      };
    } catch (error) {
      console.error('[OBS Huawei API] Get storage stats failed:', error);
      throw error;
    }
  }

  /**
   * 获取预签名URL
   */
  async getPresignedUrl(key, expiresIn = 900) {
    try {
      console.log(`[OBS Huawei API] Getting presigned URL for: ${key}`);
      console.log(`[OBS Huawei API] Config - bucket: ${this.bucket}, server: ${this.server}`);
      
      // 如果有自定义域名，直接返回公共URL
      if (this.publicDomain) {
        const url = this.getPublicUrl(key);
        console.log(`[OBS Huawei API] Using custom domain URL: ${url}`);
        return url;
      }
      
      // 方法1：尝试使用同步方法 createSignedUrlSync
      try {
        console.log('[OBS Huawei API] Trying createSignedUrlSync...');
        const result = this.client.createSignedUrlSync({
          Method: 'GET',
          Bucket: this.bucket,
          Key: key,
          Expires: expiresIn
        });
        
        console.log('[OBS Huawei API] createSignedUrlSync result:', result);
        
        // 检查结果结构
        if (result && result.SignedUrl) {
          console.log(`[OBS Huawei API] Presigned URL generated (sync): ${result.SignedUrl}`);
          return result.SignedUrl;
        }
        
        // 检查是否有错误状态
        if (result && result.CommonMsg && result.CommonMsg.Status >= 300) {
          throw new Error(`生成预签名URL失败: ${result.CommonMsg.Code} - ${result.CommonMsg.Message}`);
        }
      } catch (syncError) {
        console.log('[OBS Huawei API] createSignedUrlSync failed, trying async method...', syncError);
      }
      
      // 方法2：如果同步方法失败，尝试异步方法 createSignedUrl
      const result = await new Promise((resolve, reject) => {
        this.client.createSignedUrl({
          Method: 'GET',
          Bucket: this.bucket,
          Key: key,
          Expires: expiresIn
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      console.log('[OBS Huawei API] createSignedUrl result:', result);
      
      // 检查是否成功
      if (result.CommonMsg && result.CommonMsg.Status >= 300) {
        throw new Error(`生成预签名URL失败: ${result.CommonMsg.Code} - ${result.CommonMsg.Message}`);
      }
      
      if (result.SignedUrl) {
        console.log(`[OBS Huawei API] Presigned URL generated (async): ${result.SignedUrl}`);
        return result.SignedUrl;
      }
      
      // 如果都没有成功，返回默认的公共URL
      console.log('[OBS Huawei API] Failed to generate presigned URL, falling back to public URL');
      return this.getPublicUrl(key);
      
    } catch (error) {
      console.error(`[OBS Huawei API] Get presigned URL failed for ${key}:`, error);
      // 如果预签名URL生成失败，返回公共URL作为后备
      console.log('[OBS Huawei API] Falling back to public URL due to error');
      return this.getPublicUrl(key);
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(searchTerm, options = {}) {
    try {
      console.log(`[OBS Huawei API] Searching files with term: ${searchTerm}`);
      
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

      console.log(`[OBS Huawei API] Search completed: ${results.length} results found`);
      
      return {
        success: true,
        data: {
          files: results,
          total: results.length
        }
      };
    } catch (error) {
      console.error(`[OBS Huawei API] Search files failed:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key) {
    try {
      console.log(`[OBS Huawei API] Checking if file exists: ${key}`);
      
      await new Promise((resolve, reject) => {
        this.client.getObjectMetadata({
          Bucket: this.bucket,
          Key: key
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      console.log(`[OBS Huawei API] File exists: ${key}`);
      return true;
    } catch (error) {
      if (error.code === 'NoSuchKey' || error.CommonMsg?.Status === 404) {
        console.log(`[OBS Huawei API] File does not exist: ${key}`);
        return false;
      }
      console.error(`[OBS Huawei API] Check file exists failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key) {
    try {
      console.log(`[OBS Huawei API] Getting file info: ${key}`);
      
      const result = await new Promise((resolve, reject) => {
        this.client.getObjectMetadata({
          Bucket: this.bucket,
          Key: key
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      const fileInfo = {
        Key: key,
        Size: result.InterfaceResult.ContentLength,
        LastModified: result.InterfaceResult.LastModified,
        ETag: result.InterfaceResult.ETag,
        ContentType: result.InterfaceResult.ContentType,
        StorageClass: result.InterfaceResult.StorageClass
      };

      console.log(`[OBS Huawei API] File info retrieved: ${key}`);
      return {
        success: true,
        data: fileInfo
      };
    } catch (error) {
      console.error(`[OBS Huawei API] Get file info failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件内容（用于预览）
   */
  async getFileContent(key, maxSize = 1024 * 1024) {
    try {
      console.log(`[OBS Huawei API] Getting file content for: ${key}`);
      
      const result = await new Promise((resolve, reject) => {
        this.client.getObject({
          Bucket: this.bucket,
          Key: key
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      // 检查文件大小
      const contentLength = parseInt(result.InterfaceResult.ContentLength || '0');
      if (contentLength > maxSize) {
        return {
          success: true,
          data: {
            tooLarge: true,
            size: contentLength
          }
        };
      }

      const content = result.InterfaceResult.Content.toString('utf-8');

      return {
        success: true,
        data: {
          content: content,
          size: contentLength,
          tooLarge: false
        }
      };
    } catch (error) {
      console.error(`[OBS Huawei API] Get file content failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 列出所有存储桶
   */
  async listBuckets() {
    try {
      console.log('[OBS Huawei API] Listing buckets...');
      
      const result = await new Promise((resolve, reject) => {
        this.client.listBuckets((err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      // 检查响应状态
      if (result.CommonMsg.Status >= 300) {
        throw new Error(`列举存储桶失败: ${result.CommonMsg.Code} - ${result.CommonMsg.Message}`);
      }
      
      // 根据华为云文档，桶列表在 InterfaceResult.Buckets 中
      const buckets = (result.InterfaceResult.Buckets || []).map(bucket => ({
        name: bucket.BucketName || bucket.Name,
        region: bucket.Location,
        creationDate: bucket.CreationDate
      }));
      
      console.log(`[OBS Huawei API] Buckets listed: ${buckets.length} buckets`);
      
      return {
        success: true,
        data: buckets
      };
    } catch (error) {
      console.error('[OBS Huawei API] List buckets failed:', error);
      throw error;
    }
  }

  /**
   * 创建文件夹（通过创建空对象实现）
   */
  async createFolder(folderName) {
    try {
      console.log(`[OBS Huawei API] Creating folder: ${folderName}`);
      
      // 确保文件夹名以 / 结尾
      const key = folderName.endsWith('/') ? folderName : `${folderName}/`;
      
      const result = await new Promise((resolve, reject) => {
        this.client.putObject({
          Bucket: this.bucket,
          Key: key,
          Body: ''
        }, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      // 检查响应状态
      if (result.CommonMsg.Status >= 300) {
        throw new Error(`创建文件夹失败: ${result.CommonMsg.Code} - ${result.CommonMsg.Message}`);
      }
      
      console.log(`[OBS Huawei API] Folder created: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[OBS Huawei API] Create folder failed for ${folderName}:`, error);
      throw error;
    }
  }

  /**
   * 删除文件夹（删除所有带有该前缀的对象）
   */
  async deleteFolder(prefix) {
    try {
      console.log(`[OBS Huawei API] Deleting folder: ${prefix}`);
      
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
      
      console.log(`[OBS Huawei API] Folder deleted: ${prefix} (${allKeys.length} objects)`);
      return { success: true, deletedCount: allKeys.length };
    } catch (error) {
      console.error(`[OBS Huawei API] Delete folder failed for ${prefix}:`, error);
      throw error;
    }
  }
}

export default ObsHuaweiAPI;

