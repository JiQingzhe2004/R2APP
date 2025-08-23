/**
 * AI提供商类型枚举
 */
export const AIProviderType = {
  ZHIPU: 'zhipu',
  DEEPSEEK: 'deepseek',
  DOUBAO: 'doubao',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'gemini',
  CUSTOM: 'custom'
};

/**
 * AI配置类
 */
export class AIConfig {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.type = data.type || AIProviderType.OPENAI;
    this.apiKey = data.apiKey || '';
    this.baseUrl = data.baseUrl || '';
    this.model = data.model || '';
    this.temperature = data.temperature || 0.7;
    this.maxTokens = data.maxTokens || 1000;
    this.enabled = data.enabled !== false;
    this.isDefault = data.isDefault || false;
    
    // 代理配置
    this.useProxy = data.useProxy || false;
    this.proxyHost = data.proxyHost || '';
    this.proxyPort = data.proxyPort || '';
    this.proxyUsername = data.proxyUsername || '';
    this.proxyPassword = data.proxyPassword || '';
    this.proxyProtocol = data.proxyProtocol || 'http'; // http, https, socks5
    
    // 思考模式配置
    this.reasoningEffort = data.reasoningEffort || 'none'; // none, low, medium, high
    this.thinkingBudget = data.thinkingBudget || 800; // 思考预算
    this.includeThoughts = data.includeThoughts || false; // 是否包含思考过程
    this.chainOfThought = data.chainOfThought || false; // 链式思考
    this.codeGeneration = data.codeGeneration || false; // 代码生成模式
    this.functionCalling = data.functionCalling || false; // 函数调用模式
    
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 验证配置是否有效
   */
  validate() {
    if (!this.name.trim()) {
      return { valid: false, error: '配置名称不能为空' };
    }
    if (!this.apiKey.trim()) {
      return { valid: false, error: 'API密钥不能为空' };
    }
    if (!this.baseUrl.trim()) {
      return { valid: false, error: '基础URL不能为空' };
    }
    if (!this.model.trim()) {
      return { valid: false, error: '模型名称不能为空' };
    }
    
    // 验证代理配置
    if (this.useProxy) {
      if (!this.proxyHost.trim()) {
        return { valid: false, error: '代理服务器地址不能为空' };
      }
      if (!this.proxyPort.trim()) {
        return { valid: false, error: '代理服务器端口不能为空' };
      }
      if (isNaN(parseInt(this.proxyPort)) || parseInt(this.proxyPort) < 1 || parseInt(this.proxyPort) > 65535) {
        return { valid: false, error: '代理服务器端口必须是1-65535之间的数字' };
      }
    }
    
    return { valid: true };
  }

  /**
   * 转换为普通对象
   */
  toObject() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      enabled: this.enabled,
      isDefault: this.isDefault,
      useProxy: this.useProxy,
      proxyHost: this.proxyHost,
      proxyPort: this.proxyPort,
      proxyUsername: this.proxyUsername,
      proxyPassword: this.proxyPassword,
      proxyProtocol: this.proxyProtocol,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * 从普通对象创建实例
   */
  static fromObject(data) {
    return new AIConfig(data);
  }
}

/**
 * AI提供商信息
 */
export const AIProviderInfo = {
  [AIProviderType.ZHIPU]: {
    name: '智谱AI',
    displayName: '智谱AI',
    description: '智谱AI官方API，支持GLM系列模型和链式思考推理',
    icon: 'zhipu',
    color: 'blue',
    defaultModel: 'glm-4.5-flash',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    useFixedUrl: true,
    features: ['chat', 'streaming', 'chain-of-thought', 'reasoning'],
    models: ['glm-4.5-flash', 'glm-4', 'glm-4-flash', 'glm-3-turbo'],
    requiresProxy: false,
    supportsThinking: true,
    thinkingFeatures: ['chainOfThought', 'reasoning']
  },
  [AIProviderType.DEEPSEEK]: {
    name: 'DeepSeek',
    displayName: 'DeepSeek',
    description: 'DeepSeek官方API，支持DeepSeek系列模型和代码生成推理',
    icon: 'deepseek',
    color: 'red',
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com',
    useFixedUrl: true,
    features: ['chat', 'streaming', 'code-generation', 'reasoning'],
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    requiresProxy: false,
    supportsThinking: true,
    thinkingFeatures: ['codeGeneration', 'reasoning']
  },
  [AIProviderType.DOUBAO]: {
    name: '豆包',
    displayName: '豆包',
    description: '火山方舟豆包官方API，支持豆包系列模型、多模态输入和推理',
    icon: 'doubao',
    color: 'purple',
    defaultModel: 'doubao-1-5-pro-32k-250115',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    useFixedUrl: true,
    features: ['chat', 'streaming', 'multimodal', 'reasoning'],
    models: ['doubao-1-5-pro-32k-250115', 'doubao-seed-1-6-flash-250715', 'doubao-vision-pro-32k-2410128'],
    requiresProxy: false,
    supportsThinking: true,
    thinkingFeatures: ['reasoning', 'multimodal']
  },
  [AIProviderType.OPENAI]: {
    name: 'OpenAI',
    displayName: 'OpenAI',
    description: 'OpenAI官方API，支持GPT系列模型、函数调用和推理（需要代理访问）',
    icon: 'openai',
    color: 'green',
    defaultModel: 'gpt-3.5-turbo-0125',
    defaultBaseUrl: 'https://api.openai.com/v1',
    useFixedUrl: true,
    features: ['chat', 'streaming', 'function-calling', 'reasoning'],
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o-mini', 'gpt-4.1-nano', 'gpt-4-turbo', 'gpt-3.5-turbo-0125'],
    requiresProxy: true,
    supportsThinking: true,
    thinkingFeatures: ['functionCalling', 'reasoning']
  },
  [AIProviderType.ANTHROPIC]: {
    name: 'Anthropic',
    displayName: 'Anthropic',
    description: 'Anthropic官方API，支持Claude系列模型、视觉和推理（需要代理访问）',
    icon: 'anthropic',
    color: 'purple',
    defaultModel: 'claude-3-sonnet-20240229',
    defaultBaseUrl: 'https://api.anthropic.com',
    useFixedUrl: true,
    features: ['chat', 'streaming', 'vision', 'reasoning'],
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    requiresProxy: true,
    supportsThinking: true,
    thinkingFeatures: ['vision', 'reasoning']
  },
  [AIProviderType.GOOGLE]: {
    name: 'Gemini',
    displayName: 'Gemini (Google AI)',
    description: 'Google AI官方API，支持Gemini系列模型，使用OpenAI兼容端点（需要代理访问）',
    icon: 'gemini',
    color: 'orange',
    defaultModel: 'gemini-2.5-flash',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    useFixedUrl: true,
    features: ['chat', 'streaming', 'vision', 'thinking'],
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-exp',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp'
    ],
    requiresProxy: true,
    supportsThinking: true,
    thinkingFeatures: ['thinking', 'reasoning']
  },
  [AIProviderType.CUSTOM]: {
    name: '自定义',
    displayName: '自定义API',
    description: '自定义API端点，兼容OpenAI格式',
    icon: 'custom',
    color: 'gray',
    defaultModel: 'gpt-3.5-turbo',
    defaultBaseUrl: '',
    useFixedUrl: false,
    features: ['chat', 'streaming'],
    models: [],
    requiresProxy: false
  }
};
