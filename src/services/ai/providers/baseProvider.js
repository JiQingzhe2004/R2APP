/**
 * AI提供商基类
 * 定义所有AI提供商必须实现的接口
 */
export class BaseAIProvider {
  constructor(config) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * 验证配置
   */
  validateConfig() {
    if (!this.config.apiKey) {
      throw new Error('API密钥不能为空');
    }
    if (!this.config.baseUrl) {
      throw new Error('基础URL不能为空');
    }
    if (!this.config.model) {
      throw new Error('模型名称不能为空');
    }
  }

  /**
   * 测试连接 - 子类必须实现
   */
  async testConnection() {
    throw new Error('子类必须实现testConnection方法');
  }

  /**
   * 发送消息 - 子类必须实现
   */
  async sendMessage(message, options = {}) {
    throw new Error('子类必须实现sendMessage方法');
  }

  /**
   * 获取可用模型列表 - 子类必须实现
   */
  async getModels() {
    throw new Error('子类必须实现getModels方法');
  }

  /**
   * 获取提供商信息
   */
  getProviderInfo() {
    return {
      name: this.constructor.name,
      type: this.config.type,
      model: this.config.model,
      baseUrl: this.config.baseUrl
    };
  }

  /**
   * 创建请求头
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * 处理API响应
   */
  handleResponse(response) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 处理API错误
   */
  handleError(error) {
    console.error(`[${this.constructor.name}] API调用失败:`, error);
    throw error;
  }
}
