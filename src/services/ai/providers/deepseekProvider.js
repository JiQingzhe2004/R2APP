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
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: message }],
          max_tokens: options.maxTokens || this.config.maxTokens || 1000,
          temperature: options.temperature || this.config.temperature || 0.7,
          stream: options.stream || false
        })
      });

      if (options.stream) {
        // 流式响应处理
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
                      // 在流式结束时，尝试获取最后一个chunk中的usage信息
                      try {
                        // 读取最后一个chunk，通常包含usage信息
                        const lastChunk = await reader.read();
                        if (!lastChunk.done) {
                          const lastData = decoder.decode(lastChunk.value);
                          const lastLines = lastData.split('\n');
                          for (const lastLine of lastLines) {
                            if (lastLine.startsWith('data: ')) {
                              const lastDataContent = lastLine.slice(6);
                              try {
                                const lastParsed = JSON.parse(lastDataContent);
                                if (lastParsed.usage) {
                                  usage = lastParsed.usage;
                                }
                              } catch (e) {
                                // 忽略解析错误
                              }
                            }
                          }
                        }
                      } catch (e) {
                        // 忽略读取错误
                      }
                      return;
                    }

                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.choices?.[0]?.delta?.content) {
                        const content = parsed.choices[0].delta.content;
                        fullContent += content;
                        yield { content };
                      }
                      // 在流式过程中也尝试获取usage信息
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
        const data = await this.handleResponse(response);
        
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
