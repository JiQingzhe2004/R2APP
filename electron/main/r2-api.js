import fs from 'fs';
import { 
  S3Client, 
  ListObjectsV2Command, 
  DeleteObjectCommand, 
  GetObjectCommand, 
  HeadBucketCommand,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 API模块
 */

class R2API {
  constructor(config) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucketName;
    this.accountId = config.accountId;
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
    return `https://${this.accountId}.r2.cloudflarestorage.com/${this.bucket}/${key}`;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      console.log('[R2 API] Testing connection...');
      const command = new HeadBucketCommand({ Bucket: this.bucket });
      await this.client.send(command);
      return { success: true, message: 'R2 连接成功！' };
    } catch (error) {
      return { success: false, error: `R2 连接失败: ${error.message}` };
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filePath, key, onProgress) {
    try {
      const fileStream = fs.createReadStream(filePath);
      const upload = new Upload({
        client: this.client,
        params: { Bucket: this.bucket, Key: key, Body: fileStream },
        queueSize: 4,
        partSize: 1024 * 1024 * 5,
      });

      if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          if (progress.total) {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            onProgress(percentage, progress.loaded, progress.total);
          }
        });
      }

      await upload.done();
      
      return {
        success: true,
        data: {
          key: key,
          bucket: this.bucket,
          url: this.getPublicUrl(key)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(key, filePath, onProgress) {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const { Body, ContentLength } = await this.client.send(command);

      if (!Body) {
        throw new Error('No response body from R2');
      }

      const writeStream = fs.createWriteStream(filePath);
      let downloadedBytes = 0;
      let lastProgressTime = 0;
      let lastDownloaded = 0;

      Body.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = ContentLength ? Math.round((downloadedBytes / ContentLength) * 100) : 0;
        
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
          onProgress(progress, downloadedBytes, ContentLength, speed);
        }
      });

      Body.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        const errorHandler = (err) => {
          writeStream.end();
          reject(err);
        };

        writeStream.on('finish', resolve);
        writeStream.on('error', errorHandler);
        Body.on('error', errorHandler);
      });

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
      await this.client.send(command);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys) {
    try {
      console.log(`[R2 API] Batch deleting ${keys.length} files`);
      
      if (keys.length === 0) {
        return { success: true, deleted: [] };
      }

      // R2支持批量删除，但需要分批处理（最多1000个）
      const batchSize = 1000;
      const deleted = [];
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const command = new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map(key => ({ Key: key })),
            Quiet: false
          }
        });
        
        const response = await this.client.send(command);
        if (response.Deleted) {
          deleted.push(...response.Deleted.map(obj => obj.Key));
        }
      }
      
      console.log(`[R2 API] Batch delete completed: ${deleted.length} files deleted`);
      return { success: true, deleted };
    } catch (error) {
      console.error(`[R2 API] Batch delete failed:`, error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   */
  async listFiles(options = {}) {
    try {
      const {
        prefix = '',
        delimiter = undefined,
        continuationToken = undefined,
        maxKeys = 1000
      } = options;

      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: delimiter,
        ContinuationToken: continuationToken,
        MaxKeys: maxKeys
      });

      const response = await this.client.send(command);
      
      const files = (response.Contents || []).map(obj => ({
        Key: obj.Key,
        LastModified: obj.LastModified,
        Size: obj.Size,
        ETag: obj.ETag,
        StorageClass: obj.StorageClass
      }));

      const folders = (response.CommonPrefixes || []).map(prefix => ({
        key: prefix.Prefix,
        isFolder: true
      }));

      return {
        success: true,
        data: {
          files,
          folders,
          nextContinuationToken: response.NextContinuationToken,
          isTruncated: response.IsTruncated
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      let totalCount = 0;
      let totalSize = 0;
      let continuationToken = undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: continuationToken,
        });
        const response = await this.client.send(command);
        totalCount += response.KeyCount || 0;
        totalSize += response.Contents?.reduce((acc, obj) => acc + obj.Size, 0) || 0;
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return {
        success: true,
        data: {
          totalCount,
          totalSize
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取预签名URL
   */
  async getPresignedUrl(key, expiresIn = 900) {
    try {
      // 如果有自定义域名，直接返回公共URL
      if (this.publicDomain) {
        return this.getPublicUrl(key);
      }
      
      // 否则使用预签名URL
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(searchTerm, options = {}) {
    try {
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

      return {
        success: true,
        data: {
          files: results,
          total: results.length
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key) {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key) {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.client.send(command);
      
      const fileInfo = {
        Key: key,
        Size: response.ContentLength,
        LastModified: response.LastModified,
        ETag: response.ETag,
        ContentType: response.ContentType,
        StorageClass: response.StorageClass
      };

      return {
        success: true,
        data: fileInfo
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取文件内容（用于预览）
   */
  async getFileContent(key, maxSize = 1024 * 1024) {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No response body from R2');
      }

      // 检查文件大小
      if (response.ContentLength > maxSize) {
        return {
          success: true,
          data: {
            tooLarge: true,
            size: response.ContentLength
          }
        };
      }

      // 读取文件内容
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const content = buffer.toString('utf-8');

      return {
        success: true,
        data: {
          content: content,
          size: response.ContentLength,
          tooLarge: false
        }
      };
    } catch (error) {
      throw error;
    }
  }
}

export default R2API;
