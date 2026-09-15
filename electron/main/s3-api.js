import fs from 'fs';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * 通用 S3 兼容存储适配器（P0）
 *
 * 覆盖 Amazon S3、MinIO、Backblaze B2 及其他 S3 兼容服务。
 * 与京东云/R2 适配器保持相同的方法签名与返回结构（success/data 信封），
 * 以便直接接入现有 IPC 分发；差异点：
 *  - Endpoint / Region / forcePathStyle 完全可配置，不再固定 R2 的 auto 区域
 *  - 支持 rootPrefix 限定管理的对象前缀（仅限定界面范围，不替代服务端权限）
 *  - linkMode：public（公开链接）或 presigned（临时预签名链接，默认）
 *  - 连接测试只做 HeadBucket 读取探测，不创建测试文件，并区分认证/权限/Endpoint 问题
 *  - 支持上传取消（lib-storage 的 abort）与移动（复制成功后才删除源对象）
 */

const PRESETS = {
  aws: {
    label: 'Amazon S3',
    region: 'us-east-1',
    endpoint: '',
    forcePathStyle: false,
    regionHint: '例如 us-east-1 / ap-northeast-1'
  },
  minio: {
    label: 'MinIO',
    region: 'us-east-1',
    endpoint: '',
    forcePathStyle: true,
    regionHint: 'MinIO 常用 us-east-1，按部署填写'
  },
  b2: {
    label: 'Backblaze B2',
    region: '',
    endpoint: '',
    forcePathStyle: false,
    regionHint: 'Endpoint 与区域按桶所在区域填写，例如 s3.us-west-004.backblazeb2.com'
  },
  custom: {
    label: '自定义 S3 兼容服务',
    region: '',
    endpoint: '',
    forcePathStyle: true,
    regionHint: '按服务文档填写'
  }
};

// 将 S3 错误映射为统一类别（见对接文档 3.2 错误约定）
function classifyS3Error(error) {
  const name = error?.name || '';
  const status = error?.$metadata?.httpStatusCode;
  const code = error?.Code || error?.code || '';

  if (name === 'AbortError' || code === 'RequestAbortedError' || error?.message === 'Upload aborted') {
    return { kind: 'cancelled', message: '操作已取消' };
  }
  if (status === 401 || status === 403 || name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch' || name === 'AccessDenied') {
    if (name === 'AccessDenied' && status === 403) {
      return { kind: 'forbidden', message: '权限不足：当前凭据无法访问该资源', code };
    }
    return { kind: 'auth', message: '认证失败：请检查 Access Key / Secret Key 是否正确', code };
  }
  if (status === 404 || name === 'NoSuchBucket' || name === 'NoSuchKey') {
    return { kind: 'not-found', message: '目标不存在：请检查桶名、Endpoint 或前缀', code };
  }
  if (status === 409 || name === 'BucketAlreadyOwnedByYou') {
    return { kind: 'conflict', message: '同名冲突', code };
  }
  if (status === 503 || name === 'SlowDown' || name === 'TooManyRequests') {
    return { kind: 'throttled', message: '请求被限流，请稍后重试', code };
  }
  if (status === 301 || status === 400 && name === 'BadRequest' || name === 'AuthorizationHeaderMalformed') {
    return { kind: 'endpoint', message: 'Endpoint 或区域配置可能不正确', code };
  }
  if (error?.cause?.code === 'ENOTFOUND' || error?.cause?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNRESET') {
    return { kind: 'network', message: `网络错误：无法连接到 Endpoint（${error.cause.code}）`, code: error.cause.code };
  }
  return { kind: 'unknown', message: error?.message || '未知错误', code };
}

function normalizeEndpoint(endpoint) {
  if (!endpoint) return '';
  let ep = endpoint.trim();
  if (!/^https?:\/\//i.test(ep)) {
    ep = `https://${ep}`;
  }
  return ep.replace(/\/+$/, '');
}

class S3Api {
  constructor(config) {
    if (!config.bucket) {
      throw new Error('缺少桶名称');
    }
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error('缺少访问密钥');
    }

    const preset = PRESETS[config.preset] || PRESETS.custom;
    const region = config.region && config.region.trim() ? config.region.trim() : (preset.region || 'us-east-1');
    const endpoint = normalizeEndpoint(config.endpoint);

    this.client = new S3Client({
      region,
      // AWS 官方 S3 可不填 endpoint，由 SDK 按区域解析
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: config.forcePathStyle !== undefined ? !!config.forcePathStyle : !!preset.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        ...(config.sessionToken ? { sessionToken: config.sessionToken } : {})
      }
    });

    this.bucket = config.bucket;
    this.region = region;
    this.endpoint = endpoint;
    this.preset = config.preset || 'custom';
    this.publicDomain = config.publicDomain;
    this.rootPrefix = (config.rootPrefix || '').replace(/^\/+/, '').replace(/\/+$/, '');
    if (this.rootPrefix) this.rootPrefix += '/';
    // linkMode: 'presigned'（默认）| 'public'；public 等价于旧 isPrivate=false
    this.linkMode = config.linkMode || 'presigned';

    // 进行中的分片上传，供取消使用
    this.activeUploads = new Map();
  }

  static get presets() {
    return PRESETS;
  }

  getCapabilities() {
    return {
      publicLink: this.linkMode === 'public' || !!this.publicDomain,
      presignedLink: true,
      copyLink: true,
      preview: true,
      move: true,
      share: false,
      stats: true,
      cancelUpload: true
    };
  }

  // ---- rootPrefix 换算：界面层始终看到相对 key ----
  toRemote(key) {
    return `${this.rootPrefix}${key}`;
  }

  toLocal(key) {
    if (this.rootPrefix && key.startsWith(this.rootPrefix)) {
      return key.slice(this.rootPrefix.length);
    }
    return key;
  }

  getPublicUrl(key) {
    if (this.publicDomain) {
      let domain = this.publicDomain;
      if (domain.endsWith('/')) domain = domain.slice(0, -1);
      if (!/^https?:\/\//i.test(domain)) domain = `https://${domain}`;
      const encodedKey = encodeURIComponent(this.toRemote(key)).replace(/%2F/g, '/');
      return `${domain}/${encodedKey}`;
    }
    if (!this.endpoint) return undefined;
    const encodedKey = encodeURIComponent(this.toRemote(key)).replace(/%2F/g, '/');
    if (this.client.config.forcePathStyle) {
      return `${this.endpoint}/${this.bucket}/${encodedKey}`;
    }
    return `${this.endpoint.replace('://', `://${this.bucket}.`)}/${encodedKey}`;
  }

  async testConnection() {
    try {
      const command = new HeadBucketCommand({ Bucket: this.bucket });
      await this.client.send(command);
      return { success: true, message: 'S3 存储连接成功！' };
    } catch (error) {
      const mapped = classifyS3Error(error);
      console.error('[S3 API] 连接失败:', mapped.kind, error?.message);
      return { success: false, error: `S3 连接失败: ${mapped.message}`, kind: mapped.kind };
    }
  }

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
        Prefix: this.toRemote(prefix),
        Delimiter: delimiter,
        ContinuationToken: continuationToken,
        MaxKeys: maxKeys
      });

      const response = await this.client.send(command);

      const files = (response.Contents || []).map(obj => ({
        Key: this.toLocal(obj.Key),
        LastModified: obj.LastModified,
        Size: obj.Size,
        ETag: obj.ETag,
        StorageClass: obj.StorageClass
      }));

      const folders = (response.CommonPrefixes || []).map(p => ({
        key: this.toLocal(p.Prefix),
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
      const mapped = classifyS3Error(error);
      console.error('[S3 API] 列举失败:', mapped.kind, error?.message);
      throw new Error(mapped.message);
    }
  }

  async listObjects(options = {}) {
    return this.listFiles(options);
  }

  async uploadFile(filePath, key, onProgress) {
    const remoteKey = this.toRemote(key);
    let fileStream;
    try {
      fileStream = fs.createReadStream(filePath);
      const upload = new Upload({
        client: this.client,
        params: { Bucket: this.bucket, Key: remoteKey, Body: fileStream },
        queueSize: 4,
        partSize: 1024 * 1024 * 5
      });

      this.activeUploads.set(key, upload);

      if (onProgress) {
        upload.on('httpUploadProgress', progress => {
          if (progress.total) {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            onProgress(percentage, progress.loaded, progress.total);
          }
        });
      }

      await upload.done();

      const url = this.linkMode === 'public' ? this.getPublicUrl(key) : undefined;
      return { success: true, data: { key, bucket: this.bucket, url } };
    } catch (error) {
      const mapped = classifyS3Error(error);
      console.error(`[S3 API] 上传失败 ${key}:`, mapped.kind, error?.message);
      throw new Error(mapped.message);
    } finally {
      this.activeUploads.delete(key);
      if (fileStream && !fileStream.destroyed) fileStream.destroy();
    }
  }

  abortUpload(key) {
    const upload = this.activeUploads.get(key);
    if (upload && typeof upload.abort === 'function') {
      upload.abort();
      return true;
    }
    return false;
  }

  async downloadFile(key, filePath, onProgress) {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.toRemote(key) });
      const { Body, ContentLength } = await this.client.send(command);

      if (!Body) {
        throw new Error('未从服务端获得有效的对象流');
      }

      const writeStream = fs.createWriteStream(filePath);
      let downloadedBytes = 0;
      let lastProgressTime = 0;
      let lastDownloaded = 0;

      Body.on('data', chunk => {
        downloadedBytes += chunk.length;
        if (onProgress) {
          const progress = ContentLength ? Math.round((downloadedBytes / ContentLength) * 100) : 0;
          const now = Date.now();
          let speed = 0;
          if (now - lastProgressTime > 500) {
            const timeDiff = (now - lastProgressTime) / 1000;
            speed = timeDiff > 0 ? (downloadedBytes - lastDownloaded) / timeDiff : 0;
            lastProgressTime = now;
            lastDownloaded = downloadedBytes;
          }
          onProgress(progress, downloadedBytes, ContentLength, speed);
        }
      });

      Body.pipe(writeStream);

      await new Promise((resolve, reject) => {
        const handleError = err => {
          writeStream.end();
          reject(err);
        };
        writeStream.on('finish', resolve);
        writeStream.on('error', handleError);
        Body.on('error', handleError);
      });

      return { success: true };
    } catch (error) {
      const mapped = classifyS3Error(error);
      console.error(`[S3 API] 下载失败 ${key}:`, mapped.kind, error?.message);
      throw new Error(mapped.message);
    }
  }

  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: this.toRemote(key) });
      await this.client.send(command);
      return { success: true };
    } catch (error) {
      const mapped = classifyS3Error(error);
      throw new Error(mapped.message);
    }
  }

  async deleteFiles(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      return { success: true, deleted: [] };
    }

    const batchSize = 1000;
    const deleted = [];

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize).map(key => ({ Key: this.toRemote(key) }));
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: batch, Quiet: false }
      });
      const response = await this.client.send(command);
      if (response.Deleted) {
        deleted.push(...response.Deleted.map(obj => this.toLocal(obj.Key)));
      }
    }

    return { success: true, deleted };
  }

  async createFolder(prefix) {
    try {
      // 明确策略：写入零字节目录标记对象（与现有京东云适配器一致）
      const folderKey = prefix.endsWith('/') ? prefix : `${prefix}/`;
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.toRemote(folderKey),
        Body: new Uint8Array()
      });
      await this.client.send(command);
      return { success: true };
    } catch (error) {
      const mapped = classifyS3Error(error);
      throw new Error(mapped.message);
    }
  }

  async deleteFolder(prefix) {
    try {
      const folderKey = prefix.endsWith('/') ? prefix : `${prefix}/`;
      let continuationToken = undefined;
      const keysToDelete = [];

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.toRemote(folderKey),
          ContinuationToken: continuationToken
        });
        const response = await this.client.send(command);
        const batchKeys = response.Contents?.map(obj => this.toLocal(obj.Key)) || [];
        keysToDelete.push(...batchKeys);
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      if (keysToDelete.length > 0) {
        await this.deleteFiles(keysToDelete);
      }

      return { success: true, deleted: keysToDelete };
    } catch (error) {
      const mapped = classifyS3Error(error);
      throw new Error(mapped.message);
    }
  }

  /**
   * 移动（重命名）：复制成功后才删除源对象。
   */
  async moveObject(sourceKey, destinationKey) {
    try {
      const copySource = `/${this.bucket}/${encodeURIComponent(this.toRemote(sourceKey)).replace(/%2F/g, '/')}`;
      await this.client.send(new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: copySource,
        Key: this.toRemote(destinationKey)
      }));
      await this.deleteFile(sourceKey);
      return { success: true, data: { key: destinationKey } };
    } catch (error) {
      const mapped = classifyS3Error(error);
      throw new Error(mapped.message);
    }
  }

  async getStorageStats() {
    try {
      let totalCount = 0;
      let totalSize = 0;
      let continuationToken = undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.rootPrefix || undefined,
          ContinuationToken: continuationToken
        });
        const response = await this.client.send(command);
        totalCount += response.KeyCount || 0;
        totalSize += response.Contents?.reduce((acc, obj) => acc + (obj.Size || 0), 0) || 0;
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return { success: true, data: { totalCount, totalSize } };
    } catch (error) {
      const mapped = classifyS3Error(error);
      throw new Error(mapped.message);
    }
  }

  async getPresignedUrl(key, expiresIn = 900) {
    try {
      if (this.linkMode === 'public') {
        const publicUrl = this.getPublicUrl(key);
        if (publicUrl) return publicUrl;
      }
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.toRemote(key) });
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      const mapped = classifyS3Error(error);
      throw new Error(mapped.message);
    }
  }

  async getFileContent(key, maxSize = 1024 * 1024) {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: this.toRemote(key) });
      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('未获取到文件内容');
      }

      const contentLength = Number(response.ContentLength || 0);
      if (contentLength > maxSize) {
        if (typeof response.Body.destroy === 'function') {
          response.Body.destroy();
        }
        return { success: true, data: { tooLarge: true, size: contentLength } };
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
    } catch (error) {
      const mapped = classifyS3Error(error);
      throw new Error(mapped.message);
    }
  }

  async searchFiles(keyword, options = {}) {
    const lowerKeyword = keyword.toLowerCase();
    let continuationToken = undefined;
    const results = [];

    do {
      const response = await this.listFiles({ ...options, continuationToken });
      if (response.success) {
        const matched = response.data.files.filter(item => item.Key.toLowerCase().includes(lowerKeyword));
        results.push(...matched);
        continuationToken = response.data.nextContinuationToken;
      } else {
        break;
      }
    } while (continuationToken);

    return { success: true, data: { files: results, total: results.length } };
  }
}

export default S3Api;
export { PRESETS as S3_PRESETS, classifyS3Error };
