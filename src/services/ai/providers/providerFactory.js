import { OpenAIProvider } from './openaiProvider';
import { DeepSeekProvider } from './deepseekProvider';
import { DoubaoProvider } from './doubaoProvider';
import { ZhipuProvider } from './zhipuProvider';
import { GeminiProvider } from './geminiProvider';
import { AIProviderType } from '../types';

/**
 * AI提供商工厂
 * 根据配置类型创建对应的提供商实例
 */
export class AIProviderFactory {
  /**
   * 创建AI提供商实例
   * @param {Object} config - AI配置对象
   * @returns {BaseAIProvider} 提供商实例
   */
  static createProvider(config) {
    switch (config.type) {
      case AIProviderType.OPENAI:
        return new OpenAIProvider(config);
      case AIProviderType.DEEPSEEK:
        return new DeepSeekProvider(config);
      case AIProviderType.DOUBAO:
        return new DoubaoProvider(config);
      case AIProviderType.ZHIPU:
        return new ZhipuProvider(config);
      case AIProviderType.GOOGLE:
        return new GeminiProvider(config);
      // 可以继续添加其他提供商
      default:
        throw new Error(`不支持的AI提供商类型: ${config.type}`);
    }
  }

  /**
   * 获取所有支持的提供商类型
   * @returns {Array} 提供商类型列表
   */
  static getSupportedProviders() {
    return [
      AIProviderType.OPENAI,
      AIProviderType.DEEPSEEK,
      AIProviderType.DOUBAO,
      AIProviderType.ZHIPU,
      AIProviderType.GOOGLE
    ];
  }

  /**
   * 检查提供商类型是否支持
   * @param {string} type - 提供商类型
   * @returns {boolean} 是否支持
   */
  static isProviderSupported(type) {
    return this.getSupportedProviders().includes(type);
  }
}
