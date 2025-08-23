import { OpenAIProvider } from './openaiProvider';

/**
 * Gemini AI提供商实现
 * 使用OpenAI兼容的端点，继承OpenAI提供商的逻辑
 */
export class GeminiProvider extends OpenAIProvider {
  constructor(config) {
    super(config);
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      // Gemini使用OpenAI兼容的端点，可以直接使用父类的测试方法
      const testUrl = `${this.config.baseUrl}/models`;

      const response = await this.fetchWithProxy(testUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = await this.handleResponse(response);

      return {
        success: true,
        message: 'Gemini连接成功',
        details: data
      };
    } catch (error) {
      return {
        success: false,
        message: `Gemini连接失败: ${error.message}`,
        details: error.toString()
      };
    }
  }

  /**
   * 发送消息（支持Gemini特有的思考功能）
   */
  async sendMessage(message, options = {}) {
    try {
      const requestBody = {
        model: this.config.model,
        messages: [{ role: 'user', content: message }],
        max_tokens: options.maxTokens || this.config.maxTokens || 1000,
        temperature: options.temperature || this.config.temperature || 0.7,
        stream: options.stream || false
      };

      // 如果使用Gemini 2.5系列模型，支持思考功能
      if (this.config.model && this.config.model.includes('2.5')) {
        // 支持思考预算参数
        if (options.reasoningEffort) {
          requestBody.reasoning_effort = options.reasoningEffort; // low, medium, high
        }
        
        // 支持思考配置
        if (options.thinkingConfig) {
          requestBody.extra_body = {
            google: {
              thinking_config: {
                thinking_budget: options.thinkingConfig.thinkingBudget || 800,
                include_thoughts: options.thinkingConfig.includeThoughts || false
              }
            }
          };
        }
      }

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
        let usage = null;

        // 创建异步迭代器
        const stream = {
          async *[Symbol.asyncIterator]() {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                      return;
                    }

                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.choices && parsed.choices[0]) {
                        const choice = parsed.choices[0];
                        
                        // 处理思考内容（Gemini特有）
                        if (choice.delta && choice.delta.content) {
                          fullContent += choice.delta.content;
                          yield {
                            content: choice.delta.content,
                            fullContent,
                            done: false,
                            type: 'content'
                          };
                        }
                        
                        // 处理思考过程（如果启用）
                        if (choice.delta && choice.delta.thinking) {
                          yield {
                            content: choice.delta.thinking,
                            fullContent: fullContent,
                            done: false,
                            type: 'thinking'
                          };
                        }
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

              // 流结束
              yield {
                content: '',
                fullContent,
                done: true,
                usage
              };
            } catch (error) {
              throw error;
            } finally {
              reader.releaseLock();
            }
          }
        };

        // 返回正确的流式响应格式
        return {
          success: true,
          data: {
            stream: stream,
            response: '',
            usage: null
          }
        };
      } else {
        // 非流式响应
        const data = await this.handleResponse(response);
        
        return {
          success: true,
          data: {
            response: data.choices?.[0]?.message?.content || '',
            usage: data.usage,
            model: data.model,
            id: data.id,
            created: data.created,
            finishReason: data.choices?.[0]?.finish_reason
          }
        };
      }
    } catch (error) {
      throw new Error(`Gemini API调用失败: ${error.message}`);
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
      // 如果API调用失败，返回预定义的Gemini模型列表
      return [
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-2.5-flash',
        'gemini-2.5-flash-exp',
        'gemini-2.5-pro',
        'gemini-2.5-pro-exp',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.5-pro-latest'
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
      features: ['chat', 'streaming', 'vision', 'thinking'],
      supportedModels: [
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-2.5-flash',
        'gemini-2.5-flash-exp',
        'gemini-2.5-pro',
        'gemini-2.5-pro-exp',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.5-pro-latest'
      ]
    };
  }
}
