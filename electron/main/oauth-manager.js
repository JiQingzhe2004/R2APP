import http from 'http';
import crypto from 'crypto';
import { shell } from 'electron';

/**
 * 主进程 OAuth 管理模块（P2，OneDrive / Google Drive 共用）
 *
 * 桌面端采用系统浏览器授权，授权码流程 + PKCE（见对接文档第 7、8 节）：
 *  - 生成 code_verifier / code_challenge(S256) / state
 *  - 在 127.0.0.1 随机端口启动本地回调服务，等待授权码
 *  - 完成或取消后立即关闭回调监听，校验 state 防伪造
 *  - 令牌由主进程通过 secure-store 加密保存，渲染进程不持有 refresh token
 */

const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟授权超时

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(bytes = 32) {
  return base64url(crypto.randomBytes(bytes));
}

class OAuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OAuthError';
    this.code = code; // 'cancelled' | 'timeout' | 'state_mismatch' | 'denied' | 'exchange_failed'
  }
}

// 运行中的授权会话（每个应用同一时间只保留一个）
let activeSession = null;

/**
 * 提供商的授权端点与令牌端点配置
 */
function getProviderEndpoints(provider, options = {}) {
  if (provider === 'onedrive') {
    const tenant = options.tenantType || 'common';
    const base = `https://login.microsoftonline.com/${tenant}`;
    return {
      authorizeUrl: `${base}/oauth2/v2.0/authorize`,
      tokenUrl: `${base}/oauth2/v2.0/token`,
      // Microsoft 支持公共客户端 PKCE；redirect URI 使用 http://localhost（任意端口）
      loopbackHost: 'localhost',
      useSecret: !!options.clientSecret
    };
  }
  if (provider === 'google-drive') {
    return {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      loopbackHost: '127.0.0.1',
      useSecret: true // Google 桌面应用流程需要 client_secret
    };
  }
  throw new Error(`未知的 OAuth 提供商: ${provider}`);
}

export function getDefaultScopes(provider, options = {}) {
  if (provider === 'onedrive') {
    const scopes = ['offline_access', 'User.Read', 'Files.ReadWrite', 'Files.ReadWrite.All'];
    if (options.resourceKind === 'sharepoint') {
      scopes.push('Sites.ReadWrite.All');
    }
    return scopes.join(' ');
  }
  if (provider === 'google-drive') {
    // 全盘管理（浏览与管理用户文件）。范围边界与产品承诺一致，不虚报。
    return 'https://www.googleapis.com/auth/drive email openid';
  }
  throw new Error(`未知的 OAuth 提供商: ${provider}`);
}

/**
 * 启动 OAuth 授权流程
 * @param {object} params
 * @param {'onedrive'|'google-drive'} params.provider
 * @param {string} params.clientId
 * @param {string} [params.clientSecret]
 * @param {string} [params.tenantType] - OneDrive: consumers | organizations | common
 * @param {string} [params.resourceKind] - OneDrive: personal | business | sharepoint
 * @param {string} [params.scopes] - 覆盖默认权限范围
 * @returns {Promise<{tokens: object, accountEmail: string}>}
 */
export function startOAuthFlow(params) {
  if (activeSession) {
    cancelOAuthFlow('新的授权已开始');
  }

  const { provider, clientId, clientSecret, tenantType, resourceKind, scopes } = params;
  if (!clientId) {
    return Promise.reject(new Error('缺少 Client ID，请先在配置中填写'));
  }

  const endpoints = getProviderEndpoints(provider, { tenantType, clientSecret });
  const scopeString = scopes || getDefaultScopes(provider, { resourceKind });

  const state = randomToken(16);
  const codeVerifier = randomToken(48);
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutHandle = null;
    let finalRedirectUri = null; // 在 server.listen 回调中确定实际端口

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${endpoints.loopbackHost}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

      if (error) {
        res.end('<html><body><h3>授权被取消或失败</h3><p>您可以关闭此页面并返回应用。</p></body></html>');
        finish(rejectWith(new OAuthError('denied', `授权失败: ${error}`)));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end();
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h3>state 校验失败</h3><p>为防止伪造请求，本次授权已中止。请返回应用重新发起授权。</p></body></html>');
        finish(rejectWith(new OAuthError('state_mismatch', 'state 校验失败，授权已中止')));
        return;
      }

      res.end('<html><body><h3>授权成功</h3><p>请返回应用程序继续操作。</p></body></html>');
      exchangeCodeForTokens(code)
        .then(result => finish(() => resolve(result)))
        .catch(err => finish(rejectWith(err)));
    });

    function rejectWith(err) {
      return () => {
        throw err;
      };
    }

    function finish(fn) {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      try {
        server.close();
      } catch { /* 忽略 */ }
      if (activeSession && activeSession.server === server) {
        activeSession = null;
      }
      try {
        fn();
      } catch (e) {
        // finish(rejectWith) 的异常已经不能抛给 Promise，改为 reject
        reject(e);
      }
    }

    async function exchangeCodeForTokens(code) {
      const body = new URLSearchParams({
        client_id: clientId,
        code,
        grant_type: 'authorization_code',
        redirect_uri: finalRedirectUri,
        code_verifier: codeVerifier
      });
      if (endpoints.useSecret && clientSecret) {
        body.set('client_secret', clientSecret);
      }

      const response = await fetch(endpoints.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new OAuthError('exchange_failed', `令牌交换失败: ${data.error_description || data.error || response.status}`);
      }

      const tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
        scope: data.scope || scopeString,
        obtainedAt: Date.now()
      };

      const accountEmail = await fetchAccountEmail(provider, tokens.accessToken).catch(() => '');
      return { tokens, accountEmail };
    }

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      finalRedirectUri = `http://${endpoints.loopbackHost}:${port}/callback`;

      const authParams = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: finalRedirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state
      });
      if (provider === 'onedrive') {
        authParams.set('scope', scopeString);
        authParams.set('response_mode', 'query');
      } else {
        authParams.set('scope', scopeString);
        authParams.set('access_type', 'offline');
        authParams.set('prompt', 'consent');
      }

      const authorizeUrl = `${endpoints.authorizeUrl}?${authParams.toString()}`;

      activeSession = {
        server,
        cancel: reason => finish(rejectWith(new OAuthError('cancelled', reason || '授权已取消')))
      };

      timeoutHandle = setTimeout(() => {
        finish(rejectWith(new OAuthError('timeout', '授权超时：未在限定时间内完成浏览器授权')));
      }, AUTH_TIMEOUT_MS);

      shell.openExternal(authorizeUrl).catch(err => {
        finish(rejectWith(new OAuthError('cancelled', `无法打开系统浏览器: ${err.message}`)));
      });
    });

    server.on('error', err => {
      finish(rejectWith(new OAuthError('cancelled', `本地回调服务启动失败: ${err.message}`)));
    });
  });
}

async function fetchAccountEmail(provider, accessToken) {
  const url = provider === 'onedrive'
    ? 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName'
    : 'https://www.googleapis.com/oauth2/v3/userinfo';
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return '';
  const data = await response.json();
  return data.mail || data.email || data.userPrincipalName || '';
}

export function cancelOAuthFlow(reason) {
  if (activeSession?.cancel) {
    activeSession.cancel(reason);
    activeSession = null;
  }
}

/**
 * 刷新访问令牌
 */
export async function refreshAccessToken(provider, { clientId, clientSecret, refreshToken, tenantType }) {
  const endpoints = getProviderEndpoints(provider, { tenantType, clientSecret });
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  if (endpoints.useSecret && clientSecret) {
    body.set('client_secret', clientSecret);
  }
  if (provider === 'onedrive') {
    body.set('scope', getDefaultScopes(provider));
  }

  const response = await fetch(endpoints.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new OAuthError('exchange_failed', `刷新令牌失败: ${data.error_description || data.error || response.status}`);
  }

  return {
    accessToken: data.access_token,
    // 部分提供商刷新时可能不返回新的 refresh_token，保留旧值
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    scope: data.scope,
    obtainedAt: Date.now()
  };
}

/**
 * 获取有效的访问令牌：过期前 60 秒自动刷新。
 * @returns {Promise<string>} accessToken
 */
export async function getValidAccessToken({ provider, clientId, clientSecret, tenantType, tokens, onTokensRefreshed }) {
  if (!tokens || !tokens.refreshToken) {
    throw new OAuthError('denied', '尚未授权或授权已失效，请重新登录');
  }

  if (tokens.accessToken && Date.now() < (tokens.expiresAt || 0) - 60 * 1000) {
    return tokens.accessToken;
  }

  const refreshed = await refreshAccessToken(provider, {
    clientId,
    clientSecret,
    refreshToken: tokens.refreshToken,
    tenantType
  });

  if (onTokensRefreshed) {
    onTokensRefreshed(refreshed);
  }
  return refreshed.accessToken;
}

export default {
  startOAuthFlow,
  cancelOAuthFlow,
  refreshAccessToken,
  getValidAccessToken,
  getDefaultScopes
};
