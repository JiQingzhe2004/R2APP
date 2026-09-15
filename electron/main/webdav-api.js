import http from 'http';
import https from 'https';
import fs from 'fs';
import { URL } from 'url';

/**
 * WebDAV 存储适配器（P1）
 *
 * 覆盖 Nextcloud（应用密码）、ownCloud 及开放 WebDAV 的 NAS。
 * 实现要点（见对接文档第 5 节）：
 *  - 目录列举使用 PROPFIND Depth:1，逐层加载，不做深度递归
 *  - 正确处理多状态 XML、目录项本身、尾斜杠与 URL 编码（逐段编码，避免重复编码）
 *  - 上传为普通 PUT（不代表断点续传），下载 GET 流式写入并回报进度
 *  - 建目录 MKCOL、删除 DELETE、移动/重命名 MOVE（Overwrite 头控制冲突行为）
 *  - 保持 TLS 校验；自签名 NAS 通过受信任 CA 配置（粘贴 PEM），不提供全局关闭校验的开关
 *  - 首期不提供通用公开分享链接
 */

const DEFAULT_TIMEOUT = 30000;

function classifyHttpError(status, extra = '') {
  if (status === 401) return { kind: 'auth', message: '认证失败：请检查用户名与密码（Nextcloud 请使用应用密码）' };
  if (status === 403) return { kind: 'forbidden', message: '权限不足：当前账号无权执行该操作' };
  if (status === 404) return { kind: 'not-found', message: '目标不存在：请检查地址与根目录配置' };
  if (status === 405) return { kind: 'conflict', message: '服务端不支持该操作或目标已存在' };
  if (status === 409) return { kind: 'conflict', message: '冲突：父目录不存在或同名冲突' };
  if (status === 412) return { kind: 'conflict', message: '同名冲突：目标已存在' };
  if (status === 423) return { kind: 'locked', message: '目标被锁定：文件可能正被其他客户端编辑' };
  if (status === 429) return { kind: 'throttled', message: '请求被限流，请稍后重试' };
  if (status === 507) return { kind: 'quota', message: '配额不足：服务端存储空间已满' };
  return { kind: 'http', message: `服务端返回错误状态码 ${status}${extra ? ` (${extra})` : ''}` };
}

// 逐段 URL 编码路径（保留 /），避免对已编码内容重复编码
function encodePath(path) {
  return path
    .split('/')
    .map(segment => (segment ? encodeURIComponent(segment) : ''))
    .join('/');
}

// 提取多状态 XML 中单个 <response> 块的文本值
function extractXmlValue(block, localName) {
  const re = new RegExp(`<(?:[A-Za-z0-9_.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_.-]+:)?${localName}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function parseMultiStatus(xmlBody) {
  const entries = [];
  const responseBlocks = xmlBody.match(/<(?:[A-Za-z0-9_.-]+:)?response\b[\s\S]*?<\/(?:[A-Za-z0-9_.-]+:)?response>/gi) || [];

  for (const block of responseBlocks) {
    let href = extractXmlValue(block, 'href');
    if (!href) continue;

    try {
      href = decodeURIComponent(href);
    } catch {
      // 个别服务可能给出非法编码，保留原值继续
    }

    const isDir = /<(?:[A-Za-z0-9_.-]+:)?collection\s*\/?\s*>/i.test(block) ||
      /<(?:[A-Za-z0-9_.-]+:)?resourcetype[^>]*>\s*<(?:[A-Za-z0-9_.-]+:)?collection/i.test(block);
    const sizeText = extractXmlValue(block, 'getcontentlength');
    const lastModified = extractXmlValue(block, 'getlastmodified');
    const contentType = extractXmlValue(block, 'getcontenttype');
    const etag = extractXmlValue(block, 'getetag');

    entries.push({
      href,
      isDir,
      size: sizeText ? parseInt(sizeText, 10) : null,
      lastModified: lastModified || null,
      contentType: contentType || null,
      etag: etag || null
    });
  }

  return entries;
}

class WebdavApi {
  constructor(config) {
    if (!config.baseUrl) {
      throw new Error('缺少 WebDAV 服务地址');
    }

    let base = config.baseUrl.trim();
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    this.baseUrl = base.replace(/\/+$/, '');

    // baseUrl 可能自带路径前缀（如 https://host/dav），列举结果需要剥离它
    this.basePath = new URL(this.baseUrl).pathname.replace(/\/+$/, '');

    const rootPath = (config.rootPath || '').trim();
    this.rootPath = rootPath ? `/${rootPath.replace(/^\/+|\/+$/, '')}` : '';

    this.username = config.username || '';
    this.password = config.password || '';
    this.timeout = (config.timeout && Number(config.timeout) > 0) ? Number(config.timeout) : DEFAULT_TIMEOUT;

    // 可选的受信任 CA（PEM 文本）。保持 rejectUnauthorized，不提供关闭校验的开关。
    this.ca = config.caText && config.caText.trim() ? config.caText.trim() : undefined;

    this.authHeader = 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64');

    // 进行中的上传请求，供取消使用
    this.activeUploads = new Map();
  }

  getCapabilities() {
    return {
      publicLink: false,
      presignedLink: false,
      copyLink: false,
      preview: true,
      move: true,
      share: false,
      stats: true,
      cancelUpload: true
    };
  }

  // ---- 路径换算 ----
  remotePath(key) {
    const clean = String(key).replace(/^\/+/, '');
    const full = `${this.rootPath}/${clean}`;
    return full.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  }

  toLocalPath(fullPath) {
    let p = fullPath;
    // 先剥离 baseUrl 自带路径，再剥离 rootPath
    if (this.basePath && p.startsWith(this.basePath)) {
      p = p.slice(this.basePath.length);
    }
    if (this.rootPath && p.startsWith(this.rootPath)) {
      p = p.slice(this.rootPath.length);
    }
    p = p.replace(/^\/+/, '');
    return p;
  }

  /**
   * 发送 WebDAV 请求并等待响应头，返回 { req, res }
   * @param {object} opts - { method, path, headers, body, bodyStream }
   *   body: 字符串/Buffer 请求体；bodyStream: 可读流（由本方法负责管道写入与结束）
   */
  request(opts) {
    return new Promise((resolve, reject) => {
      const target = new URL(this.baseUrl + encodePath(opts.path));
      const isHttps = target.protocol === 'https:';
      const transport = isHttps ? https : http;

      const req = transport.request(
        {
          hostname: target.hostname,
          port: target.port || (isHttps ? 443 : 80),
          path: target.pathname + (target.search || ''),
          method: opts.method,
          headers: {
            Authorization: this.authHeader,
            ...(opts.headers || {})
          },
          ...(isHttps && this.ca ? { ca: this.ca } : {})
        },
        res => resolve({ req, res })
      );

      req.setTimeout(this.timeout, () => {
        req.destroy(new Error('连接超时'));
      });
      req.on('error', reject);

      if (opts.bodyStream) {
        // 流式请求体（上传）：管道结束后由流自身结束请求，绝不提前 end()
        opts.bodyStream.pipe(req);
        opts.bodyStream.on('error', err => req.destroy(err));
      } else {
        if (opts.body) {
          req.write(opts.body);
        }
        req.end();
      }
    });
  }

  async propfind(path, depth = '1') {
    const body = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getcontenttype/><d:getetag/></d:prop></d:propfind>';
    const { res } = await this.request({
      method: 'PROPFIND',
      path,
      headers: {
        Depth: depth,
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      },
      body
    });

    if (res.statusCode === 404) {
      res.resume();
      return null;
    }
    if (res.statusCode !== 207 && res.statusCode !== 200) {
      const mapped = classifyHttpError(res.statusCode);
      res.resume();
      throw Object.assign(new Error(mapped.message), { kind: mapped.kind });
    }

    const chunks = [];
    for await (const chunk of res) chunks.push(Buffer.from(chunk));
    const xml = Buffer.concat(chunks).toString('utf-8');
    return parseMultiStatus(xml);
  }

  async listFiles(options = {}) {
    try {
      const prefix = options.prefix || '';
      const dirPath = this.remotePath(prefix);
      const entries = await this.propfind(dirPath, '1');

      if (entries === null) {
        return { success: true, data: { files: [], folders: [], nextContinuationToken: null } };
      }

      // 请求路径加上 baseUrl 前缀后与 href 对比，用于跳过目录项本身
      const selfPath = (this.basePath + decodeSafe(dirPath)).replace(/\/+$/, '');
      const files = [];
      const folders = [];

      for (const entry of entries) {
        // WebDAV href 可能是绝对 URL，去掉 scheme+host 保留路径
        let hrefPath = entry.href;
        try {
          if (/^https?:\/\//i.test(hrefPath)) {
            hrefPath = new URL(hrefPath).pathname;
          }
        } catch { /* 保留原值 */ }

        const decoded = decodeSafe(hrefPath);
        // 目录项本身：与请求路径完全一致，跳过
        if (decoded.replace(/\/+$/, '') === selfPath) {
          continue;
        }

        const local = this.toLocalPath(decoded).replace(/^\/+|\/+$/g, '');
        if (!local) continue;

        if (entry.isDir) {
          folders.push({ key: `${local}/`, isFolder: true });
        } else {
          files.push({
            Key: local,
            LastModified: entry.lastModified ? new Date(entry.lastModified) : null,
            Size: entry.size,
            ETag: entry.etag,
            ContentType: entry.contentType
          });
        }
      }

      return {
        success: true,
        data: {
          files,
          folders,
          nextContinuationToken: null
        }
      };
    } catch (error) {
      console.error('[WebDAV] 列举失败:', error.message);
      throw error;
    }
  }

  async listObjects(options = {}) {
    return this.listFiles(options);
  }

  async testConnection() {
    try {
      const entries = await this.propfind(this.remotePath(''), '0');
      if (entries === null) {
        return { success: false, error: '根目录不存在：请检查 baseUrl 与根目录（rootPath）配置', kind: 'not-found' };
      }
      return { success: true, message: 'WebDAV 连接成功！' };
    } catch (error) {
      console.error('[WebDAV] 连接测试失败:', error.message);
      if (error.cause?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || error.cause?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.cause?.code === 'CERT_HAS_EXPIRED' || /certificate/i.test(error.message)) {
        return { success: false, error: `证书校验失败: ${error.message}。如为自签名证书，请在配置中粘贴受信任的 CA 证书`, kind: 'tls' };
      }
      return { success: false, error: `WebDAV 连接失败: ${error.message}`, kind: error.kind || 'unknown' };
    }
  }

  async uploadFile(filePath, key, onProgress) {
    return new Promise((resolve, reject) => {
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (err) {
        reject(new Error(`无法读取本地文件: ${err.message}`));
        return;
      }
      const total = stat.size;
      let uploaded = 0;
      let settled = false;

      const settleReject = err => {
        if (settled) return;
        settled = true;
        this.activeUploads.delete(key);
        reject(err);
      };

      const readStream = fs.createReadStream(filePath, { highWaterMark: 512 * 1024 });

      readStream.on('data', chunk => {
        uploaded += chunk.length;
        if (onProgress && total > 0) {
          onProgress(Math.round((uploaded / total) * 100), uploaded, total);
        }
      });

      this.request({
        method: 'PUT',
        path: this.remotePath(key),
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': total
        },
        bodyStream: readStream
      })
        .then(({ req, res }) => {
          this.activeUploads.set(key, req);

          res.resume();
          res.on('end', () => {
            if (settled) return;
            settled = true;
            this.activeUploads.delete(key);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, data: { key } });
            } else if (res.statusCode === 423) {
              reject(new Error('目标被锁定：文件可能正被其他客户端编辑'));
            } else {
              const mapped = classifyHttpError(res.statusCode);
              reject(new Error(mapped.message));
            }
          });
          res.on('error', err => settleReject(err));
        })
        .catch(err => settleReject(err));
    });
  }

  abortUpload(key) {
    const req = this.activeUploads.get(key);
    if (req) {
      req.destroy(new Error('操作已取消'));
      this.activeUploads.delete(key);
      return true;
    }
    return false;
  }

  async downloadFile(key, filePath, onProgress) {
    try {
      const { res } = await this.request({ method: 'GET', path: this.remotePath(key) });

      if (res.statusCode !== 200) {
        res.resume();
        const mapped = classifyHttpError(res.statusCode);
        throw new Error(mapped.message);
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      const writeStream = fs.createWriteStream(filePath);
      let downloaded = 0;
      let lastTime = 0;
      let lastBytes = 0;

      res.on('data', chunk => {
        downloaded += chunk.length;
        if (onProgress) {
          const progress = total ? Math.round((downloaded / total) * 100) : 0;
          const now = Date.now();
          let speed = 0;
          if (now - lastTime > 500) {
            const dt = (now - lastTime) / 1000;
            speed = dt > 0 ? (downloaded - lastBytes) / dt : 0;
            lastTime = now;
            lastBytes = downloaded;
          }
          onProgress(progress, downloaded, total || null, speed);
        }
      });

      res.pipe(writeStream);

      await new Promise((resolve, reject) => {
        const handleError = err => {
          writeStream.end();
          reject(err);
        };
        writeStream.on('finish', resolve);
        writeStream.on('error', handleError);
        res.on('error', handleError);
      });

      return { success: true };
    } catch (error) {
      console.error(`[WebDAV] 下载失败 ${key}:`, error.message);
      throw error;
    }
  }

  async deleteFile(key) {
    const { res } = await this.request({ method: 'DELETE', path: this.remotePath(key) });
    res.resume();
    if (res.statusCode === 404) {
      return { success: true }; // 幂等删除
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { success: true };
    }
    const mapped = classifyHttpError(res.statusCode);
    throw new Error(mapped.message);
  }

  async deleteFiles(keys) {
    for (const key of keys || []) {
      await this.deleteFile(key);
    }
    return { success: true, deleted: keys || [] };
  }

  async createFolder(prefix) {
    const folderPath = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const { res } = await this.request({ method: 'MKCOL', path: this.remotePath(folderPath) });
    res.resume();

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { success: true };
    }
    if (res.statusCode === 405) {
      throw new Error('同名冲突：目录已存在');
    }
    if (res.statusCode === 409) {
      throw new Error('父目录不存在');
    }
    const mapped = classifyHttpError(res.statusCode);
    throw new Error(mapped.message);
  }

  /**
   * 移动/重命名：destination 为目标完整虚拟路径。
   * overwrite 为 false 时目标已存在将返回冲突错误。
   */
  async moveEntry(sourceKey, destinationKey, overwrite = false) {
    const destination = this.baseUrl + encodePath(this.remotePath(destinationKey));
    const { res } = await this.request({
      method: 'MOVE',
      path: this.remotePath(sourceKey),
      headers: {
        Destination: destination,
        Overwrite: overwrite ? 'T' : 'F'
      }
    });
    res.resume();

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { success: true, data: { key: destinationKey } };
    }
    const mapped = classifyHttpError(res.statusCode);
    throw new Error(mapped.message);
  }

  async copyEntry(sourceKey, destinationKey, overwrite = false) {
    const destination = this.baseUrl + encodePath(this.remotePath(destinationKey));
    const { res } = await this.request({
      method: 'COPY',
      path: this.remotePath(sourceKey),
      headers: {
        Destination: destination,
        Overwrite: overwrite ? 'T' : 'F'
      }
    });
    res.resume();

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { success: true, data: { key: destinationKey } };
    }
    const mapped = classifyHttpError(res.statusCode);
    throw new Error(mapped.message);
  }

  /**
   * 删除目录：WebDAV DELETE 对集合默认递归删除（RFC 4918）。
   */
  async deleteFolder(prefix) {
    return this.deleteFile(prefix);
  }

  async getFileContent(key, maxSize = 1024 * 1024) {
    const { res } = await this.request({ method: 'GET', path: this.remotePath(key) });

    if (res.statusCode !== 200) {
      res.resume();
      const mapped = classifyHttpError(res.statusCode);
      throw new Error(mapped.message);
    }

    const total = parseInt(res.headers['content-length'] || '0', 10);
    if (total > maxSize) {
      res.resume();
      return { success: true, data: { tooLarge: true, size: total } };
    }

    const chunks = [];
    let received = 0;
    for await (const chunk of res) {
      received += chunk.length;
      if (received > maxSize) {
        res.destroy();
        return { success: true, data: { tooLarge: true, size: total || received } };
      }
      chunks.push(Buffer.from(chunk));
    }

    return {
      success: true,
      data: {
        content: Buffer.concat(chunks).toString('utf-8'),
        size: received,
        tooLarge: false,
        contentType: res.headers['content-type']
      }
    };
  }

  /**
   * 存储统计：逐层遍历统计。NAS 目录可能很大，超过上限即停止并标注为部分结果。
   */
  async getStorageStats(maxEntries = 20000) {
    let totalCount = 0;
    let totalSize = 0;
    let truncated = false;
    const queue = [''];

    while (queue.length > 0) {
      if (totalCount >= maxEntries) {
        truncated = true;
        break;
      }
      const dir = queue.shift();
      const entries = await this.propfind(this.remotePath(dir), '1');
      if (!entries) continue;

      for (const entry of entries) {
        let hrefPath = entry.href;
        try {
          if (/^https?:\/\//i.test(hrefPath)) hrefPath = new URL(hrefPath).pathname;
        } catch { /* 保留原值 */ }
        const local = this.toLocalPath(decodeSafe(hrefPath));
        if (!local) continue;

        if (entry.isDir) {
          const clean = local.replace(/\/+$/, '');
          if (clean) queue.push(`${clean}/`);
        } else {
          totalCount += 1;
          totalSize += entry.size || 0;
        }
      }
    }

    return {
      success: true,
      data: {
        totalCount,
        totalSize,
        truncated,
        unsupported: false
      }
    };
  }

  async searchFiles(keyword, options = {}) {
    // WebDAV 无服务端搜索；限制遍历深度，避免拖慢 NAS
    const lower = keyword.toLowerCase();
    const results = [];
    const maxEntries = 5000;
    const maxDepth = 5;
    const queue = [{ dir: '', depth: 0 }];
    let count = 0;

    while (queue.length > 0) {
      if (count >= maxEntries) break;
      const { dir, depth } = queue.shift();
      const entries = await this.propfind(this.remotePath(dir), '1');
      if (!entries) continue;

      for (const entry of entries) {
        let hrefPath = entry.href;
        try {
          if (/^https?:\/\//i.test(hrefPath)) hrefPath = new URL(hrefPath).pathname;
        } catch { /* 保留原值 */ }
        const local = this.toLocalPath(decodeSafe(hrefPath));
        if (!local) continue;

        if (entry.isDir) {
          const clean = local.replace(/\/+$/, '');
          if (clean && depth < maxDepth) queue.push({ dir: `${clean}/`, depth: depth + 1 });
        } else {
          count += 1;
          if (local.toLowerCase().includes(lower)) {
            results.push({
              Key: local,
              LastModified: entry.lastModified ? new Date(entry.lastModified) : null,
              Size: entry.size,
              ETag: entry.etag
            });
          }
        }
      }
    }

    return { success: true, data: { files: results, total: results.length, truncated: count >= maxEntries } };
  }

  async fileExists(key) {
    const parent = this.remotePath(key).split('/').slice(0, -1).join('/') || '/';
    const name = this.remotePath(key).split('/').pop();
    const entries = await this.propfind(parent.endsWith('/') ? parent : `${parent}/`, '1');
    if (!entries) return false;
    return entries.some(e => {
      let hrefPath = e.href;
      try {
        if (/^https?:\/\//i.test(hrefPath)) hrefPath = new URL(hrefPath).pathname;
      } catch { /* 保留原值 */ }
      return decodeSafe(hrefPath).replace(/\/+$/, '').split('/').pop() === name;
    });
  }
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default WebdavApi;
