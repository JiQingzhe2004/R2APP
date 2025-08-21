import fs from 'fs';
import https from 'https';

/**
 * SM.MS图床API模块
 * 基于SM.MS图床API实现
 */

class SmmsAPI {
  constructor(token) {
    this.token = token?.startsWith('Basic ') ? token : `Basic ${token || ''}`;
    this.baseHost = 'sm.ms';
  }

  /**
   * 执行HTTP请求
   */
  async makeRequest(host, path, options = {}) {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: host,
        port: 443,
        path: path,
        method: options.method || 'GET',
        headers: {
          'Authorization': this.token,
          'Accept': 'application/json',
          'Accept-Encoding': 'identity',
          'User-Agent': 'R2APP/4.1',
          ...options.headers
        }
      };

      console.log(`[SMMS API] ${options.method || 'GET'} https://${host}${path}`);

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log(`[SMMS API] Response status: ${res.statusCode}, data length: ${data.length}`);
          try {
            const response = JSON.parse(data);
            console.log(`[SMMS API] Parsed response:`, response);
            resolve(response);
          } catch (e) {
            console.error(`[SMMS API] Parse error:`, e, 'Raw data:', data.substring(0, 200));
            resolve({ __nonJson: true, statusCode: res.statusCode, headers: res.headers, preview: data.substring(0, 200) });
          }
        });
      });

      req.on('error', (error) => {
        console.error(`[SMMS API] Request error:`, error);
        reject(error);
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * 测试连接
   * 通过获取上传历史来验证Token
   */
  async testConnection() {
    try {
      console.log('[SMMS API] Testing connection...');
      
      // 尝试主域名
      let response = await this.makeRequest(this.baseHost, '/api/v2/upload_history');
      
      console.log('[SMMS API] Test connection response:', response);
      
      if (response.__nonJson) {
        return { success: false, error: `SM.MS 响应非 JSON，状态 ${response.statusCode || '未知'}` };
      }
      
      if (response && (response.success || response.code === 'success')) {
        return { success: true, message: 'SM.MS 连接成功！' };
      } else {
        return { success: false, error: response.message || 'SM.MS 连接失败' };
      }
    } catch (error) {
      console.error('[SMMS API] Test connection error:', error);
      return { success: false, error: `SM.MS 连接失败: ${error.message}` };
    }
  }

  /**
   * 上传图片
   */
  async uploadImage(filePath) {
    return new Promise((resolve, reject) => {
      const FormData = require('form-data');
      const form = new FormData();
      const fileName = filePath.split(/[\\/]/).pop();
      
      form.append('smfile', fs.createReadStream(filePath), { 
        filename: fileName, 
        contentType: 'application/octet-stream' 
      });

      const requestOptions = {
        hostname: this.baseHost,
        port: 443,
        path: '/api/v2/upload',
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Authorization': this.token,
          'Accept': 'application/json',
          'Accept-Encoding': 'identity',
          'User-Agent': 'R2APP/4.1'
        }
      };

      console.log(`[SMMS API] Uploading file: ${fileName}`);

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log(`[SMMS API] Upload response:`, response);
            
            if (response.success) {
              resolve({
                success: true,
                data: {
                  url: response.data.url,
                  delete_url: response.data.delete_url,
                  hash: response.data.hash,
                  filename: response.data.filename,
                  storename: response.data.storename,
                  size: response.data.size,
                  width: response.data.width,
                  height: response.data.height,
                  path: response.data.path
                }
              });
            } else {
              reject(new Error(response.message || 'SM.MS 上传失败'));
            }
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        });
      });

      req.on('error', reject);
      form.pipe(req);
    });
  }

  /**
   * 获取图片列表
   */
  async getImageList() {
    try {
      console.log('[SMMS API] Getting image list...');
      
      // 只使用主域名
      let response = await this.makeRequest(this.baseHost, '/api/v2/upload_history');
      
      console.log('[SMMS API] Image list response:', response);
      
      if (response.__nonJson) {
        throw new Error(`SM.MS 响应非 JSON，状态 ${response.statusCode || '未知'}`);
      }
      
      if (response && (response.success || response.code === 'success')) {
        const items = Array.isArray(response.data) ? response.data : [];
        console.log(`[SMMS API] Found ${items.length} images`);
        
        return {
          success: true,
          data: {
            files: items.map(it => ({
              Key: it.filename || it.storename || it.path || it.hash,
              LastModified: it.created_at || new Date().toISOString(),
              Size: Number(it.size || 0),
              ETag: it.hash,
              publicUrl: it.url,
              deleteUrl: it.delete,
              hash: it.hash,
              filename: it.filename,
              storename: it.storename,
              path: it.path
            })),
            total: items.length
          }
        };
      } else {
        throw new Error(response.message || '获取图片列表失败');
      }
    } catch (error) {
      console.error('[SMMS API] Failed to get image list:', error);
      throw error;
    }
  }

  /**
   * 删除图片
   */
  async deleteImage(hash) {
    try {
      console.log(`[SMMS API] Deleting image with hash: ${hash}`);
      
      const response = await this.makeRequest(
        this.baseHost, 
        `/api/v2/delete/${encodeURIComponent(hash)}`, 
        { method: 'GET' }
      );
      
      console.log(`[SMMS API] Delete response:`, response);
      
      if (response.__nonJson) {
        // SM.MS 删除成功时可能返回 HTML 页面
        if (response.preview && (response.preview.includes('File is deleted') || response.preview.includes('File Delete'))) {
          console.log(`[SMMS API] Delete successful (HTML response)`);
          return { success: true, message: '删除成功' };
        } else {
          throw new Error(`SM.MS 删除失败: ${response.statusCode}`);
        }
      }
      
      if (response.success) {
        console.log(`[SMMS API] Delete successful (JSON response)`);
        return { success: true, message: response.message || '删除成功' };
      } else {
        throw new Error(response.message || 'SM.MS 删除失败');
      }
    } catch (error) {
      console.error(`[SMMS API] Delete error:`, error);
      throw error;
    }
  }

  /**
   * 根据文件名查找图片哈希
   */
  async findImageHash(filename) {
    try {
      const response = await this.getImageList();
      if (response.success) {
        const found = response.data.files.find(it => 
          it.filename === filename || 
          it.storename === filename || 
          it.path === filename || 
          it.hash === filename
        );
        return found ? found.hash : null;
      }
      return null;
    } catch (error) {
      console.error('[SMMS API] Failed to find image hash:', error);
      return null;
    }
  }

  /**
   * 获取用户资料
   */
  async getUserProfile() {
    try {
      console.log('[SMMS API] Getting user profile...');
      
      // SM.MS v2 API 没有专门的用户资料接口，使用上传历史来获取基本信息
      let response = await this.makeRequest(this.baseHost, '/api/v2/upload_history');
      
      console.log('[SMMS API] User profile response:', response);
      
      if (response.__nonJson) {
        throw new Error(`SM.MS 响应非 JSON，状态 ${response.statusCode || '未知'}`);
      }
      
      if (response && (response.success || response.code === 'success')) {
        // 从上传历史中提取基本信息
        const items = Array.isArray(response.data) ? response.data : [];
        const totalSize = items.reduce((acc, item) => acc + (Number(item.size) || 0), 0);
        
        return {
          success: true,
          data: {
            image_num: items.length,
            size: Math.round(totalSize / (1024 * 1024)) // 转换为MB
          }
        };
      } else {
        throw new Error(response.message || '获取用户资料失败');
      }
    } catch (error) {
      console.error('[SMMS API] Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      // 直接使用图片列表统计
      const response = await this.getImageList();
      if (response.success) {
        const totalCount = response.data.files.length;
        const totalSize = response.data.files.reduce((acc, it) => acc + Number(it.Size || 0), 0);
        
        return {
          success: true,
          data: {
            totalCount,
            totalSize
          }
        };
      } else {
        return {
          success: false,
          error: response.message || '获取统计信息失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `获取统计信息失败: ${error.message}`
      };
    }
  }
}

export default SmmsAPI;
