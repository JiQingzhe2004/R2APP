import { BaseAIProvider } from './baseProvider';

/**
 * OpenAI AI提供商实现
 */
export class OpenAIProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
  }

  /**
   * 获取请求头
   */
  getHeaders() {
    return {
      ...super.getHeaders(),
      'Authorization': `Bearer ${this.config.apiKey}`
    };
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const testUrl = `${this.config.baseUrl}/models`;

      const response = await this.fetchWithProxy(testUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await this.handleResponse(response);

      return {
        success: true,
        message: 'OpenAI连接成功',
        details: data
      };
    } catch (error) {
      return {
        success: false,
        message: `OpenAI连接失败: ${error.message}`,
        details: error.toString()
      };
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    try {
      const response = await this.fetchWithProxy(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await this.handleResponse(response);
      return data.data?.map(model => model.id) || [];
    } catch (error) {
      return [this.config.model];
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(message, options = {}) {
    try {
      // 准备消息数组
      const messages = [];
      
      // 如果有上下文消息，添加到消息数组中
      if (options.context && options.context.length > 0) {
        messages.push(...options.context);
      }
      
      // 添加当前消息
      messages.push({ role: 'user', content: message });
      
      // 严格按照AI.md文档的OpenAI请求格式
      const requestBody = {
        model: this.config.model,
        input: messages, // OpenAI使用 input 而不是 messages
        store: true,
        reasoning: {
          effort: 'minimal'
        }
      };

      // OpenAI的思考链通过 reasoning 参数启用
      // 思考链适配器会处理响应中的推理内容
      console.log('[OpenAIProvider] 发送OpenAI请求:', requestBody);
      
      const response = await this.fetchWithProxy(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (options.stream) {
        // 流式响应处理
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let thinkingContent = '';
        let usage = null;

        // 使用统一的流式响应处理
        const stream = this.createUnifiedStreamIterator(reader, decoder);

        return {
          success: true,
          message: '流式消息发送成功',
          data: {
            stream,
            response: fullContent,
            thinking: thinkingContent,
            usage,
            model: this.config.model
          }
        };
      } else {
        // 非流式响应处理
        const data = await this.handleResponse(response);
        
        // 使用统一的非流式响应处理
        const processedResponse = this.processNonStreamResponse(data);

        return {
          success: true,
          message: '消息发送成功',
          data: processedResponse
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `消息发送失败: ${error.message}`,
        details: error.stack
      };
    }
  }

  /**
   * 测试消息发送
   */
  async testMessage(message = '你好，这是一个测试消息') {
    return await this.sendMessage(message, { maxTokens: 100 });
  }
}
