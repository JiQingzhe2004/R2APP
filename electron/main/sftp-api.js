import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { Client } from 'ssh2';

/**
 * SFTP 存储适配器（P1）
 *
 * 基于 ssh2 的 SFTP 子系统，覆盖 Linux 服务器与开放 SFTP 的 NAS。
 * 实现要点（见对接文档第 6 节）：
 *  - 密码或私钥认证（私钥口令支持），私钥文件由主进程读取，UI 只展示路径
 *  - 首次连接呈现主机指纹，由用户核对并信任后保存；指纹变化时阻止自动连接
 *  - 远端路径使用 POSIX 规则，不与本地 Windows 路径共用 path.join
 *  - 递归删除使用 lstat 判定，不跟随符号链接进入其他目录
 *  - 上传先写远端临时文件，完成后再重命名（原子性取决于服务器）
 *  - 独立连接管理、超时与显式关闭；连接按配置 ID 缓存，账号切换不串用
 */

const DEFAULT_TIMEOUT = 20000;

class HostKeyError extends Error {
  constructor(kind, fingerprint, host) {
    super(
      kind === 'changed'
        ? `主机指纹已变化，为安全起见已中止连接。当前指纹: ${fingerprint}。如确认服务器合法，请在设置中更新受信任指纹。`
        : `首次连接，请核对并信任服务器主机指纹: ${fingerprint}`
    );
    this.name = 'HostKeyError';
    this.kind = kind; // 'unverified' | 'changed'
    this.fingerprint = fingerprint;
    this.host = host;
  }
}

function classifySshError(error) {
  const message = error?.message || String(error);
  if (error instanceof HostKeyError) {
    return { kind: error.kind, message, fingerprint: error.fingerprint };
  }
  if (error?.level === 'client-auth' || /authentication|All configured authentication methods failed/i.test(message)) {
    return { kind: 'auth', message: '认证失败：请检查用户名、密码或私钥（及口令）是否正确' };
  }
  if (/ECONNREFUSED/.test(message)) {
    return { kind: 'network', message: '连接被拒绝：目标端口未开放或 SSH 服务未运行' };
  }
  if (/ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|getaddrinfo/i.test(message) || /timed out/i.test(message)) {
    return { kind: 'network', message: `网络错误：无法连接到服务器 (${message})` };
  }
  if (/permission denied/i.test(message)) {
    return { kind: 'forbidden', message: '权限不足：服务器拒绝了该操作' };
  }
  if (/No such file/i.test(message)) {
    return { kind: 'not-found', message: '目标不存在' };
  }
  if (/failure/i.test(message) && error?.code === 4) {
    return { kind: 'unknown', message: `服务器返回失败: ${message}` };
  }
  if (error?.kind) {
    return { kind: error.kind, message };
  }
  return { kind: 'unknown', message };
}

function computeFingerprint(keyBuffer) {
  const hash = crypto.createHash('sha256').update(keyBuffer).digest('base64').replace(/=+$/, '');
  return `SHA256:${hash}`;
}

function posixJoin(...parts) {
  const joined = parts
    .filter(p => p !== undefined && p !== null && p !== '')
    .join('/')
    .replace(/\/{2,}/g, '/');
  return joined || '/';
}

function posixDirname(p) {
  const idx = p.lastIndexOf('/');
  if (idx <= 0) return '/';
  return p.slice(0, idx);
}

function posixBasename(p) {
  return p.split('/').pop() || p;
}

class SftpApi {
  constructor(config) {
    if (!config.host) throw new Error('缺少主机地址');
    if (!config.username) throw new Error('缺少用户名');

    this.profileId = config.id || 'default';
    this.host = config.host;
    this.port = Number(config.port) > 0 ? Number(config.port) : 22;
    this.username = config.username;
    this.authMode = config.authMode === 'key' ? 'key' : 'password';
    this.password = this.authMode === 'password' ? config.password : undefined;
    this.privateKeyPath = config.privateKeyPath;
    this.passphrase = config.passphrase;
    this.rootPath = (config.rootPath || '').trim() || '/';
    if (!this.rootPath.startsWith('/')) this.rootPath = `/${this.rootPath}`;
    this.timeout = (config.timeout && Number(config.timeout) > 0) ? Number(config.timeout) : DEFAULT_TIMEOUT;
    this.trustedFingerprint = config.trustedFingerprint || '';
    this.readyTimeout = config.readyTimeout || DEFAULT_TIMEOUT;

    this.client = null;
    this.sftp = null;
    this.connectPromise = null;
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

  readPrivateKey() {
    if (!this.privateKeyPath) {
      throw new Error('已选择私钥认证，但未配置私钥文件路径');
    }
    // 主进程读取私钥内容，不经过渲染进程
    return fs.readFileSync(this.resolveHomePath(this.privateKeyPath), 'utf8');
  }

  resolveHomePath(p) {
    if (p.startsWith('~')) {
      return path.join(os.homedir(), p.slice(1).replace(/^[/\\]/, ''));
    }
    return p;
  }

  /**
   * 获取（或建立）SFTP 连接。指纹校验始终执行。
   */
  async getConnection() {
    if (this.client && this.sftp) {
      return this.sftp;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connect();
    try {
      const sftp = await this.connectPromise;
      return sftp;
    } finally {
      this.connectPromise = null;
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      const client = new Client();

      const cleanup = () => {
        this.client = null;
        this.sftp = null;
      };

      client.on('error', err => {
        cleanup();
        // hostVerifier 拒绝时优先抛出指纹错误（ssh2 会先发出通用握手错误）
        const source = client.__rejectWith || err;
        client.__rejectWith = null;
        const mapped = classifySshError(source);
        const wrapped = new Error(mapped.message);
        wrapped.kind = mapped.kind;
        if (source.fingerprint) wrapped.fingerprint = source.fingerprint;
        reject(wrapped);
      });

      client.on('close', () => {
        cleanup();
      });

      const authConfig = {
        host: this.host,
        port: this.port,
        username: this.username,
        readyTimeout: this.readyTimeout,
        keepaliveInterval: 10000,
        // 指纹校验：计算 SHA256 指纹并与受信任值比较，不匹配则拒绝连接
        hostVerifier: keyInfo => {
          const fingerprint = computeFingerprint(keyInfo.key);
          client.__serverFingerprint = fingerprint;
          if (!this.trustedFingerprint) {
            client.__rejectWith = new HostKeyError('unverified', fingerprint, this.host);
            return false;
          }
          if (this.trustedFingerprint !== fingerprint) {
            client.__rejectWith = new HostKeyError('changed', fingerprint, this.host);
            return false;
          }
          return true;
        }
      };

      try {
        if (this.authMode === 'key') {
          authConfig.privateKey = this.readPrivateKey();
          if (this.passphrase) {
            authConfig.passphrase = this.passphrase;
          }
        } else {
          authConfig.password = this.password;
        }
      } catch (err) {
        client.end();
        const mapped = classifySshError(err);
        reject(new Error(mapped.message));
        return;
      }

      client.on('ready', () => {
        client.sftp((err, sftp) => {
          if (err) {
            client.end();
            cleanup();
            const mapped = classifySshError(err);
            reject(new Error(mapped.message));
            return;
          }
          this.client = client;
          this.sftp = sftp;
          resolve(sftp);
        });
      });

      client.connect(authConfig);
    });
  }

  async testConnection() {
    try {
      const sftp = await this.getConnection();
      // 读取根目录作为读取探测，不写入任何文件
      await this.sftpList(sftp, this.rootPath);
      this.disconnect();
      return { success: true, message: 'SFTP 连接成功！' };
    } catch (error) {
      const mapped = classifySshError(error);
      this.disconnect();
      const result = { success: false, error: `SFTP 连接失败: ${mapped.message}`, kind: mapped.kind };
      if (error.fingerprint) {
        result.fingerprint = error.fingerprint;
        result.needsTrust = mapped.kind === 'unverified';
        result.fingerprintChanged = mapped.kind === 'changed';
      }
      return result;
    }
  }

  disconnect() {
    if (this.client) {
      try {
        this.client.end();
      } catch { /* 忽略关闭异常 */ }
    }
    this.client = null;
    this.sftp = null;
  }

  // ---- 路径换算：虚拟路径（相对 rootPath，'/' 开头的 POSIX 相对路径）→ 远端绝对路径 ----
  remotePath(key) {
    const clean = String(key || '').replace(/^\/+/, '');
    if (!clean) return this.rootPath;
    return posixJoin(this.rootPath, clean);
  }

  toLocalPath(remote) {
    let p = remote;
    if (this.rootPath !== '/' && p.startsWith(this.rootPath)) {
      p = p.slice(this.rootPath.length);
    } else if (this.rootPath === '/') {
      // 根目录即远端根
      p = p;
    }
    p = p.replace(/^\/+/, '');
    return p;
  }

  sftpList(sftp, remoteDir) {
    return new Promise((resolve, reject) => {
      sftp.readdir(remoteDir, (err, list) => {
        if (err) {
          const mapped = classifySshError(err);
          reject(new Error(mapped.message));
        } else {
          resolve(list);
        }
      });
    });
  }

  async listFiles(options = {}) {
    try {
      const prefix = options.prefix || '';
      const remoteDir = this.remotePath(prefix);
      const list = await this.sftpList(await this.getConnection(), remoteDir);

      const files = [];
      const folders = [];

      for (const item of list) {
        const isDir = item.attrs.isDirectory();
        if (isDir) {
          folders.push({ key: `${prefix}${item.filename}/`, isFolder: true });
        } else {
          files.push({
            Key: `${prefix}${item.filename}`,
            LastModified: item.attrs.mtime ? new Date(item.attrs.mtime * 1000) : null,
            Size: item.attrs.size,
            ETag: null,
            Permissions: item.attrs.permissions
          });
        }
      }

      return { success: true, data: { files, folders, nextContinuationToken: null } };
    } catch (error) {
      console.error('[SFTP] 列举失败:', error.message);
      throw error;
    }
  }

  async listObjects(options = {}) {
    return this.listFiles(options);
  }

  async uploadFile(filePath, key, onProgress) {
    return new Promise(async (resolve, reject) => {
      let sftp;
      try {
        sftp = await this.getConnection();
      } catch (err) {
        reject(err);
        return;
      }

      const remoteTarget = this.remotePath(key);
      const remoteDir = posixDirname(remoteTarget);
      const tempName = `.${posixBasename(remoteTarget)}.${crypto.randomBytes(4).toString('hex')}.csx-upload`;
      const remoteTemp = posixJoin(remoteDir, tempName);
      let closed = false;

      const cleanupTemp = () => {
        sftp.unlink(remoteTemp, () => {});
      };

      const fastPut = sftp.fastPut(filePath, remoteTemp, {
        step: (_totalTransferred, _chunk, total) => {
          if (onProgress && total > 0) {
            onProgress(Math.round((_totalTransferred / total) * 100), _totalTransferred, total);
          }
        }
      }, err => {
        if (closed) return;
        closed = true;
        if (err) {
          cleanupTemp();
          const mapped = classifySshError(err);
          reject(new Error(mapped.message));
          return;
        }
        // 覆盖语义：先删除已存在目标（SFTP rename 不允许覆盖）
        sftp.unlink(remoteTarget, () => {
          sftp.rename(remoteTemp, remoteTarget, renameErr => {
            if (renameErr) {
              cleanupTemp();
              const mapped = classifySshError(renameErr);
              reject(new Error(mapped.message));
              return;
            }
            resolve({ success: true, data: { key } });
          });
        });
      });

      this.activeUpload = {
        abort: () => {
          closed = true;
          try {
            sftp.fastPut.abort?.();
          } catch { /* fastPut 无公开取消接口，直接断开连接 */ }
          cleanupTemp();
          // 取消后断开连接，避免半写状态
          this.disconnect();
          const cancelErr = new Error('操作已取消');
          cancelErr.kind = 'cancelled';
          reject(cancelErr);
        }
      };

      void fastPut;
    });
  }

  abortUpload() {
    if (this.activeUpload?.abort) {
      this.activeUpload.abort();
      this.activeUpload = null;
      return true;
    }
    return false;
  }

  async downloadFile(key, filePath, onProgress) {
    return new Promise(async (resolve, reject) => {
      let sftp;
      try {
        sftp = await this.getConnection();
      } catch (err) {
        reject(err);
        return;
      }

      const writeStream = fs.createWriteStream(filePath);

      sftp.fastGet(this.remotePath(key), filePath, {
        step: (transferred, _chunk, total) => {
          if (onProgress && total > 0) {
            onProgress(Math.round((transferred / total) * 100), transferred, total);
          }
        }
      }, err => {
        if (err) {
          writeStream.end();
          const mapped = classifySshError(err);
          reject(new Error(mapped.message));
          return;
        }
        resolve({ success: true });
      });

      void writeStream;
    });
  }

  async statEntry(key) {
    const sftp = await this.getConnection();
    return new Promise((resolve, reject) => {
      sftp.lstat(this.remotePath(key), (err, stats) => {
        if (err) {
          const mapped = classifySshError(err);
          reject(new Error(mapped.message));
        } else {
          resolve(stats);
        }
      });
    });
  }

  async deleteFile(key) {
    const sftp = await this.getConnection();
    return new Promise((resolve, reject) => {
      sftp.unlink(this.remotePath(key), err => {
        if (err) {
          const mapped = classifySshError(err);
          reject(new Error(mapped.message));
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  async deleteFiles(keys) {
    for (const key of keys || []) {
      await this.deleteFile(key);
    }
    return { success: true, deleted: keys || [] };
  }

  /**
   * 递归删除目录。使用 lstat 判定符号链接：链接本身只做 unlink，不进入目标目录。
   */
  async deleteFolder(prefix) {
    const folderPath = prefix.endsWith('/') ? prefix : `${prefix}/`;
    await this.removeRemoteDir(this.remotePath(folderPath));
    return { success: true };
  }

  async removeRemoteDir(remoteDir) {
    const sftp = await this.getConnection();
    const list = await this.sftpList(sftp, remoteDir);

    for (const item of list) {
      const childPath = posixJoin(remoteDir, item.filename);
      // readdir 结果结合 lstat 二次确认类型，符号链接不递归
      const stats = await new Promise((resolve, reject) => {
        sftp.lstat(childPath, (err, s) => (err ? reject(err) : resolve(s)));
      });

      if (stats.isSymbolicLink()) {
        await new Promise((resolve, reject) => {
          sftp.unlink(childPath, err => (err ? reject(err) : resolve()));
        });
      } else if (stats.isDirectory()) {
        await this.removeRemoteDir(childPath);
      } else {
        await new Promise((resolve, reject) => {
          sftp.unlink(childPath, err => (err ? reject(err) : resolve()));
        });
      }
    }

    return new Promise((resolve, reject) => {
      sftp.rmdir(remoteDir, err => (err ? reject(err) : resolve()));
    });
  }

  async createFolder(prefix) {
    const sftp = await this.getConnection();
    const folderPath = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const remoteDir = this.remotePath(folderPath);

    // 逐级创建（相当于 mkdir -p），已存在的层级跳过
    const segments = remoteDir.split('/').filter(Boolean);
    let current = remoteDir.startsWith('/') ? '/' : '';
    for (const segment of segments) {
      current = posixJoin(current, segment);
      await new Promise((resolve, reject) => {
        sftp.mkdir(current, err => {
          if (!err) {
            resolve();
          } else if (err.code === 4 || /failure/i.test(err.message || '')) {
            // 目录可能已存在，验证后继续
            sftp.stat(current, (statErr, stats) => {
              if (!statErr && stats.isDirectory()) {
                resolve();
              } else {
                reject(new Error(`创建目录失败: ${current}`));
              }
            });
          } else {
            reject(err);
          }
        });
      });
    }

    return { success: true };
  }

  /**
   * 服务器内重命名（移动到同目录新名称或另一个目录）。
   */
  async moveEntry(sourceKey, destinationKey) {
    const sftp = await this.getConnection();
    return new Promise((resolve, reject) => {
      sftp.rename(this.remotePath(sourceKey), this.remotePath(destinationKey), err => {
        if (err) {
          const mapped = classifySshError(err);
          reject(new Error(mapped.message));
        } else {
          resolve({ success: true, data: { key: destinationKey } });
        }
      });
    });
  }

  async getFileContent(key, maxSize = 1024 * 1024) {
    const sftp = await this.getConnection();
    const stats = await this.statEntry(key);
    if (stats.size > maxSize) {
      return { success: true, data: { tooLarge: true, size: stats.size } };
    }

    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = sftp.createReadStream(this.remotePath(key), { encoding: 'utf8' });
      stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
      stream.on('error', err => {
        const mapped = classifySshError(err);
        reject(new Error(mapped.message));
      });
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          success: true,
          data: {
            content: buffer.toString('utf8'),
            size: stats.size,
            tooLarge: false
          }
        });
      });
    });
  }

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
      const list = await this.sftpList(await this.getConnection(), this.remotePath(dir));
      for (const item of list) {
        if (item.attrs.isSymbolicLink()) continue;
        if (item.attrs.isDirectory()) {
          queue.push([dir, item.filename].filter(Boolean).join('/') + '/');
        } else {
          totalCount += 1;
          totalSize += item.attrs.size || 0;
        }
      }
    }

    return { success: true, data: { totalCount, totalSize, truncated, unsupported: false } };
  }

  async searchFiles(keyword, options = {}) {
    const lower = keyword.toLowerCase();
    const results = [];
    const maxEntries = 5000;
    const maxDepth = 5;
    const queue = [{ dir: '', depth: 0 }];
    let count = 0;

    while (queue.length > 0) {
      if (count >= maxEntries) break;
      const { dir, depth } = queue.shift();
      const list = await this.sftpList(await this.getConnection(), this.remotePath(dir));
      for (const item of list) {
        if (item.attrs.isSymbolicLink()) continue;
        const childKey = [dir, item.filename].filter(Boolean).join('/');
        if (item.attrs.isDirectory()) {
          if (depth < maxDepth) queue.push({ dir: `${childKey}/`, depth: depth + 1 });
        } else {
          count += 1;
          if (item.filename.toLowerCase().includes(lower)) {
            results.push({
              Key: childKey,
              LastModified: item.attrs.mtime ? new Date(item.attrs.mtime * 1000) : null,
              Size: item.attrs.size
            });
          }
        }
      }
    }

    return { success: true, data: { files: results, total: results.length, truncated: count >= maxEntries } };
  }
}

export default SftpApi;
export { HostKeyError };
