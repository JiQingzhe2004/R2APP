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

      const requestBody = {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        max_tokens: options.maxTokens || this.config.maxTokens || 1000,
        temperature: options.temperature || this.config.temperature || 0.7,
        stream: options.stream || false
      };

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
        let usage = null;

        // 创建异步迭代器
        const stream = {
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
                      if (parsed.choices?.[0]?.delta?.content) {
                        const content = parsed.choices[0].delta.content;
                        fullContent += content;
                        yield { content };
                      }
                      if (parsed.usage) {
                        usage = parsed.usage;
                      }
                    } catch (e) {
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

        return {
          success: true,
          message: '流式消息发送成功',
          data: {
            stream,
            response: fullContent,
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

        return {
          success: true,
          message: '消息发送成功',
          data: {
            response: data.choices?.[0]?.message?.content || '无响应内容',
            usage: data.usage,
            model: data.model
          }
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
