/**
 * AI连接测试服务
 * 使用新的提供商架构进行测试
 */
import { AIProviderFactory } from './providers/providerFactory';
import { AIProviderInfo } from './types';

export class AITestService {
  /**
   * 测试AI配置连接
   * @param {Object} config - AI配置对象
   * @returns {Promise<Object>} 测试结果
   */
  static async testConnection(config) {
    try {
      // 如果提供商使用固定URL但配置中没有，使用默认URL
      let baseUrl = config.baseUrl;
      if (!baseUrl && AIProviderInfo[config.type]?.useFixedUrl) {
        baseUrl = AIProviderInfo[config.type].defaultBaseUrl;
      }

      const testConfig = { ...config, baseUrl };
      
      // 使用提供商工厂创建对应的提供商实例
      const provider = AIProviderFactory.createProvider(testConfig);
      
      // 调用提供商的测试连接方法
      return await provider.testConnection();
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.stack
      };
    }
  }

  /**
   * 发送测试消息
   * @param {Object} config - AI配置对象
   * @param {string} message - 测试消息
   * @returns {Promise<Object>} 测试结果
   */
  static async sendTestMessage(config, message = '你好，这是一个测试消息') {
    try {
      // 如果提供商使用固定URL但配置中没有，使用默认URL
      let baseUrl = config.baseUrl;
      if (!baseUrl && AIProviderInfo[config.type]?.useFixedUrl) {
        baseUrl = AIProviderInfo[config.type].defaultBaseUrl;
      }

      const testConfig = { ...config, baseUrl };
      
      // 使用提供商工厂创建对应的提供商实例
      const provider = AIProviderFactory.createProvider(testConfig);
      
      // 调用提供商的测试消息方法
      return await provider.testMessage(message);
    } catch (error) {
      return {
        success: false,
        error: `测试消息发送失败: ${error.message}`,
        details: error.stack
      };
    }
  }

  /**
   * 获取配置状态信息
   * @param {Object} config - AI配置对象
   * @returns {Object} 状态信息
   */
  static getConfigStatus(config) {
    const providerInfo = AIProviderInfo[config.type];
    const requiredFields = ['name', 'apiKey', 'model'];
    
    // 如果提供商不使用固定URL，则baseUrl也是必需字段
    if (!providerInfo?.useFixedUrl) {
      requiredFields.push('baseUrl');
    }
    
    const missingFields = requiredFields.filter(field => !config[field] || !config[field].trim());
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        status: 'incomplete',
        message: `缺少必要字段: ${missingFields.join(', ')}`,
        missingFields
      };
    }

    if (!config.enabled) {
      return {
        valid: false,
        status: 'disabled',
        message: '配置已禁用',
        missingFields: []
      };
    }

    return {
      valid: true,
      status: 'ready',
      message: '配置就绪',
      missingFields: []
    };
  }
}
