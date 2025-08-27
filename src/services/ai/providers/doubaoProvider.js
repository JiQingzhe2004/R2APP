import { BaseAIProvider } from './baseProvider.js';

/**
 * 豆包AI提供商
 * 使用OpenAI兼容的API协议，支持多模态输入
 */
export class DoubaoProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
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
      // 使用聊天端点进行测试，因为这是实际使用的端点
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
        message: '豆包API连接成功',
        details: '聊天端点测试通过'
      };
    } catch (error) {
      return {
        success: false,
        message: `豆包API连接失败: ${error.message}`,
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
      // 如果获取模型列表失败，返回配置中的模型
      return [this.config.model];
    }
  }

  /**
   * 发送消息
   * @param {string|Array} message - 消息内容，可以是纯文本或包含图片的多模态内容
   * @param {Object} options - 选项
   */
  async sendMessage(message, options = {}) {
    try {
      // 构建消息内容
      let messageContent;
      if (typeof message === 'string') {
        // 纯文本消息
        messageContent = [
          {
            type: 'text',
            text: message
          }
        ];
      } else if (Array.isArray(message)) {
        // 多模态消息（文本+图片）
        messageContent = message.map(item => {
          if (typeof item === 'string') {
            return {
              type: 'text',
              text: item
            };
          } else if (item.type === 'image_url') {
            return {
              type: 'image_url',
              image_url: {
                url: item.image_url.url
              }
            };
          }
          return item;
        });
      } else {
        throw new Error('不支持的消息格式');
      }

      // 准备消息数组
      const messages = [];
      
      // 如果有上下文消息，添加到消息数组中
      if (options.context && options.context.length > 0) {
        messages.push(...options.context);
      }
      
      // 添加当前消息
      messages.push({
        role: 'user',
        content: messageContent
      });

      // 严格按照AI.md文档的豆包请求格式
      const requestBody = {
        model: this.config.model,
        messages: messages,
        stream: options.stream || false
      };

      // 豆包默认支持思考链，响应中会自动包含 reasoning_content
      // 不需要额外的请求参数，思考链适配器会处理响应中的 reasoning_content 字段
      console.log('[DoubaoProvider] 发送豆包请求:', requestBody);

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
        message: `豆包API请求失败: ${error.message}`,
        details: error.toString()
      };
    }
  }

  /**
   * 发送多模态消息（文本+图片）
   * @param {string} text - 文本内容
   * @param {Array<string>} imageUrls - 图片URL数组
   * @param {Object} options - 选项
   */
  async sendMultimodalMessage(text, imageUrls = [], options = {}) {
    const message = [
      {
        type: 'text',
        text: text
      },
      ...imageUrls.map(url => ({
        type: 'image_url',
        image_url: {
          url: url
        }
      }))
    ];

    return this.sendMessage(message, options);
  }
}
