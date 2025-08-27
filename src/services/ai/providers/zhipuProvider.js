import { BaseAIProvider } from './baseProvider.js';

/**
 * 智谱AI提供商
 */
export class ZhipuProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    // 智谱特有配置
    this.config.baseUrl = this.config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4';
    this.config.maxTokens = this.config.maxTokens || 2048;
  }

  /**
   * 获取请求头
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'R2APP/1.0.0'
    };
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const testUrl = `${this.config.baseUrl}/chat/completions`;
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: 'test'
            }
          ],
          max_tokens: 10
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: '智谱AI API连接成功',
        details: '聊天端点测试通过'
      };
    } catch (error) {
      return {
        success: false,
        message: `智谱AI API连接失败: ${error.message}`,
        details: error.toString()
      };
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    try {
      // 智谱AI没有公开的模型列表API，返回预定义的模型
      return [
        'glm-4',
        'glm-4-plus',
        'glm-4-air',
        'glm-4-vision',
        'glm-3-turbo',
        'glm-3-turbo-16k'
      ];
    } catch (error) {
      return [this.config.model];
    }
  }

  /**
   * 发送消息
   * @param {string} message - 消息内容
   * @param {Object} options - 选项
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
      messages.push({
        role: 'user',
        content: message
      });

      // 严格按照AI.md文档的智谱清言请求格式
      const requestBody = {
        model: this.config.model,
        messages: messages,
        stream: options.stream || false
      };

      // 智谱AI的思考链通过工具调用实现
      // 思考链适配器会处理响应中的工具调用数据
      console.log('[ZhipuProvider] 发送智谱AI请求:', requestBody);

      if (options.stream) {
        // 流式响应处理
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(requestBody)
        });

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
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

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
        message: `智谱AI API请求失败: ${error.message}`,
        details: error.toString()
      };
    }
  }

  /**
   * 获取提供商信息
   */
  getProviderInfo() {
    return {
      name: 'ZhipuAI',
      version: '1.0.0',
      supports: ['text', 'image', 'streaming'],
      models: this.getModels()
    };
  }
}
