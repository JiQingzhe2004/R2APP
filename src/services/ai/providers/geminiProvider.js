import { OpenAIProvider } from './openaiProvider.js';

/**
 * Gemini AI提供商
 * 使用OpenAI兼容的API协议
 */
export class GeminiProvider extends OpenAIProvider {
  constructor(config) {
    super(config);
    // Gemini特有配置
    this.config.baseUrl = this.config.baseUrl || 'https://api.groq.com/openai/v1';
    this.config.maxTokens = this.config.maxTokens || 4096;
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      // 使用聊天端点进行测试
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
        message: 'Gemini API连接成功',
        details: '聊天端点测试通过'
      };
    } catch (error) {
      return {
        success: false,
        message: `Gemini API连接失败: ${error.message}`,
        details: error.toString()
      };
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

      // 严格按照AI.md文档的谷歌请求格式
      const requestBody = {
        model: this.config.model,
        messages: messages,
        stream: options.stream || false,
        extra_body: {
          google: {
            thinking_config: {
              include_thoughts: true
            }
          }
        }
      };

      // 谷歌的思考链通过 extra_body.google.thinking_config 启用
      // 思考链适配器会处理响应中的思考内容
      console.log('[GeminiProvider] 发送谷歌请求:', requestBody);

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
        message: `Gemini API请求失败: ${error.message}`,
        details: error.toString()
      };
    }
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data?.map(model => model.id) || [];
    } catch (error) {
      // 如果获取模型列表失败，返回预定义的Gemini模型列表
      return [
        'gemini-2.0-pro-',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-2.5-flash'
      ];
    }
  }

  /**
   * 获取提供商信息
   */
  getProviderInfo() {
    return {
      name: 'Gemini',
      version: '1.0.0',
      supports: ['text', 'image', 'streaming', 'thinking'],
      models: this.getModels()
    };
  }
}
