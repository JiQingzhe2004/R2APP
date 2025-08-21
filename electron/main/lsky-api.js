import fs from 'fs';
import https from 'https';

/**
 * 兰空图床API模块
 * 基于兰空图床标准API实现
 */

class LskyAPI {
  constructor(url, token) {
    this.baseUrl = url;
    this.token = token?.startsWith('Bearer ') ? token : `Bearer ${token || ''}`;
    this.url = new URL(url);
  }

  /**
   * 执行HTTP请求
   */
  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: this.url.hostname,
        port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
        path: path,
        method: options.method || 'GET',
        headers: {
          'Authorization': this.token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        }
      };

      console.log(`[LSKY API] ${options.method || 'GET'} ${this.url.protocol}//${requestOptions.hostname}:${requestOptions.port}${path}`);

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log(`[LSKY API] Response status: ${res.statusCode}, data length: ${data.length}`);
          try {
            const response = JSON.parse(data);
            console.log(`[LSKY API] Parsed response:`, response);
            resolve(response);
          } catch (e) {
            console.error(`[LSKY API] Parse error:`, e, 'Raw data:', data.substring(0, 200));
            resolve({ status: false, message: '解析响应失败', raw: data });
          }
        });
      });

      req.on('error', (error) => {
        console.error(`[LSKY API] Request error:`, error);
        reject(error);
      });
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  /**
   * 测试连接
   * 根据兰空图床API文档：/api/v1/profile
   */
  async testConnection() {
    try {
      console.log('[LSKY API] Testing connection...');
      const response = await this.makeRequest('/api/v1/profile');
      console.log('[LSKY API] Test connection response:', response);
      
      if (response.status) {
        return { success: true, message: '兰空图床连接成功！' };
      } else {
        return { success: false, error: response.message || '兰空图床连接失败' };
      }
    } catch (error) {
      console.error('[LSKY API] Test connection error:', error);
      return { success: false, error: `兰空图床连接失败: ${error.message}` };
    }
  }

  /**
   * 上传图片
   */
  async uploadImage(filePath, options = {}) {
    return new Promise((resolve, reject) => {
      const FormData = require('form-data');
      const form = new FormData();
      const fileName = filePath.split(/[\\/]/).pop();
      
      form.append('file', fs.createReadStream(filePath), fileName);
      
      // 添加可选参数
      if (options.permission !== undefined) {
        form.append('permission', String(options.permission));
      }
      
      if (options.albumId) {
        form.append('album_id', String(options.albumId));
      }
      if (options.expiredAt) {
        form.append('expired_at', options.expiredAt);
      }

      const requestOptions = {
        hostname: this.url.hostname,
        port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
        path: '/api/v1/upload',
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Authorization': this.token,
          'Accept': 'application/json'
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
                         if (response.status) {
               resolve({
                 success: true,
                 data: {
                   url: response.data?.links?.url,
                   delete_url: response.data?.links?.delete_url,
                   key: response.data?.key,
                   pathname: response.data?.pathname,
                   size: response.data?.size,
                   date: response.data?.date,
                   md5: response.data?.md5,
                   name: response.data?.name
                 }
               });
             } else {
               reject(new Error(response.message || '兰空图床上传失败'));
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
   * 根据兰空图床API文档：/api/v1/images
   */
  async getImageList(options = {}) {
    const params = new URLSearchParams();
    params.append('page', options.page || '1');
    params.append('order', options.order || 'newest');
    params.append('permission', options.permission || 'public');
    
    if (options.per_page) {
      params.append('per_page', String(options.per_page));
    }

    console.log('[LSKY API] Getting image list with params:', params.toString());
    const response = await this.makeRequest(`/api/v1/images?${params.toString()}`);
    console.log('[LSKY API] Image list response:', response);
    
    if (response.status) {
      const files = response.data?.data || [];
      const total = response.data?.total || 0;
      console.log(`[LSKY API] Found ${files.length} images, total: ${total}`);
      
      return {
        success: true,
        data: {
          files: files,
          total: total,
          current_page: response.data?.current_page || 1,
          last_page: response.data?.last_page || 1
        }
      };
    } else {
      console.error('[LSKY API] Failed to get image list:', response.message);
      throw new Error(response.message || '获取图片列表失败');
    }
  }

  /**
   * 删除图片
   * 根据兰空图床API文档：DELETE /api/v1/images/{key}
   */
  async deleteImage(imageKey) {
    try {
      console.log(`[LSKY DELETE] Deleting image with key: ${imageKey}`);
      const response = await this.makeRequest(`/api/v1/images/${encodeURIComponent(imageKey)}`, {
        method: 'DELETE'
      });
      
      console.log(`[LSKY DELETE] Delete response:`, response);
      
      if (response.status) {
        // 验证删除是否真正成功 - 重新获取图片列表检查
        console.log(`[LSKY DELETE] Verifying deletion...`);
        const verifyResponse = await this.getImageList({ page: 1, order: 'newest', permission: 'public' });
        const imageStillExists = verifyResponse.data.files.some(img => img.key === imageKey);
        
        if (imageStillExists) {
          console.error(`[LSKY DELETE] Image still exists after deletion: ${imageKey}`);
          throw new Error('删除操作失败：图片仍然存在');
        } else {
          console.log(`[LSKY DELETE] Deletion verified successfully`);
          return { success: true, message: response.message || '删除成功' };
        }
      } else {
        console.error(`[LSKY DELETE] Delete failed:`, response.message);
        throw new Error(response.message || '兰空图床删除失败');
      }
    } catch (error) {
      console.error(`[LSKY DELETE] Delete error:`, error);
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  async getUserProfile() {
    const response = await this.makeRequest('/api/v1/profile');
    
    if (response.status) {
      return {
        success: true,
        data: response.data
      };
    } else {
      throw new Error(response.message || '获取用户信息失败');
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    try {
      const response = await this.makeRequest('/api/v1/images?page=1&order=newest&permission=public');
      
      if (response.status && response.data) {
        const totalCount = Number(response.data.total || 0);
        const arr = Array.isArray(response.data.data) ? response.data.data : [];
        const totalSize = arr.reduce((acc, it) => acc + Math.round(Number(it.size || 0)), 0);
        
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

export default LskyAPI;
