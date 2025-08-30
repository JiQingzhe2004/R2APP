import fs from 'fs';
import COS from 'cos-nodejs-sdk-v5';

/**
 * 腾讯云COS API模块
 * 基于腾讯云COS SDK实现
 */

class CosAPI {
  constructor(config) {
    // 清理配置参数，去除可能的空格
    const cleanConfig = {
      secretId: config.secretId?.trim(),
      secretKey: config.secretKey?.trim(),
      bucket: config.bucket?.trim(),
      region: config.region?.trim(),
      publicDomain: config.publicDomain?.trim()
    };

    // 验证必要参数
    if (!cleanConfig.secretId || !cleanConfig.secretKey || !cleanConfig.bucket || !cleanConfig.region) {
      throw new Error('COS配置参数不完整，请检查SecretId、SecretKey、Bucket和Region配置');
    }

    console.log(`[COS API] Initializing with bucket: ${cleanConfig.bucket}, region: ${cleanConfig.region}`);
    
    this.client = new COS({
      SecretId: cleanConfig.secretId,
      SecretKey: cleanConfig.secretKey,
      Timeout: 30000,
      // 强制禁用代理
      Proxy: '',
      UseAccelerate: false,
      // 明确禁用代理设置
      Agent: null,
      // 设置请求头避免代理问题
      Headers: {
        'User-Agent': 'R2APP/4.1'
      }
    });
    this.bucket = cleanConfig.bucket;
    this.region = cleanConfig.region;
    this.publicDomain = cleanConfig.publicDomain; // 自定义域名配置
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
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      console.log('[COS API] Testing connection...');
      console.log(`[COS API] Bucket: ${this.bucket}, Region: ${this.region}`);
      
      await this.client.getBucket({
        Bucket: this.bucket,
        Region: this.region
      });
      
      console.log('[COS API] Connection test successful');
      return { success: true, message: 'COS 连接成功！' };
    } catch (error) {
      console.error('[COS API] Connection test failed:', error);
      
      // 提供更详细的错误信息
      let errorMessage = `COS 连接失败: ${error.message}`;
      
      if (error.code === 'AccessDenied') {
        errorMessage = '访问被拒绝，请检查SecretId、SecretKey和存储桶权限配置';
      } else if (error.code === 'NoSuchBucket') {
        errorMessage = '存储桶不存在，请检查存储桶名称和地域配置';
      } else if (error.code === 'ECONNRESET' || error.message.includes('tunneling socket')) {
        errorMessage = '网络连接问题，可能是代理设置导致的，请检查网络配置';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filePath, key, onProgress) {
    try {
      console.log(`[COS API] Uploading file: ${filePath} to ${key}`);
      
      const result = await this.client.putObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key,
        Body: fs.createReadStream(filePath),
        onProgress: (progressData) => {
          if (onProgress) {
            const percentage = Math.round((progressData.percent || 0) * 100);
            onProgress(percentage, progressData.loaded, progressData.total);
          }
        }
      });

      console.log(`[COS API] Upload completed: ${key}`);
      
      return {
        success: true,
        data: {
          key: key,
          bucket: this.bucket,
          url: this.getPublicUrl(key)
        }
      };
    } catch (error) {
      console.error(`[COS API] Upload failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(key, filePath, onProgress) {
    try {
      console.log(`[COS API] Downloading file: ${key} to ${filePath}`);
      
      const result = await this.client.getObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key,
        Output: filePath,
        onProgress: (progressData) => {
          if (onProgress) {
            const percentage = Math.round((progressData.percent || 0) * 100);
            onProgress(percentage, progressData.loaded, progressData.total);
          }
        }
      });

      console.log(`[COS API] Download completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[COS API] Download failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key) {
    try {
      console.log(`[COS API] Deleting file: ${key}`);
      await this.client.deleteObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key
      });
      console.log(`[COS API] Delete completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[COS API] Delete failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys) {
    try {
      console.log(`[COS API] Batch deleting ${keys.length} files`);
      
      if (keys.length === 0) {
        return { success: true, deleted: [] };
      }

      // COS支持批量删除，但需要分批处理（最多1000个）
      const batchSize = 1000;
      const deleted = [];
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const result = await this.client.deleteMultipleObject({
          Bucket: this.bucket,
          Region: this.region,
          Objects: batch.map(key => ({ Key: key }))
        });
        
        if (result.Deleted) {
          deleted.push(...result.Deleted.map(obj => obj.Key));
        }
      }
      
      console.log(`[COS API] Batch delete completed: ${deleted.length} files deleted`);
      return { success: true, deleted };
    } catch (error) {
      console.error(`[COS API] Batch delete failed:`, error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   */
  async listFiles(options = {}) {
    try {
      console.log(`[COS API] Listing files with options:`, options);
      
      const {
        prefix = '',
        delimiter = undefined,
        continuationToken = undefined,
        maxKeys = 1000
      } = options;

      const result = await this.client.getBucket({
        Bucket: this.bucket,
        Region: this.region,
        Prefix: prefix,
        Delimiter: delimiter,
        Marker: continuationToken,
        MaxKeys: maxKeys
      });

      const files = (result.Contents || []).map(obj => ({
        Key: obj.Key,
        LastModified: obj.LastModified,
        Size: obj.Size,
        ETag: obj.ETag,
        StorageClass: obj.StorageClass
      }));

      const folders = (result.CommonPrefixes || []).map(prefix => ({
        key: prefix.Prefix,
        isFolder: true
      }));

      console.log(`[COS API] List completed: ${files.length} files, ${folders.length} folders`);
      
      return {
        success: true,
        data: {
          files,
          folders,
          nextContinuationToken: result.NextMarker,
          isTruncated: result.IsTruncated
        }
      };
    } catch (error) {
      console.error(`[COS API] List files failed:`, error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      console.log('[COS API] Getting storage stats...');
      
      let totalCount = 0;
      let totalSize = 0;
      let marker = undefined;

      do {
        console.log(`[COS API] Fetching batch with marker: ${marker}`);
        
        const result = await this.client.getBucket({
          Bucket: this.bucket,
          Region: this.region,
          Marker: marker,
          MaxKeys: 1000
        });
        
        console.log(`[COS API] Batch result:`, {
          contentsLength: result.Contents?.length || 0,
          hasContents: !!result.Contents,
          isArray: Array.isArray(result.Contents),
          nextMarker: result.NextMarker
        });
        
        if (result.Contents && Array.isArray(result.Contents)) {
          const batchSize = result.Contents.length;
          // 确保 Size 是数值类型，避免字符串拼接
          const batchTotalSize = result.Contents.reduce((acc, obj) => {
            const size = parseInt(obj.Size) || 0;
            return acc + size;
          }, 0);
          
          console.log(`[COS API] Batch: ${batchSize} files, ${batchTotalSize} bytes`);
          
          totalCount += batchSize;
          totalSize += batchTotalSize;
          
          // 显示前几个文件的信息
          if (result.Contents.length > 0) {
            console.log(`[COS API] First few files:`, result.Contents.slice(0, 3).map(obj => ({
              key: obj.Key,
              size: obj.Size,
              lastModified: obj.LastModified
            })));
          }
        }
        
        marker = result.NextMarker;
      } while (marker);

      console.log(`[COS API] Storage stats: ${totalCount} files, ${totalSize} bytes`);
      
      return {
        success: true,
        data: {
          totalCount,
          totalSize
        }
      };
    } catch (error) {
      console.error('[COS API] Get storage stats failed:', error);
      throw error;
    }
  }

  /**
   * 获取预签名URL
   */
  async getPresignedUrl(key, expiresIn = 900) {
    try {
      console.log(`[COS API] Getting presigned URL for: ${key}`);
      console.log(`[COS API] Bucket: ${this.bucket}, Region: ${this.region}, Expires: ${expiresIn}`);
      
      // 如果有自定义域名，直接返回公共URL
      if (this.publicDomain) {
        const url = this.getPublicUrl(key);
        console.log(`[COS API] Using custom domain URL: ${url}`);
        return url;
      }
      
      // 否则使用预签名URL
      const url = this.client.getObjectUrl({
        Bucket: this.bucket,
        Region: this.region,
        Key: key,
        Sign: true,
        Expires: expiresIn
      });
      
      console.log(`[COS API] Presigned URL generated for: ${key}`);
      console.log(`[COS API] URL: ${url}`);
      return url;
    } catch (error) {
      console.error(`[COS API] Get presigned URL failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(searchTerm, options = {}) {
    try {
      console.log(`[COS API] Searching files with term: ${searchTerm}`);
      
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

      console.log(`[COS API] Search completed: ${results.length} results found`);
      
      return {
        success: true,
        data: {
          files: results,
          total: results.length
        }
      };
    } catch (error) {
      console.error(`[COS API] Search files failed:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key) {
    try {
      console.log(`[COS API] Checking if file exists: ${key}`);
      await this.client.headObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key
      });
      console.log(`[COS API] File exists: ${key}`);
      return true;
    } catch (error) {
      if (error.statusCode === 404) {
        console.log(`[COS API] File does not exist: ${key}`);
        return false;
      }
      console.error(`[COS API] Check file exists failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key) {
    try {
      console.log(`[COS API] Getting file info: ${key}`);
      const result = await this.client.headObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key
      });
      
      const fileInfo = {
        Key: key,
        Size: result.headers['content-length'],
        LastModified: result.headers['last-modified'],
        ETag: result.headers['etag'],
        ContentType: result.headers['content-type'],
        StorageClass: result.headers['x-cos-storage-class']
      };

      console.log(`[COS API] File info retrieved: ${key}`);
      return {
        success: true,
        data: fileInfo
      };
    } catch (error) {
      console.error(`[COS API] Get file info failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件内容（用于预览）
   */
  async getFileContent(key, maxSize = 1024 * 1024) {
    try {
      console.log(`[COS API] Getting file content for: ${key}`);
      
      const result = await this.client.getObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key
      });
      
      // 检查文件大小
      const contentLength = parseInt(result.headers['content-length'] || '0');
      console.log(`[COS API] File size: ${contentLength} bytes`);
      
      if (contentLength > maxSize) {
        console.log(`[COS API] File too large for preview: ${contentLength} > ${maxSize}`);
        return {
          success: true,
          data: {
            tooLarge: true,
            size: contentLength
          }
        };
      }

      // 检查内容类型
      const contentType = result.headers['content-type'] || '';
      console.log(`[COS API] Content type: ${contentType}`);
      
      // 只处理文本文件
      if (!contentType.startsWith('text/') && 
          !contentType.includes('json') && 
          !contentType.includes('xml') && 
          !contentType.includes('javascript') && 
          !contentType.includes('css') && 
          !contentType.includes('html')) {
        console.log(`[COS API] Non-text file type: ${contentType}`);
        return {
          success: true,
          data: {
            tooLarge: false,
            size: contentLength,
            content: `[二进制文件，无法预览]\n文件类型: ${contentType}\n文件大小: ${contentLength} 字节`
          }
        };
      }

      const content = result.Body.toString('utf-8');
      console.log(`[COS API] Content retrieved successfully, length: ${content.length}`);

      return {
        success: true,
        data: {
          content: content,
          size: contentLength,
          tooLarge: false
        }
      };
    } catch (error) {
      console.error(`[COS API] Get file content failed for ${key}:`, error);
      
      // 提供更详细的错误信息
      let errorMessage = `获取文件内容失败: ${error.message}`;
      
      if (error.code === 'NoSuchKey') {
        errorMessage = '文件不存在';
      } else if (error.code === 'AccessDenied') {
        errorMessage = '没有访问文件的权限';
      }
      
      throw new Error(errorMessage);
    }
  }
}

export default CosAPI;
