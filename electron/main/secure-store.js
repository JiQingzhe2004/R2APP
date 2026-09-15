import { safeStorage } from 'electron';
import Store from 'electron-store';

/**
 * 凭据安全存储模块
 *
 * 新增存储类型（s3 / webdav / sftp / onedrive / google-drive）的机密字段
 * 不再写入明文 config.json，而是：
 *  1. 优先使用 Electron safeStorage（底层为 DPAPI / Keychain / kwallet 等系统加密能力）加密后，
 *     以 base64 密文保存在独立的 credentials.json 中；
 *  2. 系统加密能力不可用时，仅在本次会话内保存（内存），并在 UI 上明确提示，
 *     不静默降级为长期明文保存。
 *
 * 引用格式（credentialRef）：`${profileId}:${field}`
 */

let secretStore = null;
try {
  secretStore = new Store({ name: 'credentials' });
} catch (error) {
  console.error('[SecureStore] 无法初始化凭据存储:', error.message);
}

// safeStorage 不可用时的会话级回退，仅存在于内存
const sessionSecrets = new Map();

function encryptionAvailable() {
  try {
    return !!safeStorage && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * 保存机密。返回 true 表示已持久化（加密），false 表示仅本次会话保存。
 */
export function saveSecret(ref, plain) {
  if (!ref) return false;
  if (plain === undefined || plain === null) plain = '';

  if (encryptionAvailable()) {
    try {
      const encrypted = safeStorage.encryptString(String(plain));
      const secrets = secretStore.get('secrets', {});
      secrets[ref] = encrypted.toString('base64');
      secretStore.set('secrets', secrets);
      return true;
    } catch (error) {
      console.error(`[SecureStore] 加密保存失败 (${ref}):`, error.message);
    }
  }

  console.warn(`[SecureStore] 系统加密不可用，凭据仅保存在本次会话中: ${ref}`);
  sessionSecrets.set(ref, String(plain));
  return false;
}

export function getSecret(ref) {
  if (!ref) return undefined;

  if (sessionSecrets.has(ref)) {
    return sessionSecrets.get(ref);
  }

  if (!secretStore || !encryptionAvailable()) {
    return undefined;
  }

  try {
    const secrets = secretStore.get('secrets', {});
    const encoded = secrets[ref];
    if (!encoded) return undefined;
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch (error) {
    console.error(`[SecureStore] 读取凭据失败 (${ref}):`, error.message);
    return undefined;
  }
}

export function deleteSecret(ref) {
  if (!ref) return;
  sessionSecrets.delete(ref);
  if (!secretStore) return;
  try {
    const secrets = secretStore.get('secrets', {});
    if (ref in secrets) {
      delete secrets[ref];
      secretStore.set('secrets', secrets);
    }
  } catch (error) {
    console.error(`[SecureStore] 删除凭据失败 (${ref}):`, error.message);
  }
}

export function deleteSecretsForProfile(profileId) {
  if (!profileId || !secretStore) return;
  try {
    const secrets = secretStore.get('secrets', {});
    let changed = false;
    for (const ref of Object.keys(secrets)) {
      if (ref.startsWith(`${profileId}:`)) {
        delete secrets[ref];
        changed = true;
      }
    }
    for (const ref of Array.from(sessionSecrets.keys())) {
      if (ref.startsWith(`${profileId}:`)) sessionSecrets.delete(ref);
    }
    if (changed) secretStore.set('secrets', secrets);
  } catch (error) {
    console.error(`[SecureStore] 清理配置凭据失败 (${profileId}):`, error.message);
  }
}

/**
 * 将配置中的机密字段并入 profile（用于构造适配器实例 / 连接测试）。
 * 渲染进程传入的未保存值优先，其次读取已保存的加密凭据。
 * @returns {{profile: Object, ephemeralOnly: boolean}}
 */
export function resolveProfileSecrets(profile) {
  const fields = SECRET_FIELDS[profile?.type] || [];
  const merged = { ...profile };
  let ephemeralOnly = false;

  merged.credentialRef = { ...(profile?.credentialRef || {}) };
  for (const field of fields) {
    const ref = `${profile.id}:${field}`;
    const hasTypedValue = profile[field] !== undefined && profile[field] !== null && profile[field] !== '';
    if (hasTypedValue) {
      merged[field] = profile[field];
      merged.credentialRef[field] = true;
    } else {
      const saved = getSecret(ref);
      if (saved !== undefined && saved !== '') {
        merged[field] = saved;
        merged.credentialRef[field] = true;
        if (!encryptionAvailable()) ephemeralOnly = true;
      }
    }
  }

  // OAuth 类型：并入已保存的令牌（由 oauth-manager 写入）
  if (profile?.type === 'onedrive' || profile?.type === 'google-drive') {
    const tokensRef = `${profile.id}:oauth-tokens`;
    const tokens = getSecret(tokensRef);
    if (tokens) {
      try {
        merged.oauthTokens = JSON.parse(tokens);
      } catch {
        // 忽略损坏的令牌数据
      }
      if (!encryptionAvailable()) ephemeralOnly = true;
    }
    // clientSecret 属于机密字段
    const secretRef = `${profile.id}:clientSecret`;
    const savedSecret = getSecret(secretRef);
    if (savedSecret) {
      merged.clientSecret = savedSecret;
      merged.credentialRef.clientSecret = true;
    }
  }

  return { profile: merged, ephemeralOnly };
}

/**
 * 从 profile 中摘除机密字段并写入加密存储，返回可直接持久化的脱敏 profile。
 * 已有凭据且本次输入为空时保留原凭据引用。
 */
export function stripAndStoreSecrets(profile) {
  const fields = SECRET_FIELDS[profile?.type] || [];
  const sanitized = { ...profile };
  sanitized.credentialRef = { ...(profile?.credentialRef || {}) };

  for (const field of fields) {
    const ref = `${profile.id}:${field}`;
    const typed = profile[field];
    if (typed !== undefined && typed !== null && typed !== '') {
      saveSecret(ref, String(typed));
      sanitized.credentialRef[field] = true;
    }
    delete sanitized[field];
  }

  if (profile?.type === 'google-drive' || profile?.type === 'onedrive') {
    if (profile.clientSecret) {
      saveSecret(`${profile.id}:clientSecret`, String(profile.clientSecret));
    }
    delete sanitized.clientSecret;
  }

  return sanitized;
}

/**
 * 各新类型中需要走加密存储的机密字段（新类型适用，老类型保持原有行为）
 */
export const SECRET_FIELDS = {
  s3: ['accessKeyId', 'secretAccessKey', 'sessionToken'],
  webdav: ['password'],
  sftp: ['password', 'passphrase'],
  onedrive: [],
  'google-drive': [],
};

/** 新增的存储类型集合 */
export const NEW_STORAGE_TYPES = ['s3', 'webdav', 'sftp', 'onedrive', 'google-drive'];

export function isEncryptionAvailable() {
  return encryptionAvailable();
}

export default {
  saveSecret,
  getSecret,
  deleteSecret,
  deleteSecretsForProfile,
  resolveProfileSecrets,
  stripAndStoreSecrets,
  SECRET_FIELDS,
  NEW_STORAGE_TYPES,
  isEncryptionAvailable,
};
