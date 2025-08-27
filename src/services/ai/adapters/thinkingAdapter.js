/**
 * 思考链适配器
 * 用于统一处理不同AI提供商的思考链数据格式
 */
export class ThinkingAdapter {
  /**
   * 统一思考链数据格式
   */
  static normalizeThinkingData(providerType, rawData) {
    switch (providerType) {
      case 'doubao':
        return this.normalizeDoubaoThinking(rawData);
      case 'zhipu':
        return this.normalizeZhipuThinking(rawData);
      case 'gemini':
        return this.normalizeGeminiThinking(rawData);
      case 'openai':
        return this.normalizeOpenAIThinking(rawData);
      case 'deepseek':
        return this.normalizeDeepSeekThinking(rawData);
      case 'anthropic':
        return this.normalizeAnthropicThinking(rawData);
      case 'custom':
        return this.normalizeDefaultThinking(rawData);
      default:
        return this.normalizeDefaultThinking(rawData);
    }
  }

  /**
   * 豆包思考链标准化
   * 根据AI.md文档，豆包在响应中包含 reasoning_content 字段
   */
  static normalizeDoubaoThinking(rawData) {
    const thinking = {
      content: '',
      type: 'thinking',
      provider: 'doubao'
    };

    // 处理流式数据：choices[0].delta.reasoning_content
    if (rawData.choices?.[0]?.delta?.reasoning_content) {
      thinking.content = rawData.choices[0].delta.reasoning_content;
      console.log('[ThinkingAdapter] 豆包流式思考内容:', thinking.content);
    }
    // 处理非流式数据：choices[0].message.reasoning_content
    else if (rawData.choices?.[0]?.message?.reasoning_content) {
      thinking.content = rawData.choices[0].message.reasoning_content;
      console.log('[ThinkingAdapter] 豆包非流式思考内容:', thinking.content);
    }

    return thinking.content ? thinking : null;
  }

  /**
   * 智谱AI思考链标准化
   * 根据实际响应，智谱AI也使用 reasoning_content 字段
   */
  static normalizeZhipuThinking(rawData) {
    const thinking = {
      content: '',
      type: 'thinking',
      provider: 'zhipu'
    };

    // 处理流式数据：choices[0].delta.reasoning_content
    if (rawData.choices?.[0]?.delta?.reasoning_content) {
      thinking.content = rawData.choices[0].delta.reasoning_content;
      console.log('[ThinkingAdapter] 智谱AI流式思考内容:', thinking.content);
    }
    // 处理非流式数据：choices[0].message.reasoning_content
    else if (rawData.choices?.[0]?.message?.reasoning_content) {
      thinking.content = rawData.choices[0].message.reasoning_content;
      console.log('[ThinkingAdapter] 智谱AI非流式思考内容:', thinking.content);
    }
    // 处理工具调用中的思考内容（备用方案）
    else if (rawData.choices?.[0]?.delta?.tool_calls) {
      const toolCall = rawData.choices[0].delta.tool_calls[0];
      if (toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          if (args.reasoning) {
            thinking.content = args.reasoning;
            console.log('[ThinkingAdapter] 智谱AI工具调用思考内容:', thinking.content);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
    // 处理标准思考字段（备用方案）
    else if (rawData.choices?.[0]?.message?.thinking) {
      thinking.content = rawData.choices[0].message.thinking;
      console.log('[ThinkingAdapter] 智谱AI标准思考内容:', thinking.content);
    }

    return thinking.content ? thinking : null;
  }

  /**
   * Gemini思考链标准化
   * 根据AI.md文档，谷歌在响应中包含思考内容
   */
  static normalizeGeminiThinking(rawData) {
    const thinking = {
      content: '',
      type: 'thinking',
      provider: 'gemini'
    };

    // 处理Google特有的思考格式：extra_content.google.thought
    if (rawData.choices?.[0]?.delta?.extra_content?.google?.thought) {
      // 当 extra_content.google.thought 为 true 时，content 字段包含思考内容
      let content = rawData.choices[0].delta.content || '';
      
      // 移除 <thought> 和 </thought> 标签
      content = content.replace(/<\/?thought>/g, '');
      
      thinking.content = content;
      console.log('[ThinkingAdapter] 谷歌思考内容:', thinking.content);
    }
    // 处理标准思考字段
    else if (rawData.choices?.[0]?.delta?.thinking) {
      let content = rawData.choices[0].delta.thinking;
      
      // 移除 <thought> 和 </thought> 标签
      content = content.replace(/<\/?thought>/g, '');
      
      thinking.content = content;
      console.log('[ThinkingAdapter] 谷歌标准思考内容:', thinking.content);
    }
    // 处理非流式数据
    else if (rawData.choices?.[0]?.message?.thinking) {
      let content = rawData.choices[0].message.thinking;
      
      // 移除 <thought> 和 </thought> 标签
      content = content.replace(/<\/?thought>/g, '');
      
      thinking.content = content;
      console.log('[ThinkingAdapter] 谷歌非流式思考内容:', thinking.content);
    }

    return thinking.content ? thinking : null;
  }

  /**
   * OpenAI思考链标准化
   */
  static normalizeOpenAIThinking(rawData) {
    const thinking = {
      content: '',
      type: 'thinking',
      provider: 'openai'
    };

    // 处理工具调用中的思考内容
    if (rawData.choices?.[0]?.delta?.tool_calls) {
      const toolCall = rawData.choices[0].delta.tool_calls[0];
      if (toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          if (args.reasoning) {
            thinking.content = args.reasoning;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
    // 处理非流式数据
    else if (rawData.choices?.[0]?.message?.thinking) {
      thinking.content = rawData.choices[0].message.thinking;
    }

    return thinking.content ? thinking : null;
  }

  /**
   * DeepSeek思考链标准化
   * 根据实际响应，DeepSeek可能有多种思考链格式
   */
  static normalizeDeepSeekThinking(rawData) {
    console.log('[ThinkingAdapter] DeepSeek原始数据:', rawData);
    
    const thinking = {
      content: '',
      type: 'thinking',
      provider: 'deepseek'
    };

    // 检查choices结构
    if (rawData.choices && rawData.choices.length > 0) {
      const choice = rawData.choices[0];
      console.log('[ThinkingAdapter] DeepSeek choice:', choice);
      
      if (choice.delta) {
        console.log('[ThinkingAdapter] DeepSeek delta:', choice.delta);
        
        // 检查各种可能的思考链字段
        if (choice.delta.thinking) {
          thinking.content = choice.delta.thinking;
          console.log('[ThinkingAdapter] DeepSeek流式思考内容:', thinking.content);
        }
        else if (choice.delta.reasoning_content) {
          thinking.content = choice.delta.reasoning_content;
          console.log('[ThinkingAdapter] DeepSeek流式推理内容:', thinking.content);
        }
        else if (choice.delta.reasoning) {
          thinking.content = choice.delta.reasoning;
          console.log('[ThinkingAdapter] DeepSeek流式推理:', thinking.content);
        }
        else if (choice.delta.thought) {
          thinking.content = choice.delta.thought;
          console.log('[ThinkingAdapter] DeepSeek流式思考:', thinking.content);
        }
        else if (choice.delta.thoughts) {
          thinking.content = choice.delta.thoughts;
          console.log('[ThinkingAdapter] DeepSeek流式思考过程:', thinking.content);
        }
      }
      
      if (choice.message) {
        console.log('[ThinkingAdapter] DeepSeek message:', choice.message);
        
        // 检查非流式数据中的思考链字段
        if (choice.message.thinking) {
          thinking.content = choice.message.thinking;
          console.log('[ThinkingAdapter] DeepSeek非流式思考内容:', thinking.content);
        }
        else if (choice.message.reasoning_content) {
          thinking.content = choice.message.reasoning_content;
          console.log('[ThinkingAdapter] DeepSeek非流式推理内容:', thinking.content);
        }
        else if (choice.message.reasoning) {
          thinking.content = choice.message.reasoning;
          console.log('[ThinkingAdapter] DeepSeek非流式推理:', thinking.content);
        }
        else if (choice.message.thought) {
          thinking.content = choice.message.thought;
          console.log('[ThinkingAdapter] DeepSeek非流式思考:', thinking.content);
        }
        else if (choice.message.thoughts) {
          thinking.content = choice.message.thoughts;
          console.log('[ThinkingAdapter] DeepSeek非流式思考过程:', thinking.content);
        }
      }
    }
    
    // 检查直接字段（DeepSeek可能有简化的格式）
    if (!thinking.content) {
      console.log('[ThinkingAdapter] DeepSeek检查直接字段...');
      
      if (rawData.thinking) {
        thinking.content = rawData.thinking;
        console.log('[ThinkingAdapter] DeepSeek直接思考字段:', thinking.content);
      }
      else if (rawData.reasoning_content) {
        thinking.content = rawData.reasoning_content;
        console.log('[ThinkingAdapter] DeepSeek直接推理内容字段:', thinking.content);
      }
      else if (rawData.reasoning) {
        thinking.content = rawData.reasoning;
        console.log('[ThinkingAdapter] DeepSeek直接推理字段:', thinking.content);
      }
      else if (rawData.thought) {
        thinking.content = rawData.thought;
        console.log('[ThinkingAdapter] DeepSeek直接思考字段:', thinking.content);
      }
      else if (rawData.thoughts) {
        thinking.content = rawData.thoughts;
        console.log('[ThinkingAdapter] DeepSeek直接思考过程字段:', thinking.content);
      }
    }

    const result = thinking.content ? thinking : null;
    console.log('[ThinkingAdapter] DeepSeek处理结果:', result);
    return result;
  }

  /**
   * Anthropic思考链标准化
   */
  static normalizeAnthropicThinking(rawData) {
    const thinking = {
      content: '',
      type: 'thinking',
      provider: 'anthropic'
    };

    // Anthropic的思考链处理逻辑
    if (rawData.choices?.[0]?.delta?.thinking) {
      thinking.content = rawData.choices[0].delta.thinking;
    }
    else if (rawData.choices?.[0]?.message?.thinking) {
      thinking.content = rawData.choices[0].message.thinking;
    }

    return thinking.content ? thinking : null;
  }

  /**
   * 默认思考链标准化
   */
  static normalizeDefaultThinking(rawData) {
    const thinking = {
      content: '',
      type: 'thinking',
      provider: 'default'
    };

    // 尝试从常见字段中提取思考内容
    const possibleFields = [
      'thinking',
      'reasoning',
      'reasoning_content',
      'thought',
      'thoughts'
    ];

    for (const field of possibleFields) {
      if (rawData.choices?.[0]?.delta?.[field]) {
        thinking.content = rawData.choices[0].delta[field];
        break;
      }
      if (rawData.choices?.[0]?.message?.[field]) {
        thinking.content = rawData.choices[0].message[field];
        break;
      }
    }

    return thinking.content ? thinking : null;
  }

  /**
   * 处理流式响应中的思考链数据
   * 将不同AI提供商的原始数据格式统一转换为前端可用的格式
   */
  static processStreamChunk(providerType, chunk) {
    console.log(`[ThinkingAdapter] 处理 ${providerType} 的原始流式数据:`, chunk);
    
    // 1. 首先检查是否是思考链数据
    const thinkingData = this.normalizeThinkingData(providerType, chunk);
    if (thinkingData) {
      const result = {
        type: 'thinking',
        content: thinkingData.content,
        provider: thinkingData.provider
      };
      console.log(`[ThinkingAdapter] 转换为思考链格式:`, result);
      return result;
    }

    // 2. 检查是否是普通内容数据
    let content = null;
    
    // 豆包格式：choices[0].delta.content
    if (chunk.choices?.[0]?.delta?.content) {
      content = chunk.choices[0].delta.content;
    }
    // DeepSeek格式：chunk.content
    else if (chunk.content) {
      content = chunk.content;
    }
    // 其他标准格式：choices[0].content
    else if (chunk.choices?.[0]?.content) {
      content = chunk.choices[0].content;
    }
    
    if (content) {
      const result = {
        type: 'content',
        content: content
      };
      console.log(`[ThinkingAdapter] 转换为普通内容格式:`, result);
      return result;
    }

    console.log(`[ThinkingAdapter] 无有效数据，返回 null`);
    return null;
  }

  /**
   * 处理非流式响应中的思考链数据
   */
  static processNonStreamResponse(providerType, response) {
    console.log(`[ThinkingAdapter] 处理 ${providerType} 的非流式响应:`, response);
    
    const thinkingData = this.normalizeThinkingData(providerType, response);
    console.log(`[ThinkingAdapter] 非流式思考链数据:`, thinkingData);
    
    const result = {
      content: response.choices?.[0]?.message?.content || '',
      thinking: thinkingData?.content || '',
      usage: response.usage,
      model: response.model
    };
    
    console.log(`[ThinkingAdapter] 返回非流式结果:`, result);
    return result;
  }
}
