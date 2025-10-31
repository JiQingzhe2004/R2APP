/**
 * 代理配置管理模块
 * 用于管理应用的网络代理设置
 */

import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

/**
 * 创建代理 Agent
 * @param {Object} proxyConfig - 代理配置
 * @param {string} proxyConfig.proxyUrl - 代理 URL（例如：http://127.0.0.1:7890）
 * @param {string} proxyConfig.proxyHost - 代理主机
 * @param {number} proxyConfig.proxyPort - 代理端口
 * @param {string} proxyConfig.proxyProtocol - 代理协议（http/https/socks5）
 * @param {string} proxyConfig.proxyUsername - 代理用户名（可选）
 * @param {string} proxyConfig.proxyPassword - 代理密码（可选）
 * @returns {Object} - 包含 http 和 https agent
 */
export function createProxyAgent(proxyConfig) {
  if (!proxyConfig) {
    return null;
  }

  try {
    let proxyUrl;
    
    // 如果直接提供了完整的代理 URL
    if (proxyConfig.proxyUrl) {
      proxyUrl = proxyConfig.proxyUrl;
    } 
    // 否则根据配置构建代理 URL
    else if (proxyConfig.proxyHost && proxyConfig.proxyPort) {
      const protocol = proxyConfig.proxyProtocol || 'http';
      const auth = proxyConfig.proxyUsername && proxyConfig.proxyPassword 
        ? `${proxyConfig.proxyUsername}:${proxyConfig.proxyPassword}@`
        : '';
      proxyUrl = `${protocol}://${auth}${proxyConfig.proxyHost}:${proxyConfig.proxyPort}`;
    } else {
      return null;
    }

    console.log('[Proxy] Creating proxy agent with URL:', proxyUrl.replace(/:[^:@]+@/, ':****@')); // 隐藏密码

    // 根据协议创建相应的 agent
    if (proxyUrl.startsWith('https://')) {
      return {
        http: new HttpProxyAgent(proxyUrl),
        https: new HttpsProxyAgent(proxyUrl)
      };
    } else {
      return {
        http: new HttpProxyAgent(proxyUrl),
        https: new HttpsProxyAgent(proxyUrl)
      };
    }
  } catch (error) {
    console.error('[Proxy] Failed to create proxy agent:', error);
    return null;
  }
}

/**
 * 测试代理连接
 * @param {Object} proxyConfig - 代理配置
 * @returns {Promise<Object>} - 测试结果
 */
export async function testProxyConnection(proxyConfig) {
  try {
    const https = require('https');
    const agent = createProxyAgent(proxyConfig);
    
    if (!agent) {
      return { success: false, error: '代理配置无效' };
    }

    console.log('[Proxy] Testing proxy connection...');
    
    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'www.google.com',
        port: 443,
        path: '/',
        method: 'HEAD',
        agent: agent.https,
        timeout: 10000
      }, (res) => {
        console.log('[Proxy] Test response status:', res.statusCode);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ success: true, message: '代理连接测试成功！' });
        } else {
          resolve({ success: false, error: `代理返回状态码: ${res.statusCode}` });
        }
      });

      req.on('error', (error) => {
        console.error('[Proxy] Test error:', error);
        resolve({ success: false, error: `代理连接失败: ${error.message}` });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: '代理连接超时' });
      });

      req.end();
    });
  } catch (error) {
    console.error('[Proxy] Test proxy connection error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 为 GCS 配置代理
 * @param {Object} proxyConfig - 代理配置
 * @returns {Object} - GCS 可用的代理配置对象
 */
export function getGCSProxyConfig(proxyConfig) {
  if (!proxyConfig || !proxyConfig.enabled) {
    return null;
  }

  try {
    let proxyUrl;
    
    if (proxyConfig.proxyUrl) {
      proxyUrl = proxyConfig.proxyUrl;
    } else if (proxyConfig.proxyHost && proxyConfig.proxyPort) {
      const protocol = proxyConfig.proxyProtocol || 'http';
      const auth = proxyConfig.proxyUsername && proxyConfig.proxyPassword 
        ? `${proxyConfig.proxyUsername}:${proxyConfig.proxyPassword}@`
        : '';
      proxyUrl = `${protocol}://${auth}${proxyConfig.proxyHost}:${proxyConfig.proxyPort}`;
    }

    if (proxyUrl) {
      console.log('[Proxy] Using proxy for GCS:', proxyUrl.replace(/:[^:@]+@/, ':****@'));
      return {
        url: proxyUrl
      };
    }
  } catch (error) {
    console.error('[Proxy] Failed to get GCS proxy config:', error);
  }

  return null;
}

/**
 * 应用环境变量代理设置
 * @param {Object} proxyConfig - 代理配置
 */
export function applyProxyToEnvironment(proxyConfig) {
  if (!proxyConfig || !proxyConfig.enabled) {
    // 清除代理环境变量
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    console.log('[Proxy] Proxy environment variables cleared');
    return;
  }

  try {
    let proxyUrl;
    
    if (proxyConfig.proxyUrl) {
      proxyUrl = proxyConfig.proxyUrl;
    } else if (proxyConfig.proxyHost && proxyConfig.proxyPort) {
      const protocol = proxyConfig.proxyProtocol || 'http';
      const auth = proxyConfig.proxyUsername && proxyConfig.proxyPassword 
        ? `${proxyConfig.proxyUsername}:${proxyConfig.proxyPassword}@`
        : '';
      proxyUrl = `${protocol}://${auth}${proxyConfig.proxyHost}:${proxyConfig.proxyPort}`;
    }

    if (proxyUrl) {
      process.env.HTTP_PROXY = proxyUrl;
      process.env.HTTPS_PROXY = proxyUrl;
      process.env.http_proxy = proxyUrl;
      process.env.https_proxy = proxyUrl;
      console.log('[Proxy] Proxy environment variables set:', proxyUrl.replace(/:[^:@]+@/, ':****@'));
    }
  } catch (error) {
    console.error('[Proxy] Failed to apply proxy to environment:', error);
  }
}

export default {
  createProxyAgent,
  testProxyConnection,
  getGCSProxyConfig,
  applyProxyToEnvironment
};

