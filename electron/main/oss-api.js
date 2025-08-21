import fs from 'fs';
import OSS from 'ali-oss';

/**
 * 阿里云OSS API模块
 * 基于阿里云OSS SDK实现
 */

class OssAPI {
  constructor(config) {
    this.client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      secure: true,
    });
    this.bucket = config.bucket;
    this.region = config.region;
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
    return `https://${this.bucket}.${this.region}.aliyuncs.com/${key}`;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      console.log('[OSS API] Testing connection...');
      await this.client.list({ 'max-keys': 1 });
      console.log('[OSS API] Connection test successful');
      return { success: true, message: 'OSS 连接成功！' };
    } catch (error) {
      console.error('[OSS API] Connection test failed:', error);
      return { success: false, error: `OSS 连接失败: ${error.message}` };
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filePath, key, onProgress, checkpoint) {
    try {
      console.log(`[OSS API] Uploading file: ${filePath} to ${key}`);
      
      const controller = new AbortController();
      
      await this.client.multipartUpload(key, filePath, {
        signal: controller.signal,
        checkpoint: checkpoint,
        progress: async (p, cpt) => {
          if (onProgress) {
            onProgress(Math.round(p * 100), p, 1, 0);
          }
        }
      });

      console.log(`[OSS API] Upload completed: ${key}`);
      
      return {
        success: true,
        data: {
          key: key,
          bucket: this.bucket,
          url: this.getPublicUrl(key)
        }
      };
    } catch (error) {
      console.error(`[OSS API] Upload failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(key, filePath, onProgress) {
    try {
      console.log(`[OSS API] Downloading file: ${key} to ${filePath}`);
      
      const result = await this.client.get(key, filePath);
      
      if (result.res.status === 200) {
        console.log(`[OSS API] Download completed: ${key}`);
        return { success: true };
      } else {
        throw new Error(`OSS download failed with status: ${result.res.status}`);
      }
    } catch (error) {
      console.error(`[OSS API] Download failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key) {
    try {
      console.log(`[OSS API] Deleting file: ${key}`);
      await this.client.delete(key);
      console.log(`[OSS API] Delete completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[OSS API] Delete failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys) {
    try {
      console.log(`[OSS API] Batch deleting ${keys.length} files`);
      
      if (keys.length === 0) {
        return { success: true, deleted: [] };
      }

      // OSS deleteMulti can handle 1000 keys at a time
      await this.client.deleteMulti(keys, { quiet: true });
      
      console.log(`[OSS API] Batch delete completed: ${keys.length} files deleted`);
      return { success: true, deleted: keys };
    } catch (error) {
      console.error(`[OSS API] Batch delete failed:`, error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   */
  async listFiles(options = {}) {
    try {
      console.log(`[OSS API] Listing files with options:`, options);
      
      const {
        prefix = '',
        delimiter = undefined,
        continuationToken = undefined,
        maxKeys = 1000
      } = options;

      const response = await this.client.list({
        marker: continuationToken,
        prefix: prefix,
        delimiter: delimiter,
        'max-keys': maxKeys
      });

      const files = (response.objects || []).map(obj => ({
        Key: obj.name,
        LastModified: obj.lastModified,
        Size: obj.size,
        ETag: obj.etag,
        StorageClass: obj.storageClass
      }));

      const folders = (response.prefixes || []).map(prefix => ({
        key: prefix,
        isFolder: true
      }));

      console.log(`[OSS API] List completed: ${files.length} files, ${folders.length} folders`);
      
      return {
        success: true,
        data: {
          files,
          folders,
          nextContinuationToken: response.nextMarker,
          isTruncated: !!response.nextMarker
        }
      };
    } catch (error) {
      console.error(`[OSS API] List files failed:`, error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      console.log('[OSS API] Getting storage stats...');
      
      let totalCount = 0;
      let totalSize = 0;
      let continuationToken = undefined;

      do {
        const response = await this.client.list({ 
          marker: continuationToken, 
          'max-keys': 1000 
        });
        totalCount += response.objects?.length || 0;
        totalSize += response.objects?.reduce((acc, obj) => acc + obj.size, 0) || 0;
        continuationToken = response.nextMarker;
      } while (continuationToken);

      console.log(`[OSS API] Storage stats: ${totalCount} files, ${totalSize} bytes`);
      
      return {
        success: true,
        data: {
          totalCount,
          totalSize
        }
      };
    } catch (error) {
      console.error('[OSS API] Get storage stats failed:', error);
      throw error;
    }
  }

  /**
   * 获取预签名URL
   */
  async getPresignedUrl(key, expiresIn = 900) {
    try {
      console.log(`[OSS API] Getting presigned URL for: ${key}`);
      
      // 如果有自定义域名，直接返回公共URL
      if (this.publicDomain) {
        const url = this.getPublicUrl(key);
        console.log(`[OSS API] Using custom domain URL: ${url}`);
        return url;
      }
      
      // 否则使用预签名URL
      const url = this.client.signatureUrl(key, { expires: expiresIn });
      console.log(`[OSS API] Presigned URL generated for: ${key}`);
      return url;
    } catch (error) {
      console.error(`[OSS API] Get presigned URL failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(searchTerm, options = {}) {
    try {
      console.log(`[OSS API] Searching files with term: ${searchTerm}`);
      
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

      console.log(`[OSS API] Search completed: ${results.length} results found`);
      
      return {
        success: true,
        data: {
          files: results,
          total: results.length
        }
      };
    } catch (error) {
      console.error(`[OSS API] Search files failed:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key) {
    try {
      console.log(`[OSS API] Checking if file exists: ${key}`);
      await this.client.head(key);
      console.log(`[OSS API] File exists: ${key}`);
      return true;
    } catch (error) {
      if (error.code === 'NoSuchKey' || error.status === 404) {
        console.log(`[OSS API] File does not exist: ${key}`);
        return false;
      }
      console.error(`[OSS API] Check file exists failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key) {
    try {
      console.log(`[OSS API] Getting file info: ${key}`);
      const response = await this.client.head(key);
      
      const fileInfo = {
        Key: key,
        Size: response.res.headers['content-length'],
        LastModified: response.res.headers['last-modified'],
        ETag: response.res.headers['etag'],
        ContentType: response.res.headers['content-type'],
        StorageClass: response.res.headers['x-oss-storage-class']
      };

      console.log(`[OSS API] File info retrieved: ${key}`);
      return {
        success: true,
        data: fileInfo
      };
    } catch (error) {
      console.error(`[OSS API] Get file info failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件内容（用于预览）
   */
  async getFileContent(key, maxSize = 1024 * 1024) {
    try {
      console.log(`[OSS API] Getting file content for: ${key}`);
      
      const response = await this.client.get(key);
      
      // 检查文件大小
      const contentLength = parseInt(response.res.headers['content-length'] || '0');
      if (contentLength > maxSize) {
        return {
          success: true,
          data: {
            tooLarge: true,
            size: contentLength
          }
        };
      }

      const content = response.content.toString('utf-8');

      return {
        success: true,
        data: {
          content: content,
          size: contentLength,
          tooLarge: false
        }
      };
    } catch (error) {
      console.error(`[OSS API] Get file content failed for ${key}:`, error);
      throw error;
    }
  }
}

export default OssAPI;
