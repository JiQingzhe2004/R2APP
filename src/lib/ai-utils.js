/**
 * AI工具函数
 * 提供AI类型、logo、名字等信息的映射和转换
 */

/**
 * AI类型到显示名称的映射
 */
export const AI_TYPE_NAMES = {
  'zhipu': '智谱AI',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'gemini': 'Google AI',
  'deepseek': 'DeepSeek',
  'doubao': '豆包',
  'custom': '自定义AI'
};

/**
 * AI类型到logo路径的映射
 */
export const AI_TYPE_LOGOS = {
  'zhipu': '/src/assets/AI-svg/zhipu-color.svg',
  'openai': '/src/assets/AI-svg/openai.svg',
  'anthropic': '/src/assets/AI-svg/anthropic.svg',
  'gemini': '/src/assets/AI-svg/gemini-color.svg',
  'deepseek': '/src/assets/AI-svg/deepseek-color.svg',
  'doubao': '/src/assets/AI-svg/doubao-color.svg',
  'custom': null // 自定义AI没有特定logo
};

/**
 * 获取AI的显示名称
 * @param {string} type AI类型
 * @param {string} customName 自定义名称（可选）
 * @returns {string} 显示名称
 */
export function getAIName(type, customName = null) {
  if (customName && customName.trim()) {
    return customName.trim();
  }
  return AI_TYPE_NAMES[type] || AI_TYPE_NAMES['custom'];
}

/**
 * 获取AI的logo路径
 * @param {string} type AI类型
 * @returns {string|null} logo路径或null
 */
export function getAILogo(type) {
  return AI_TYPE_LOGOS[type] || null;
}

/**
 * 验证AI类型是否有效
 * @param {string} type AI类型
 * @returns {boolean} 是否有效
 */
export function isValidAIType(type) {
  return Object.keys(AI_TYPE_NAMES).includes(type);
}

/**
 * 获取所有支持的AI类型
 * @returns {Array} AI类型数组
 */
export function getSupportedAITypes() {
  return Object.keys(AI_TYPE_NAMES);
}

/**
 * 格式化AI配置信息用于显示
 * @param {Object} config AI配置对象
 * @returns {Object} 格式化后的配置信息
 */
export function formatAIConfig(config) {
  if (!config) return null;
  
  return {
    id: config.id,
    name: getAIName(config.type, config.name),
    type: config.type,
    model: config.model,
    logo: getAILogo(config.type),
    displayName: getAIName(config.type, config.name)
  };
}
