import fs from 'fs';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * 京东云对象存储（OSS）API 模块
 * 基于 AWS S3 兼容接口实现
 */

class JdCloudAPI {
  constructor(config) {
    const region = config.region || 'cn-north-1';
    const endpoint = config.endpoint && config.endpoint.trim().length > 0
      ? config.endpoint.trim()
      : `https://s3.${region}.jdcloud-oss.com`;

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: !!config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.bucket = config.bucket;
    this.region = region;
    this.endpoint = endpoint;
    this.publicDomain = config.publicDomain;
    this.isPrivate = config.isPrivate || false;
  }

  getPublicUrl(key) {
    if (this.publicDomain) {
      let domain = this.publicDomain;
      if (domain.endsWith('/')) {
        domain = domain.slice(0, -1);
      }
      if (!/^(https?:\/\/)/i.test(domain)) {
        domain = `https://${domain}`;
      }
      const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/');
      return `${domain}/${encodedKey}`;
    }

    const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/');
    return `${this.endpoint.replace(/\/$/, '')}/${this.bucket}/${encodedKey}`;
  }

  async testConnection() {
    try {
      console.log('[JDCloud API] Testing connection...');
      const command = new HeadBucketCommand({ Bucket: this.bucket });
      await this.client.send(command);
      return { success: true, message: '京东云对象存储连接成功！' };
    } catch (error) {
      console.error('[JDCloud API] Connection failed:', error);
      return { success: false, error: `京东云连接失败: ${error.message}` };
    }
  }

  async uploadFile(filePath, key, onProgress) {
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
        key,
        bucket: this.bucket,
        url: this.isPrivate ? undefined : this.getPublicUrl(key)
      }
    };
  }

  async downloadFile(key, filePath, onProgress) {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const { Body, ContentLength } = await this.client.send(command);

    if (!Body) {
      throw new Error('未从京东云获得有效的对象流');
    }

    const writeStream = fs.createWriteStream(filePath);
    let downloadedBytes = 0;
    Body.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (onProgress && ContentLength) {
        const percentage = Math.round((downloadedBytes / ContentLength) * 100);
        onProgress(percentage, downloadedBytes, ContentLength);
      }
    });

    Body.pipe(writeStream);

    await new Promise((resolve, reject) => {
      const handleError = (err) => {
        writeStream.end();
        reject(err);
      };
      writeStream.on('finish', resolve);
      writeStream.on('error', handleError);
      Body.on('error', handleError);
    });

    return { success: true };
  }

  async deleteFile(key) {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.client.send(command);
    return { success: true };
  }

  async deleteFiles(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      return { success: true, deleted: [] };
    }

    const batchSize = 1000;
    const deleted = [];

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: batch.map((item) => ({ Key: item })),
          Quiet: false,
        },
      });

      const response = await this.client.send(command);
      if (response.Deleted) {
        deleted.push(...response.Deleted.map((obj) => obj.Key));
      }
    }

    return { success: true, deleted };
  }

  async listObjects(options = {}) {
    const {
      prefix = '',
      delimiter = undefined,
      continuationToken = undefined,
      maxKeys = 1000,
    } = options;

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      Delimiter: delimiter,
      ContinuationToken: continuationToken,
      MaxKeys: maxKeys,
    });

    const response = await this.client.send(command);

    const files = (response.Contents || []).map((obj) => ({
      Key: obj.Key,
      LastModified: obj.LastModified,
      Size: obj.Size,
      ETag: obj.ETag,
      StorageClass: obj.StorageClass,
    }));

    const folders = (response.CommonPrefixes || []).map((item) => ({
      key: item.Prefix,
      isFolder: true,
    }));

    return {
      success: true,
      data: {
        files,
        folders,
        nextContinuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated,
      },
    };
  }

  async listFiles(options = {}) {
    return this.listObjects(options);
  }

  async getStorageStats() {
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
        totalSize,
      },
    };
  }

  async getPresignedUrl(key, expiresIn = 900) {
    if (!this.isPrivate && this.publicDomain) {
      return this.getPublicUrl(key);
    }

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async getFileContent(key, maxSize = 1024 * 1024) {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('未获取到文件内容');
    }

    const contentLength = Number(response.ContentLength || 0);

    if (contentLength > maxSize) {
      if (typeof response.Body.destroy === 'function') {
        response.Body.destroy();
      }
      return {
        success: true,
        data: {
          tooLarge: true,
          size: contentLength
        }
      };
    }

    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    return {
      success: true,
      data: {
        content: buffer.toString('utf-8'),
        size: contentLength,
        tooLarge: false,
        contentType: response.ContentType
      }
    };
  }

  async searchFiles(keyword, options = {}) {
    const lowerKeyword = keyword.toLowerCase();
    let continuationToken = undefined;
    const results = [];

    do {
      const response = await this.listObjects({
        ...options,
        continuationToken,
      });

      if (response.success) {
        const matched = response.data.files.filter((item) =>
          item.Key.toLowerCase().includes(lowerKeyword)
        );
        results.push(...matched);
        continuationToken = response.data.nextContinuationToken;
      } else {
        break;
      }
    } while (continuationToken);

    return {
      success: true,
      data: {
        files: results,
        total: results.length,
      },
    };
  }

  async createFolder(prefix) {
    const folderKey = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: folderKey,
      Body: new Uint8Array(),
    });
    await this.client.send(command);
    return { success: true };
  }

  async deleteFolder(prefix) {
    const folderKey = prefix.endsWith('/') ? prefix : `${prefix}/`;
    let continuationToken = undefined;
    const keysToDelete = [];

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: folderKey,
        ContinuationToken: continuationToken,
      });
      const response = await this.client.send(command);
      const batchKeys = response.Contents?.map((obj) => obj.Key) || [];
      keysToDelete.push(...batchKeys);
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    if (keysToDelete.length > 0) {
      await this.deleteFiles(keysToDelete);
    }

    return { success: true, deleted: keysToDelete };
  }
}

export default JdCloudAPI;

