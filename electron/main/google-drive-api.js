import fs from 'fs';
import { saveSecret } from './secure-store.js';
import { getValidAccessToken } from './oauth-manager.js';

/**
 * Google Drive 存储适配器（P2）
 *
 * 基于 Google Drive API v3（注意：Google Drive 是网盘，与 GCS 对象存储不共用模型，
 * 见对接文档第 8 节）：
 *  - 按文件 ID 与父目录 ID 操作；同一目录允许同名项目，虚拟路径仅用于界面导航
 *  - 普通文件：列举、上传（resumable）、下载、移动、移入回收站；不做永久删除
 *  - Google 文档/表格/演示文稿按导出格式映射下载，不当作二进制直接下载
 *  - 第一阶段支持"我的云端硬盘"；共享云端硬盘调用带 supportsAllDrives 但不承诺可用
 *  - 大文件 resumable 上传，会话信息作为敏感数据处理（不写入日志）
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const CHUNK_SIZE = 5 * 1024 * 1024; // resumable 要求 256KB 的倍数

const GOOGLE_EXPORT_MAP = {
  'application/vnd.google-apps.document': {
    ext: '.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  'application/vnd.google-apps.spreadsheet': {
    ext: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  'application/vnd.google-apps.presentation': {
    ext: '.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  },
  'application/vnd.google-apps.drawing': {
    ext: '.png',
    mimeType: 'image/png'
  }
};

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function classifyGoogleError(status, body) {
  const message = body?.error?.message || `HTTP ${status}`;
  if (status === 401) return { kind: 'auth', message: `认证失败: ${message}` };
  if (status === 403) return { kind: 'forbidden', message: `权限不足（请检查 OAuth 权限范围与 Google API 配额）: ${message}` };
  if (status === 404) return { kind: 'not-found', message: `目标不存在: ${message}` };
  if (status === 429 || status === 500 || status === 503) {
    return { kind: 'throttled', message: `请求被限流或服务端暂时不可用: ${message}` };
  }
  return { kind: 'http', message };
}

class GoogleDriveApi {
  constructor(config) {
    if (!config.clientId) throw new Error('缺少 OAuth Client ID');
    if (!config.oauthTokens) throw new Error('尚未完成账号授权，请先在设置中登录');

    this.profileId = config.id || 'google-drive-default';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokens = config.oauthTokens;
    this.rootFolderId = config.rootFolderId || 'root';

    this.activeUploadControllers = new Map();
    this.idCache = new Map();
    this.idCache.set('', this.rootFolderId);
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

  async persistTokens(tokens) {
    this.tokens = tokens;
    try {
      saveSecret(`${this.profileId}:oauth-tokens`, JSON.stringify(tokens));
    } catch (error) {
      console.error('[GoogleDrive] 保存刷新令牌失败:', error.message);
    }
  }

  async getAccessToken() {
    return getValidAccessToken({
      provider: 'google-drive',
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      tokens: this.tokens,
      onTokensRefreshed: refreshed => this.persistTokens(refreshed)
    });
  }

  async driveRequest(method, url, { body, headers, rawResponse = false } = {}) {
    const token = await this.getAccessToken();
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && !(body instanceof Buffer) ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
        ...(headers || {})
      },
      body: body === undefined ? undefined : (body instanceof Buffer ? body : JSON.stringify(body))
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const mapped = classifyGoogleError(response.status, errorBody);
      const err = new Error(mapped.message);
      err.kind = mapped.kind;
      throw err;
    }

    if (rawResponse) return response;
    if (response.status === 204) return null;
    return response.json();
  }

  normalizeVirtualPath(key) {
    return String(key || '').replace(/^\/+|\/+$/g, '');
  }

  async folderIdForPath(virtualPath) {
    const clean = this.normalizeVirtualPath(virtualPath);
    if (this.idCache.has(clean)) return this.idCache.get(clean);
    if (!clean) return this.rootFolderId;

    const segments = clean.split('/').filter(Boolean);
    let currentPath = '';
    let parentId = this.rootFolderId;

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (this.idCache.has(currentPath)) {
        parentId = this.idCache.get(currentPath);
        continue;
      }
      const query = encodeURIComponent(
        `name = '${segment.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`
      );
      const page = await this.driveRequest(
        'GET',
        `${DRIVE_API}/files?q=${query}&fields=files(id,name,mimeType)&pageSize=10&supportsAllDrives=true`
      );
      const match = (page?.files || []).find(f => f.name === segment && f.mimeType === FOLDER_MIME);
      if (!match) {
        throw new Error(`目录不存在: ${currentPath}`);
      }
      parentId = match.id;
      this.idCache.set(currentPath, parentId);
    }
    return parentId;
  }

  async testConnection() {
    try {
      const about = await this.driveRequest(
        'GET',
        `${DRIVE_API}/about?fields=user,storageQuota`
      );
      const email = about?.user?.emailAddress || '';
      const quota = about?.storageQuota || {};
      let extra = '';
      if (quota.limit) {
        const usedGB = ((Number(quota.usage) || 0) / 1024 ** 3).toFixed(2);
        const totalGB = (Number(quota.limit) / 1024 ** 3).toFixed(2);
        extra = `（已用 ${usedGB} GB / ${totalGB} GB）`;
      }
      return { success: true, message: `Google Drive 连接成功！${email ? ' 账号: ' + email : ''}${extra}` };
    } catch (error) {
      console.error('[GoogleDrive] 连接测试失败:', error.message);
      return { success: false, error: `Google Drive 连接失败: ${error.message}`, kind: error.kind };
    }
  }

  async listFiles(options = {}) {
    try {
      const prefix = this.normalizeVirtualPath(options.prefix);
      const parentId = await this.folderIdForPath(prefix);

      const files = [];
      const folders = [];
      let pageToken = null;

      do {
        const query = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
        const fields = encodeURIComponent(
          'nextPageToken, files(id,name,mimeType,size,modifiedTime,fileExtension,driveId)'
        );
        const pageTokenPart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
        const page = await this.driveRequest(
          'GET',
          `${DRIVE_API}/files?q=${query}&fields=${fields}&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true${pageTokenPart}`
        );

        for (const item of page?.files || []) {
          const virtualKey = prefix ? `${prefix}/${item.name}` : item.name;
          this.idCache.set(virtualKey, item.id);

          if (item.mimeType === FOLDER_MIME) {
            folders.push({ key: `${virtualKey}/`, isFolder: true });
          } else {
            files.push({
              Key: virtualKey,
              LastModified: item.modifiedTime ? new Date(item.modifiedTime) : null,
              Size: item.size !== undefined ? Number(item.size) : null,
              ETag: null,
              ContentType: item.mimeType,
              googleMimeType: GOOGLE_EXPORT_MAP[item.mimeType] ? item.mimeType : null
            });
          }
        }

        pageToken = page?.nextPageToken || null;
      } while (pageToken);

      return { success: true, data: { files, folders, nextContinuationToken: null } };
    } catch (error) {
      console.error('[GoogleDrive] 列举失败:', error.message);
      throw error;
    }
  }

  async listObjects(options = {}) {
    return this.listFiles(options);
  }

  async uploadFile(filePath, key, onProgress) {
    const total = fs.statSync(filePath).size;
    const cleanPath = this.normalizeVirtualPath(key);
    const parentPath = cleanPath.split('/').slice(0, -1).join('/');
    const name = cleanPath.split('/').pop();
    const parentId = parentPath ? await this.folderIdForPath(parentPath) : this.rootFolderId;

    // resumable 会话
    const sessionResponse = await fetch(
      `${DRIVE_UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.getAccessToken()}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/octet-stream',
          'X-Upload-Content-Length': total
        },
        body: JSON.stringify({
          name,
          ...(parentId && parentId !== 'root' ? { parents: [parentId] } : {})
        })
      }
    );

    if (!sessionResponse.ok) {
      const errorBody = await sessionResponse.json().catch(() => ({}));
      const mapped = classifyGoogleError(sessionResponse.status, errorBody);
      throw new Error(mapped.message);
    }

    // 会话 URL 属于敏感数据（无鉴权即可续传），仅保存在内存
    const sessionUrl = sessionResponse.headers.get('location');
    if (!sessionUrl) throw new Error('创建上传会话失败');

    const controller = new AbortController();
    this.activeUploadControllers.set(key, controller);
    const fileHandle = await fs.promises.open(filePath, 'r');

    try {
      let offset = 0;
      while (offset < total) {
        if (controller.signal.aborted) throw new Error('操作已取消');
        const size = Math.min(CHUNK_SIZE, total - offset);
        const chunk = Buffer.alloc(size);
        const { bytesRead } = await fileHandle.read(chunk, 0, size, offset);
        const payload = bytesRead === size ? chunk : chunk.subarray(0, bytesRead);
        const isFinal = offset + bytesRead >= total;

        const response = await fetch(sessionUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': bytesRead,
            'Content-Range': `bytes ${offset}-${offset + bytesRead - 1}/${total}`
          },
          body: payload,
          signal: controller.signal
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const mapped = classifyGoogleError(response.status, errorBody);
          throw new Error(mapped.message);
        }

        offset += bytesRead;
        if (onProgress && total > 0) {
          onProgress(Math.round((offset / total) * 100), offset, total);
        }
        if (isFinal) {
          await response.arrayBuffer().catch(() => {});
          break;
        } else {
          await response.arrayBuffer().catch(() => {});
        }
      }

      return { success: true, data: { key } };
    } catch (error) {
      // 中止会话：不带内容的 DELETE 结束 resumable 会话
      fetch(sessionUrl, { method: 'DELETE' }).catch(() => {});
      if (error.name === 'AbortError') {
        const cancelErr = new Error('操作已取消');
        cancelErr.kind = 'cancelled';
        throw cancelErr;
      }
      throw error;
    } finally {
      await fileHandle.close().catch(() => {});
      this.activeUploadControllers.delete(key);
    }
  }

  abortUpload(key) {
    const controller = this.activeUploadControllers.get(key);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  /**
   * 下载。Google 文档/表格/演示文稿不能直接下载二进制，
   * 按导出格式映射转换（docx/xlsx/pptx/png）。
   */
  async downloadFile(key, filePath, onProgress, options = {}) {
    const cleanPath = this.normalizeVirtualPath(key);
    const itemId = this.idCache.get(cleanPath) || (await this.folderIdForPath(cleanPath));
    const meta = await this.driveRequest(
      'GET',
      `${DRIVE_API}/files/${itemId}?fields=id,name,mimeType,size&supportsAllDrives=true`
    );

    let url;
    let fileName = options.fileName || '';
    if (GOOGLE_EXPORT_MAP[meta.mimeType]) {
      const exportSpec = GOOGLE_EXPORT_MAP[meta.mimeType];
      url = `${DRIVE_API}/files/${itemId}/export?mimeType=${encodeURIComponent(exportSpec.mimeType)}`;
      if (!fileName) {
        fileName = meta.name.endsWith(exportSpec.ext) ? meta.name : meta.name + exportSpec.ext;
      }
    } else {
      url = `${DRIVE_API}/files/${itemId}?alt=media&supportsAllDrives=true`;
    }

    const response = await this.driveRequest('GET', url, { rawResponse: true });
    const total = Number(response.headers.get('content-length')) || 0;
    const writeStream = fs.createWriteStream(filePath);
    let downloaded = 0;

    for await (const chunk of response.body) {
      downloaded += chunk.length;
      writeStream.write(Buffer.from(chunk));
      if (onProgress) {
        const progress = total ? Math.round((downloaded / total) * 100) : 0;
        onProgress(progress, downloaded, total || null);
      }
    }

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    writeStream.end();

    return { success: true, data: { fileName } };
  }

  /**
   * 移入回收站（首期默认删除语义）；永久删除不作为默认行为。
   */
  async deleteFile(key) {
    const cleanPath = this.normalizeVirtualPath(key);
    const itemId = this.idCache.get(cleanPath) || (await this.folderIdForPath(cleanPath));
    await this.driveRequest('PATCH', `${DRIVE_API}/files/${itemId}?supportsAllDrives=true`, {
      body: { trashed: true }
    });
    return { success: true };
  }

  async deleteFiles(keys) {
    for (const key of keys || []) {
      await this.deleteFile(key);
    }
    return { success: true, deleted: keys || [] };
  }

  async deleteFolder(prefix) {
    return this.deleteFile(prefix);
  }

  async createFolder(prefix) {
    const clean = this.normalizeVirtualPath(prefix);
    const parentPath = clean.split('/').slice(0, -1).join('/');
    const name = clean.split('/').pop();
    const parentId = parentPath ? await this.folderIdForPath(parentPath) : this.rootFolderId;

    const created = await this.driveRequest('POST', `${DRIVE_API}/files?supportsAllDrives=true&fields=id,name`, {
      body: {
        name,
        mimeType: FOLDER_MIME,
        ...(parentId && parentId !== 'root' ? { parents: [parentId] } : {})
      }
    });

    const virtualKey = parentPath ? `${parentPath}/${name}` : name;
    if (created?.id) this.idCache.set(virtualKey, created.id);
    return { success: true };
  }

  /**
   * 移动/重命名：PATCH name / addParents / removeParents。
   */
  async moveEntry(sourceKey, destinationKey) {
    const sourceClean = this.normalizeVirtualPath(sourceKey);
    const destClean = this.normalizeVirtualPath(destinationKey);
    const itemId = this.idCache.get(sourceClean) || (await this.folderIdForPath(sourceClean));

    const sourceParent = sourceClean.split('/').slice(0, -1).join('/');
    const destParent = destClean.split('/').slice(0, -1).join('/');
    const newName = destClean.split('/').pop();

    const body = {};
    const params = new URLSearchParams({ supportsAllDrives: 'true', fields: 'id,name,parents' });

    if (newName !== sourceClean.split('/').pop()) {
      body.name = newName;
    }

    if (destParent !== sourceParent) {
      const destParentId = destParent ? await this.folderIdForPath(destParent) : this.rootFolderId;
      body.addParents = destParentId;
      const sourceParentId = sourceParent ? await this.folderIdForPath(sourceParent) : this.rootFolderId;
      body.removeParents = sourceParentId;
    }

    await this.driveRequest('PATCH', `${DRIVE_API}/files/${itemId}?${params.toString()}`, { body });

    this.idCache.delete(sourceClean);
    this.idCache.set(destClean, itemId);
    return { success: true, data: { key: destinationKey } };
  }

  async getFileContent(key, maxSize = 1024 * 1024) {
    const cleanPath = this.normalizeVirtualPath(key);
    const itemId = this.idCache.get(cleanPath) || (await this.folderIdForPath(cleanPath));
    const meta = await this.driveRequest(
      'GET',
      `${DRIVE_API}/files/${itemId}?fields=id,mimeType,size&supportsAllDrives=true`
    );

    if (Number(meta.size || 0) > maxSize) {
      return { success: true, data: { tooLarge: true, size: Number(meta.size) } };
    }

    let url;
    if (GOOGLE_EXPORT_MAP[meta.mimeType]) {
      url = `${DRIVE_API}/files/${itemId}/export?mimeType=${encodeURIComponent(GOOGLE_EXPORT_MAP[meta.mimeType].mimeType)}`;
    } else {
      url = `${DRIVE_API}/files/${itemId}?alt=media&supportsAllDrives=true`;
    }

    const response = await this.driveRequest('GET', url, { rawResponse: true });
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
    const about = await this.driveRequest('GET', `${DRIVE_API}/about?fields=storageQuota`);
    const quota = about?.storageQuota || {};
    return {
      success: true,
      data: {
        totalCount: null,
        totalSize: Number(quota.usage) || null,
        quotaTotal: Number(quota.limit) || null,
        unsupported: false
      }
    };
  }

  async searchFiles(keyword) {
    const files = [];
    let pageToken = null;

    do {
      const query = encodeURIComponent(
        `name contains '${keyword.replace(/'/g, "\\'")}' and trashed = false`
      );
      const fields = encodeURIComponent('nextPageToken, files(id,name,mimeType,size,modifiedTime,parents)');
      const pageTokenPart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const page = await this.driveRequest(
        'GET',
        `${DRIVE_API}/files?q=${query}&fields=${fields}&pageSize=100&supportsAllDrives=true${pageTokenPart}`
      );

      for (const item of page?.files || []) {
        if (item.mimeType === FOLDER_MIME) continue;
        files.push({
          Key: item.name,
          LastModified: item.modifiedTime ? new Date(item.modifiedTime) : null,
          Size: item.size !== undefined ? Number(item.size) : null,
          ETag: null,
          fileId: item.id
        });
      }

      pageToken = page?.nextPageToken || null;
    } while (pageToken);

    return { success: true, data: { files, total: files.length } };
  }
}

export default GoogleDriveApi;
export { GOOGLE_EXPORT_MAP };
