import fs from 'fs';
import https from 'https';
import { URL } from 'url';

/**
 * Gitee API模块
 * 基于Gitee API实现文件存储功能
 * 使用Gitee仓库作为存储桶，通过API管理文件
 */

class GiteeAPI {
  constructor(config) {
    console.log('[Gitee API] Constructor called with config:', {
      hasAccessToken: !!config.accessToken,
      hasOwner: !!config.owner,
      hasRepo: !!config.repo,
      branch: config.branch,
      hasPublicDomain: !!config.publicDomain
    });

    // 清理配置参数，去除可能的空格
    const cleanConfig = {
      accessToken: config.accessToken?.trim(),
      owner: config.owner?.trim(),
      repo: config.repo?.trim(),
      branch: config.branch?.trim() || 'main',
      publicDomain: config.publicDomain?.trim()
    };

    console.log('[Gitee API] Cleaned config:', {
      accessTokenLength: cleanConfig.accessToken?.length || 0,
      owner: cleanConfig.owner,
      repo: cleanConfig.repo,
      branch: cleanConfig.branch,
      publicDomain: cleanConfig.publicDomain
    });

    // 验证必要参数
    const missingParams = [];
    if (!cleanConfig.accessToken) missingParams.push('AccessToken');
    if (!cleanConfig.owner) missingParams.push('Owner');
    if (!cleanConfig.repo) missingParams.push('Repo');

    if (missingParams.length > 0) {
      const errorMsg = `Gitee配置参数不完整，缺少: ${missingParams.join(', ')}`;
      console.error('[Gitee API]', errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`[Gitee API] Initializing with owner: ${cleanConfig.owner}, repo: ${cleanConfig.repo}`);
    
    this.accessToken = cleanConfig.accessToken;
    this.owner = cleanConfig.owner;
    this.repo = cleanConfig.repo;
    this.branch = cleanConfig.branch;
    this.publicDomain = cleanConfig.publicDomain;
    this.baseUrl = 'https://gitee.com/api/v5';
    
    console.log('[Gitee API] Initialization completed successfully');
  }

  /**
   * 发送HTTP请求
   */
  async makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      // 正确构造URL：baseUrl + path
      const fullUrl = this.baseUrl + (path.startsWith('/') ? path : `/${path}`);
      const url = new URL(fullUrl);
      if (this.accessToken) {
        url.searchParams.set('access_token', this.accessToken);
      }

      console.log(`[Gitee API] Making request: ${method} ${url.toString()}`);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'User-Agent': 'R2APP/4.1',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        }
      };

      if (data && method !== 'GET') {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      const req = https.request(options, (res) => {
        let responseData = '';
        
        console.log(`[Gitee API] Response status: ${res.statusCode}`);
        console.log(`[Gitee API] Response headers:`, res.headers);
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          console.log(`[Gitee API] Response data length: ${responseData.length}`);
          console.log(`[Gitee API] Response data preview: ${responseData.substring(0, 200)}...`);
          
          try {
            // 检查响应是否为HTML（错误页面）
            if (responseData.trim().startsWith('<!DOCTYPE') || responseData.trim().startsWith('<html')) {
              console.error('[Gitee API] Received HTML response instead of JSON');
              reject(new Error(`收到HTML响应，可能是API端点错误或认证失败。状态码: ${res.statusCode}`));
              return;
            }
            
            const result = responseData ? JSON.parse(responseData) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              const errorMsg = result.message || result.error || responseData || `HTTP ${res.statusCode}`;
              reject(new Error(`HTTP ${res.statusCode}: ${errorMsg}`));
            }
          } catch (error) {
            console.error('[Gitee API] JSON parse error:', error.message);
            console.error('[Gitee API] Raw response:', responseData);
            reject(new Error(`解析响应失败: ${error.message}。响应内容: ${responseData.substring(0, 100)}...`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('[Gitee API] Request error:', error);
        reject(error);
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * 获取文件的公共访问URL
   */
  getPublicUrl(key) {
    // 对文件名进行URL编码
    const encodedKey = encodeURIComponent(key);
    
    if (this.publicDomain) {
      let domain = this.publicDomain;
      if (domain.endsWith('/')) {
        domain = domain.slice(0, -1);
      }
      if (!/^(https?:\/\/)/i.test(domain)) {
        domain = `https://${domain}`;
      }
      return `${domain}/${encodedKey}`;
    }
    
    // 尝试不同的Gitee URL格式
    // 格式1: 不使用inline参数
    return `https://gitee.com/${this.owner}/${this.repo}/raw/${this.branch}/${encodedKey}`;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      console.log('[Gitee API] Testing connection...');
      console.log(`[Gitee API] Owner: ${this.owner}, Repo: ${this.repo}`);
      
      // 首先测试仓库访问（不需要认证）
      console.log('[Gitee API] Testing repository access...');
      const repoResult = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}`);
      console.log('[Gitee API] Repository result:', repoResult);
      
      if (!repoResult.id) {
        throw new Error('仓库不存在或无法访问');
      }
      
      // 然后测试用户信息，验证token是否有效
      console.log('[Gitee API] Testing user info with token...');
      try {
        const userResult = await this.makeRequest('GET', '/user');
        console.log('[Gitee API] User info result:', userResult);
        
        if (userResult.id) {
          console.log('[Gitee API] Connection test successful with valid token');
          return { success: true, message: 'Gitee 连接成功！' };
        } else {
          throw new Error('无法获取用户信息，Access Token可能无效');
        }
      } catch (userError) {
        console.log('[Gitee API] User info test failed:', userError.message);
        // 如果用户信息获取失败，但仓库可以访问，说明token可能无效
        if (userError.message.includes('401') || userError.message.includes('登录失效')) {
          throw new Error('Access Token无效，请检查配置');
        }
        throw userError;
      }
    } catch (error) {
      console.error('[Gitee API] Connection test failed:', error);
      
      // 提供更详细的错误信息
      let errorMessage = `Gitee 连接失败: ${error.message}`;
      
      if (error.message.includes('404')) {
        errorMessage = '仓库不存在，请检查仓库名称和所有者';
      } else if (error.message.includes('401') || error.message.includes('登录失效')) {
        errorMessage = 'Access Token无效，请检查配置';
      } else if (error.message.includes('HTML响应')) {
        errorMessage = 'API请求失败，请检查网络连接';
      } else if (error.message.includes('Access Token无效')) {
        errorMessage = 'Access Token无效，请检查配置';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(filePath, key, onProgress) {
    try {
      console.log(`[Gitee API] Uploading file: ${filePath} to ${key}`);
      
      // 确保文件名正确编码
      const encodedKey = encodeURIComponent(key);
      console.log(`[Gitee API] Original key: ${key}`);
      console.log(`[Gitee API] Encoded key: ${encodedKey}`);
      
      // 读取文件内容
      const fileContent = fs.readFileSync(filePath);
      const base64Content = fileContent.toString('base64');
      
      // 检查文件是否已存在
      let sha = null;
      try {
        const existingFile = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/contents/${encodedKey}?ref=${this.branch}`);
        console.log(`[Gitee API] File check response:`, existingFile);
        
        // 检查响应是否有效且包含sha
        if (existingFile && existingFile.sha) {
          sha = existingFile.sha;
          console.log(`[Gitee API] File exists, will update: ${key}, sha: ${sha}`);
        } else {
          console.log(`[Gitee API] File does not exist or invalid response, will create: ${key}`);
        }
      } catch (error) {
        console.log(`[Gitee API] File does not exist (error: ${error.message}), will create: ${key}`);
      }

      // 模拟进度更新
      if (onProgress) {
        onProgress(50, fileContent.length / 2, fileContent.length);
      }

      const uploadData = {
        message: `Upload file: ${key}`,
        content: base64Content,
        branch: this.branch
      };

      // 只有在文件存在时才添加sha
      if (sha) {
        uploadData.sha = sha;
        console.log(`[Gitee API] Adding sha to upload data: ${sha}`);
      } else {
        console.log(`[Gitee API] Creating new file without sha`);
        // 对于新文件，确保不包含sha字段
        delete uploadData.sha;
      }

      console.log(`[Gitee API] Upload data:`, {
        message: uploadData.message,
        branch: uploadData.branch,
        hasContent: !!uploadData.content,
        contentLength: uploadData.content?.length || 0,
        hasSha: !!uploadData.sha
      });

      // 使用POST方法上传文件
      const result = await this.makeRequest('POST', `/repos/${this.owner}/${this.repo}/contents/${encodedKey}`, uploadData);

      if (onProgress) {
        onProgress(100, fileContent.length, fileContent.length);
      }

      console.log(`[Gitee API] Upload completed: ${key}`);
      
      return {
        success: true,
        data: {
          key: key,
          bucket: `${this.owner}/${this.repo}`,
          url: this.getPublicUrl(key)
        }
      };
    } catch (error) {
      console.error(`[Gitee API] Upload failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(key, filePath, onProgress) {
    try {
      console.log(`[Gitee API] Downloading file: ${key} to ${filePath}`);
      
      const result = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/contents/${key}?ref=${this.branch}`);
      
      if (!result.content) {
        throw new Error('文件内容为空');
      }

      // 解码base64内容
      const fileContent = Buffer.from(result.content, 'base64');
      
      // 模拟进度更新
      if (onProgress) {
        onProgress(50, fileContent.length / 2, fileContent.length);
      }

      // 写入文件
      fs.writeFileSync(filePath, fileContent);

      if (onProgress) {
        onProgress(100, fileContent.length, fileContent.length);
      }

      console.log(`[Gitee API] Download completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[Gitee API] Download failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(key) {
    try {
      console.log(`[Gitee API] Deleting file: ${key}`);
      
      // 获取文件信息以获取sha
      const fileInfo = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/contents/${key}?ref=${this.branch}`);
      
      const deleteData = {
        message: `Delete file: ${key}`,
        sha: fileInfo.sha,
        branch: this.branch
      };

      await this.makeRequest('DELETE', `/repos/${this.owner}/${this.repo}/contents/${key}`, deleteData);
      
      console.log(`[Gitee API] Delete completed: ${key}`);
      return { success: true };
    } catch (error) {
      console.error(`[Gitee API] Delete failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 批量删除文件
   */
  async deleteFiles(keys) {
    try {
      console.log(`[Gitee API] Batch deleting ${keys.length} files`);
      
      if (keys.length === 0) {
        return { success: true, deleted: [] };
      }

      const deleted = [];
      
      // Gitee API不支持批量删除，需要逐个删除
      for (const key of keys) {
        try {
          await this.deleteFile(key);
          deleted.push(key);
        } catch (error) {
          console.error(`[Gitee API] Failed to delete ${key}:`, error);
        }
      }
      
      console.log(`[Gitee API] Batch delete completed: ${deleted.length} files deleted`);
      return { success: true, deleted };
    } catch (error) {
      console.error(`[Gitee API] Batch delete failed:`, error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   */
  async listFiles(options = {}) {
    try {
      console.log(`[Gitee API] Listing files with options:`, options);
      
      const {
        prefix = '',
        delimiter = undefined,
        continuationToken = undefined,
        maxKeys = 1000
      } = options;

      // 获取仓库目录树
      const result = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`);
      
      if (!result.tree) {
        return {
          success: true,
          data: {
            files: [],
            folders: [],
            nextContinuationToken: null,
            isTruncated: false
          }
        };
      }

      const files = [];
      const folders = [];
      const folderSet = new Set();

      for (const item of result.tree) {
        if (item.type === 'blob' && item.path.startsWith(prefix)) {
          // 处理文件
          const relativePath = item.path;
          if (delimiter && relativePath.includes(delimiter)) {
            const folderPath = relativePath.substring(0, relativePath.indexOf(delimiter) + 1);
            if (!folderSet.has(folderPath)) {
              folders.push({
                key: folderPath,
                isFolder: true
              });
              folderSet.add(folderPath);
            }
          } else {
            files.push({
              Key: relativePath,
              LastModified: new Date().toISOString(), // Gitee API不直接提供修改时间
              Size: item.size || 0,
              ETag: item.sha,
              StorageClass: 'STANDARD',
              publicUrl: this.getPublicUrl(relativePath) // 添加公共访问URL
            });
          }
        }
      }

      console.log(`[Gitee API] List completed: ${files.length} files, ${folders.length} folders`);
      
      return {
        success: true,
        data: {
          files,
          folders,
          nextContinuationToken: null,
          isTruncated: false
        }
      };
    } catch (error) {
      console.error(`[Gitee API] List files failed:`, error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      console.log('[Gitee API] Getting storage stats...');
      
      const result = await this.listFiles();
      
      if (result.success) {
        const totalCount = result.data.files.length;
        const totalSize = result.data.files.reduce((acc, file) => acc + (file.Size || 0), 0);
        
        console.log(`[Gitee API] Storage stats: ${totalCount} files, ${totalSize} bytes`);
        
        return {
          success: true,
          data: {
            totalCount,
            totalSize
          }
        };
      } else {
        throw new Error('获取文件列表失败');
      }
    } catch (error) {
      console.error('[Gitee API] Get storage stats failed:', error);
      throw error;
    }
  }

  /**
   * 获取预签名URL
   */
  async getPresignedUrl(key, expiresIn = 900) {
    try {
      // Gitee使用公共URL，不需要预签名
      const url = this.getPublicUrl(key);
      return url;
    } catch (error) {
      console.error(`[Gitee API] Get presigned URL failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(searchTerm, options = {}) {
    try {
      console.log(`[Gitee API] Searching files with term: ${searchTerm}`);
      
      const result = await this.listFiles(options);
      
      if (result.success) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filteredFiles = result.data.files.filter(item => 
          item.Key.toLowerCase().includes(lowerCaseSearchTerm)
        );
        
        console.log(`[Gitee API] Search completed: ${filteredFiles.length} results found`);
        
        return {
          success: true,
          data: {
            files: filteredFiles,
            total: filteredFiles.length
          }
        };
      } else {
        throw new Error('获取文件列表失败');
      }
    } catch (error) {
      console.error(`[Gitee API] Search files failed:`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(key) {
    try {
      console.log(`[Gitee API] Checking if file exists: ${key}`);
      await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/contents/${key}?ref=${this.branch}`);
      console.log(`[Gitee API] File exists: ${key}`);
      return true;
    } catch (error) {
      if (error.message.includes('404')) {
        console.log(`[Gitee API] File does not exist: ${key}`);
        return false;
      }
      console.error(`[Gitee API] Check file exists failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key) {
    try {
      console.log(`[Gitee API] Getting file info: ${key}`);
      const result = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/contents/${key}?ref=${this.branch}`);
      
      const fileInfo = {
        Key: key,
        Size: result.size || 0,
        LastModified: new Date().toISOString(),
        ETag: result.sha,
        ContentType: 'application/octet-stream',
        StorageClass: 'STANDARD'
      };

      console.log(`[Gitee API] File info retrieved: ${key}`);
      return {
        success: true,
        data: fileInfo
      };
    } catch (error) {
      console.error(`[Gitee API] Get file info failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件内容（用于预览）
   */
  async getFileContent(key, maxSize = 1024 * 1024) {
    try {
      const result = await this.makeRequest('GET', `/repos/${this.owner}/${this.repo}/contents/${key}?ref=${this.branch}`);
      
      if (!result.content) {
        throw new Error('文件内容为空');
      }

      // 解码base64内容
      const fileContent = Buffer.from(result.content, 'base64');
      const contentLength = fileContent.length;
      
      if (contentLength > maxSize) {
        return {
          success: true,
          data: {
            tooLarge: true,
            size: contentLength
          }
        };
      }

      // 对于图片文件，返回base64编码的内容
      const base64Content = result.content; // 直接返回Gitee API的base64内容

      return {
        success: true,
        data: {
          content: base64Content, // 返回base64编码的内容
          size: contentLength,
          tooLarge: false
        }
      };
    } catch (error) {
      console.error(`[Gitee API] Get file content failed for ${key}:`, error);
      
      // 提供更详细的错误信息
      let errorMessage = `获取文件内容失败: ${error.message}`;
      
      if (error.message.includes('404')) {
        errorMessage = '文件不存在';
      } else if (error.message.includes('401')) {
        errorMessage = '没有访问文件的权限';
      }
      
      throw new Error(errorMessage);
    }
  }
}

export default GiteeAPI;
