import { ThinkingAdapter } from '../adapters/thinkingAdapter.js';

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
   * 创建代理URL（如果启用代理）
   */
  createProxyUrl() {
    if (!this.config.useProxy) {
      return null;
    }

    if (!this.config.proxyHost || !this.config.proxyPort) {
      return null;
    }

    const { proxyProtocol, proxyHost, proxyPort, proxyUsername, proxyPassword } = this.config;

    let proxyUrl = `${proxyProtocol}://`;

    if (proxyUsername && proxyPassword) {
      proxyUrl += `${encodeURIComponent(proxyUsername)}:${encodeURIComponent(proxyPassword)}@`;
    }

    proxyUrl += `${proxyHost}:${proxyPort}`;

    return proxyUrl;
  }

  /**
   * 执行fetch请求（支持代理）
   */
  async fetchWithProxy(url, options = {}) {
    const proxyUrl = this.createProxyUrl();

    if (proxyUrl) {
      console.log(`[${this.constructor.name}] 使用代理: ${proxyUrl}`);
    }

    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      console.error(`[${this.constructor.name}] 请求失败:`, error);
      throw error;
    }
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

  /**
   * 处理流式响应中的思考链数据
   */
  processStreamChunk(chunk) {
    console.log(`[BaseProvider] 处理流式数据块:`, chunk);
    const result = ThinkingAdapter.processStreamChunk(this.config.type, chunk);
    console.log(`[BaseProvider] 处理结果:`, result);
    return result;
  }

  /**
   * 处理非流式响应中的思考链数据
   */
  processNonStreamResponse(response) {
    console.log(`[BaseProvider] 处理非流式响应:`, response);
    const result = ThinkingAdapter.processNonStreamResponse(this.config.type, response);
    console.log(`[BaseProvider] 非流式处理结果:`, result);
    return result;
  }

  /**
   * 创建统一的流式响应迭代器
   */
  createUnifiedStreamIterator(reader, decoder) {
    const self = this; // 保存this引用
    return {
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  console.log(`[BaseProvider] 解析的JSON数据:`, parsed);
                  const processedChunk = self.processStreamChunk(parsed);
                  
                  if (processedChunk) {
                    console.log(`[BaseProvider] 产生数据块:`, processedChunk);
                    yield processedChunk;
                  }
                } catch (e) {
                  console.error(`[BaseProvider] JSON解析错误:`, e);
                  // 忽略解析错误
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
    };
  }
}
