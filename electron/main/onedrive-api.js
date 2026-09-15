import fs from 'fs';
import { saveSecret } from './secure-store.js';
import { getValidAccessToken } from './oauth-manager.js';

/**
 * OneDrive / SharePoint 存储适配器（P2）
 *
 * 基于 Microsoft Graph v1.0，个人 OneDrive、企业 OneDrive 与 SharePoint 文档库
 * 通过 resourceKind 与 driveId/siteId 区分（见对接文档第 7 节）：
 *  - 系统浏览器 OAuth（PKCE），令牌由 oauth-manager + secure-store 在主进程管理
 *  - 业务引用使用虚拟路径 ↔ itemId 映射（缓存），重命名不改变 itemId
 *  - 大文件使用上传会话（createUploadSession），处理会话取消与限流（Retry-After）
 *  - 下载地址为短期授权 URL，不作为永久公开链接保存；首期不提供通用分享
 *  - 删除使用平台正常删除语义（可从回收站恢复，由服务端策略决定）
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';
const CHUNK_SIZE = 5 * 1024 * 1024; // 上传会话要求的 5 MiB 整数倍分片
const MAX_RETRIES = 3;

function classifyGraphError(status, body, retryAfter) {
  const message = body?.error?.message || `HTTP ${status}`;
  if (status === 401) return { kind: 'auth', message: `认证失败: ${message}` };
  if (status === 403) return { kind: 'forbidden', message: `权限不足（可能需要管理员批准或未授予对应权限）: ${message}` };
  if (status === 404) return { kind: 'not-found', message: `目标不存在: ${message}` };
  if (status === 409 || status === 412) return { kind: 'conflict', message: `同名冲突: ${message}` };
  if (status === 429 || status === 503) {
    return { kind: 'throttled', message: `请求被限流: ${message}`, retryAfter: retryAfter ? Number(retryAfter) : 5 };
  }
  if (status === 507) return { kind: 'quota', message: `OneDrive 配额不足: ${message}` };
  return { kind: 'http', message };
}

class OneDriveApi {
  constructor(config) {
    if (!config.clientId) throw new Error('缺少 Client ID');
    if (!config.oauthTokens) throw new Error('尚未完成账号授权，请先在设置中登录');

    this.profileId = config.id || 'onedrive-default';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenantType = config.tenantType || 'common';
    this.resourceKind = config.resourceKind || 'personal'; // personal | business | sharepoint
    this.driveId = config.driveId || '';
    this.siteId = config.siteId || '';
    this.tokens = config.oauthTokens;

    this.activeUploadSessions = new Map(); // key -> session url
    // 虚拟路径 -> itemId 缓存（实例级；列表操作时填充）
    this.idCache = new Map();
    this.idCache.set('', 'root');
  }

  getCapabilities() {
    return {
      publicLink: false,
      presignedLink: true, // 短期授权 URL（跟随 302 解析），仅用于预览，不作为永久链接保存
      copyLink: false,
      preview: true,
      move: true,
      share: false,
      stats: true,
      cancelUpload: true
    };
  }

  async persistTokens(tokens) {
    this.tokens = tokens;
    try {
      saveSecret(`${this.profileId}:oauth-tokens`, JSON.stringify(tokens));
    } catch (error) {
      console.error('[OneDrive] 保存刷新令牌失败:', error.message);
    }
  }

  async getAccessToken() {
    return getValidAccessToken({
      provider: 'onedrive',
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      tenantType: this.tenantType,
      tokens: this.tokens,
      onTokensRefreshed: refreshed => this.persistTokens(refreshed)
    });
  }

  async driveBase() {
    if (this.driveId) return `${GRAPH}/drives/${this.driveId}`;
    if (this.resourceKind === 'sharepoint') {
      if (!this.siteId) {
        throw new Error('SharePoint 资源需要提供 siteId（文档库所属站点）');
      }
      return `${GRAPH}/sites/${this.siteId}/drive`;
    }
    return `${GRAPH}/me/drive`;
  }

  async graphRequest(method, path, { body, headers, rawResponse = false, signal } = {}) {
    const token = await this.getAccessToken();
    let attempt = 0;

    // 429/503 按 Retry-After 退避重试
    for (;;) {
      attempt += 1;
      const response = await fetch(path.startsWith('http') ? path : `${GRAPH}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}),
          ...(headers || {})
        },
        body: body === undefined ? undefined : (body instanceof Buffer ? body : JSON.stringify(body)),
        signal
      });

      if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers.get('retry-after')) || attempt * 2;
        await response.arrayBuffer().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const mapped = classifyGraphError(response.status, errorBody, response.headers.get('retry-after'));
        const err = new Error(mapped.message);
        err.kind = mapped.kind;
        throw err;
      }

      if (rawResponse) return response;
      if (response.status === 204) return null;
      return response.json();
    }
  }

  // ---- 虚拟路径（'a/b' 形式，目录以 '/' 结尾的 key 传入前会去掉尾斜杠）----
  normalizeVirtualPath(key) {
    return String(key || '').replace(/^\/+|\/+$/g, '');
  }

  async itemIdForPath(virtualPath) {
    const clean = this.normalizeVirtualPath(virtualPath);
    if (this.idCache.has(clean)) return this.idCache.get(clean);

    const base = await this.driveBase();
    const segments = clean.split('/').filter(Boolean);
    let currentPath = '';
    let itemId = 'root';

    // 逐段解析并缓存，路径缓存命中时跳过
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (this.idCache.has(currentPath)) {
        itemId = this.idCache.get(currentPath);
        continue;
      }
      const encoded = encodeURIComponent(currentPath);
      const item = await this.graphRequest('GET', `${base}/root:/${encoded}?$select=id`);
      itemId = item.id;
      this.idCache.set(currentPath, itemId);
    }
    return itemId;
  }

  async testConnection() {
    try {
      const base = await this.driveBase();
      const drive = await this.graphRequest('GET', base);
      const owner = drive?.owner?.user?.displayName || drive?.description || '';
      const quota = drive?.quota;
      let extra = '';
      if (quota?.total) {
        const usedGB = ((quota.used || 0) / 1024 ** 3).toFixed(2);
        const totalGB = (quota.total / 1024 ** 3).toFixed(2);
        extra = `（已用 ${usedGB} GB / ${totalGB} GB）`;
      }
      return { success: true, message: `OneDrive 连接成功！${owner ? ' 账号: ' + owner : ''}${extra}` };
    } catch (error) {
      console.error('[OneDrive] 连接测试失败:', error.message);
      return { success: false, error: `OneDrive 连接失败: ${error.message}`, kind: error.kind };
    }
  }

  async listFiles(options = {}) {
    try {
      const prefix = this.normalizeVirtualPath(options.prefix);
      const base = await this.driveBase();
      const encoded = prefix ? encodeURIComponent(prefix) : '';
      const childrenPath = prefix
        ? `${base}/root:/${encoded}:/children`
        : `${base}/root/children`;

      const files = [];
      const folders = [];
      let nextLink = childrenPath;

      // Graph 用 @odata.nextLink 翻页，全部取回后交给 UI 统一处理
      while (nextLink) {
        const page = await this.graphRequest('GET', nextLink);
        const items = page?.value || [];

        for (const item of items) {
          const virtualKey = prefix ? `${prefix}/${item.name}` : item.name;
          this.idCache.set(virtualKey, item.id);
          if (item.folder) {
            folders.push({ key: `${virtualKey}/`, isFolder: true });
          } else {
            files.push({
              Key: virtualKey,
              LastModified: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : null,
              Size: item.size,
              ETag: item.eTag || null,
              ContentType: item.file?.mimeType || null,
              createdDateTime: item.createdDateTime
            });
          }
        }

        nextLink = page?.['@odata.nextLink'] || null;
      }

      return { success: true, data: { files, folders, nextContinuationToken: null } };
    } catch (error) {
      console.error('[OneDrive] 列举失败:', error.message);
      throw error;
    }
  }

  async listObjects(options = {}) {
    return this.listFiles(options);
  }

  async uploadFile(filePath, key, onProgress) {
    const base = await this.driveBase();
    const cleanPath = this.normalizeVirtualPath(key);
    const encoded = encodeURIComponent(cleanPath);
    const total = fs.statSync(filePath).size;

    // 冲突策略首期与对象存储保持一致：覆盖（replace）
    const session = await this.graphRequest('POST', `${base}/root:/${encoded}:/createUploadSession`, {
      body: { item: { '@microsoft.graph.conflictBehavior': 'replace' } }
    });

    const uploadUrl = session?.uploadUrl;
    if (!uploadUrl) throw new Error('创建上传会话失败');
    this.activeUploadSessions.set(key, uploadUrl);

    const controller = new AbortController();
    this.activeUploadControllers = this.activeUploadControllers || new Map();
    this.activeUploadControllers.set(key, controller);

    const fileHandle = await fs.promises.open(filePath, 'r');
    try {
      let offset = 0;
      const buffer = Buffer.alloc(Math.min(CHUNK_SIZE, total) || CHUNK_SIZE);

      while (offset < total) {
        if (controller.signal.aborted) throw new Error('操作已取消');
        const size = Math.min(CHUNK_SIZE, total - offset);
        const chunk = Buffer.alloc(size);
        const { bytesRead } = await fileHandle.read(chunk, 0, size, offset);
        const payload = bytesRead === size ? chunk : chunk.subarray(0, bytesRead);

        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Range': `bytes ${offset}-${offset + bytesRead - 1}/${total}`,
            'Content-Length': bytesRead
          },
          body: payload,
          signal: controller.signal
        });

        if (!response.ok && response.status !== 202 && response.status !== 201 && response.status !== 200) {
          const errorBody = await response.json().catch(() => ({}));
          const mapped = classifyGraphError(response.status, errorBody, response.headers.get('retry-after'));
          throw new Error(mapped.message);
        }

        offset += bytesRead;
        if (onProgress && total > 0) {
          onProgress(Math.round((offset / total) * 100), offset, total);
        }
      }

      return { success: true, data: { key } };
    } catch (error) {
      // 会话清理：取消或失败时删除会话，释放服务端资源
      fetch(uploadUrl, { method: 'DELETE' }).catch(() => {});
      if (error.name === 'AbortError') {
        const cancelErr = new Error('操作已取消');
        cancelErr.kind = 'cancelled';
        throw cancelErr;
      }
      throw error;
    } finally {
      await fileHandle.close().catch(() => {});
      this.activeUploadSessions.delete(key);
      this.activeUploadControllers?.delete(key);
    }
  }

  abortUpload(key) {
    const controller = this.activeUploadControllers?.get(key);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  async downloadFile(key, filePath, onProgress) {
    const base = await this.driveBase();
    const itemId = await this.itemIdForPath(key);
    const response = await this.graphRequest('GET', `${base}/items/${itemId}/content`, { rawResponse: true });

    if (!response.ok) {
      const mapped = classifyGraphError(response.status, null, null);
      throw new Error(mapped.message);
    }

    const total = Number(response.headers.get('content-length')) || 0;
    const writeStream = fs.createWriteStream(filePath);
    let downloaded = 0;
    let lastTime = 0;
    let lastBytes = 0;

    for await (const chunk of response.body) {
      downloaded += chunk.length;
      writeStream.write(Buffer.from(chunk));
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
    }

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    writeStream.end();

    return { success: true };
  }

  async deleteFile(key) {
    const base = await this.driveBase();
    const itemId = await this.itemIdForPath(key);
    await this.graphRequest('DELETE', `${base}/items/${itemId}`);
    return { success: true };
  }

  async deleteFiles(keys) {
    for (const key of keys || []) {
      await this.deleteFile(key);
    }
    return { success: true, deleted: keys || [] };
  }

  async createFolder(prefix) {
    const base = await this.driveBase();
    const clean = this.normalizeVirtualPath(prefix);
    const parentPath = clean.split('/').slice(0, -1).join('/');
    const name = clean.split('/').pop();

    let endpoint;
    let parentItemId;
    if (parentPath) {
      parentItemId = await this.itemIdForPath(parentPath);
      endpoint = `${base}/items/${parentItemId}/children`;
    } else {
      endpoint = `${base}/root/children`;
    }

    try {
      const created = await this.graphRequest('POST', endpoint, {
        body: { name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }
      });
      const virtualKey = parentPath ? `${parentPath}/${name}` : name;
      if (created?.id) this.idCache.set(virtualKey, created.id);
      return { success: true };
    } catch (error) {
      if (error.kind === 'conflict') {
        throw new Error(`同名冲突：目录 "${name}" 已存在`);
      }
      throw error;
    }
  }

  async deleteFolder(prefix) {
    return this.deleteFile(prefix);
  }

  /**
   * 移动/重命名：PATCH addParents/removeParents 或改 name。
   * destination 为目标虚拟路径（含新名称）。
   */
  async moveEntry(sourceKey, destinationKey) {
    const base = await this.driveBase();
    const itemId = await this.itemIdForPath(sourceKey);
    const sourceClean = this.normalizeVirtualPath(sourceKey);
    const destClean = this.normalizeVirtualPath(destinationKey);
    const destParent = destClean.split('/').slice(0, -1).join('/');
    const newName = destClean.split('/').pop();

    const body = {};
    if (newName !== sourceClean.split('/').pop()) {
      body.name = newName;
    }

    if (destParent !== sourceClean.split('/').slice(0, -1).join('/')) {
      const parentItemId = destParent ? await this.itemIdForPath(destParent) : 'root';
      body.parentReference = { id: parentItemId };
    }

    await this.graphRequest('PATCH', `${base}/items/${itemId}`, { body });

    this.idCache.delete(sourceClean);
    this.idCache.set(destClean, itemId);
    return { success: true, data: { key: destinationKey } };
  }

  async getFileContent(key, maxSize = 1024 * 1024) {
    const base = await this.driveBase();
    const itemId = await this.itemIdForPath(key);
    const item = await this.graphRequest('GET', `${base}/items/${itemId}?$select=size,content.downloadUrl`);
    if ((item?.size || 0) > maxSize) {
      return { success: true, data: { tooLarge: true, size: item.size } };
    }

    const response = await this.graphRequest('GET', `${base}/items/${itemId}/content`, { rawResponse: true });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      success: true,
      data: {
        content: buffer.toString('utf-8'),
        size: buffer.length,
        tooLarge: false
      }
    };
  }

  async getStorageStats() {
    const base = await this.driveBase();
    const drive = await this.graphRequest('GET', base);
    const quota = drive?.quota || {};
    return {
      success: true,
      data: {
        totalCount: null,
        totalSize: quota.used || null,
        quotaTotal: quota.total || null,
        quotaState: quota.state || null,
        unsupported: false
      }
    };
  }

  /**
   * 短期授权下载 URL：请求 /content 并跟随 302，把最终预授权地址交给渲染进程。
   * 该地址短期有效，仅用于预览，不作为永久公开链接保存。
   */
  async getPresignedUrl(key, _expiresIn = 900) {
    const base = await this.driveBase();
    const itemId = await this.itemIdForPath(key);
    const response = await this.graphRequest('GET', `${base}/items/${itemId}/content`, { rawResponse: true });
    // 释放响应体，只保留最终 URL
    await response.arrayBuffer().catch(() => {});
    return response.url || null;
  }

  async searchFiles(keyword) {
    const base = await this.driveBase();
    const files = [];
    let nextLink = `${base}/root/search(q='${encodeURIComponent(keyword)}')`;

    while (nextLink) {
      const page = await this.graphRequest('GET', nextLink);
      for (const item of page?.value || []) {
        if (item.folder || item.deleted) continue;
        const parentPath = item.parentReference?.path || '';
        // parentReference.path 形如 /drives/{id}/root:/子路径
        const relativeParent = parentPath.split('root:')[1] || '';
        const virtualKey = [relativeParent.replace(/^\/+/, ''), item.name].filter(Boolean).join('/');
        this.idCache.set(virtualKey, item.id);
        files.push({
          Key: virtualKey,
          LastModified: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : null,
          Size: item.size,
          ETag: item.eTag || null
        });
      }
      nextLink = page?.['@odata.nextLink'] || null;
    }

    return { success: true, data: { files, total: files.length } };
  }
}

export default OneDriveApi;
