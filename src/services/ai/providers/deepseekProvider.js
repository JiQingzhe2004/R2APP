import { BaseAIProvider } from './baseProvider';

/**
 * DeepSeek AI提供商实现
 */
export class DeepSeekProvider extends BaseAIProvider {
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
      // 尝试不同的端点
      const endpoints = ['/models', '/v1/models'];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: this.getHeaders()
          });

          if (response.ok) {
            const data = await this.handleResponse(response);
            return {
              success: true,
              message: 'DeepSeek连接成功',
              data: {
                models: data.data?.map(model => model.id) || [],
                totalModels: data.data?.length || 0
              }
            };
          }
        } catch (error) {
          // 继续尝试下一个端点
          continue;
        }
      }
      
      // 如果所有端点都失败，尝试聊天接口
      return await this.testChatConnection();
      
    } catch (error) {
      return {
        success: false,
        error: `DeepSeek连接失败: ${error.message}`,
        details: error.stack
      };
    }
  }

  /**
   * 通过聊天接口测试连接
   */
  async testChatConnection() {
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model || 'deepseek-chat',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });

      if (response.ok) {
        return {
          success: true,
          message: 'DeepSeek连接成功（通过聊天接口测试）',
          data: {
            models: [this.config.model || 'deepseek-chat'],
            totalModels: 1
          }
        };
      }
    } catch (error) {
      // 忽略错误
    }

    throw new Error('DeepSeek连接失败：无法访问任何API端点');
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await this.handleResponse(response);
      return data.data?.map(model => model.id) || [];
    } catch (error) {
      // 如果获取模型列表失败，返回配置中的模型
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
      
      // 严格按照AI.md文档的DeepSeek请求格式
      const requestBody = {
        model: this.config.model,
        messages: messages,
        max_tokens: options.maxTokens || this.config.maxTokens || 1000,
        temperature: options.temperature || this.config.temperature || 0.7,
        stream: options.stream || false
      };

      // DeepSeek的思考链功能
      // 思考链适配器会处理响应中的思考内容
      console.log('[DeepSeekProvider] 发送DeepSeek请求:', requestBody);
      
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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

        // 使用统一的流式响应处理
        const stream = this.createUnifiedStreamIterator(reader, decoder);

        return {
          success: true,
          message: '流式消息发送成功',
          data: {
            stream,
            response: '',
            thinking: '',
            usage: null,
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
