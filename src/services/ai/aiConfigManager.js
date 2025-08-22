import { AIConfig } from './types';

/**
 * AI配置管理器
 * 负责管理AI配置的增删改查和本地存储
 */
export class AIConfigManager {
  constructor() {
    this.configs = new Map();
    this.defaultConfigId = null;
    this.loadFromStorage();
  }

  /**
   * 从本地存储加载配置
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('ai-configs');
      if (stored) {
        const data = JSON.parse(stored);
        this.configs.clear();
        
        if (data.configs && Array.isArray(data.configs)) {
          data.configs.forEach(configData => {
            const config = AIConfig.fromObject(configData);
            this.configs.set(config.id, config);
          });
        }
        
        this.defaultConfigId = data.defaultConfigId || null;
      }
    } catch (error) {
      console.error('加载AI配置失败:', error);
    }
  }

  /**
   * 保存配置到本地存储
   */
  saveToStorage() {
    try {
      const data = {
        configs: Array.from(this.configs.values()).map(config => config.toObject()),
        defaultConfigId: this.defaultConfigId
      };
      localStorage.setItem('ai-configs', JSON.stringify(data));
    } catch (error) {
      console.error('保存AI配置失败:', error);
    }
  }

  /**
   * 添加配置
   * @param {AIConfig} config - AI配置
   * @returns {boolean} 是否添加成功
   */
  addConfig(config) {
    if (!(config instanceof AIConfig)) {
      throw new Error('配置必须是AIConfig实例');
    }

    // 验证配置
    const validation = config.validate();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 检查名称是否重复
    const existingConfig = Array.from(this.configs.values()).find(
      c => c.name === config.name && c.id !== config.id
    );
    if (existingConfig) {
      throw new Error('配置名称已存在');
    }

    // 如果是第一个配置，设为默认
    if (this.configs.size === 0) {
      config.isDefault = true;
      this.defaultConfigId = config.id;
    }

    this.configs.set(config.id, config);
    this.saveToStorage();
    return true;
  }

  /**
   * 更新配置
   * @param {string} id - 配置ID
   * @param {Object} updates - 更新数据
   * @returns {boolean} 是否更新成功
   */
  updateConfig(id, updates) {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error('配置不存在');
    }

    // 应用更新
    Object.assign(config, updates);
    config.updatedAt = new Date().toISOString();

    // 验证更新后的配置
    const validation = config.validate();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 检查名称是否重复
    const existingConfig = Array.from(this.configs.values()).find(
      c => c.name === config.name && c.id !== config.id
    );
    if (existingConfig) {
      throw new Error('配置名称已存在');
    }

    this.configs.set(id, config);
    this.saveToStorage();
    return true;
  }

  /**
   * 删除配置
   * @param {string} id - 配置ID
   * @returns {boolean} 是否删除成功
   */
  removeConfig(id) {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error('配置不存在');
    }

    // 如果删除的是默认配置，需要重新设置默认配置
    if (config.isDefault) {
      const otherConfigs = Array.from(this.configs.values()).filter(c => c.id !== id);
      if (otherConfigs.length > 0) {
        const newDefault = otherConfigs[0];
        newDefault.isDefault = true;
        this.defaultConfigId = newDefault.id;
        this.configs.set(newDefault.id, newDefault);
      } else {
        this.defaultConfigId = null;
      }
    }

    this.configs.delete(id);
    this.saveToStorage();
    return true;
  }

  /**
   * 获取配置
   * @param {string} id - 配置ID
   * @returns {AIConfig|null} 配置实例
   */
  getConfig(id) {
    return this.configs.get(id) || null;
  }

  /**
   * 获取所有配置
   * @returns {Array<AIConfig>} 配置列表
   */
  getAllConfigs() {
    return Array.from(this.configs.values());
  }

  /**
   * 获取启用的配置
   * @returns {Array<AIConfig>} 启用的配置列表
   */
  getEnabledConfigs() {
    return Array.from(this.configs.values()).filter(config => config.enabled);
  }

  /**
   * 获取默认配置
   * @returns {AIConfig|null} 默认配置
   */
  getDefaultConfig() {
    if (!this.defaultConfigId) {
      return null;
    }
    return this.configs.get(this.defaultConfigId) || null;
  }

  /**
   * 设置默认配置
   * @param {string} id - 配置ID
   * @returns {boolean} 是否设置成功
   */
  setDefaultConfig(id) {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error('配置不存在');
    }

    // 取消之前的默认配置
    if (this.defaultConfigId) {
      const oldDefault = this.configs.get(this.defaultConfigId);
      if (oldDefault) {
        oldDefault.isDefault = false;
        this.configs.set(this.defaultConfigId, oldDefault);
      }
    }

    // 设置新的默认配置
    config.isDefault = true;
    this.defaultConfigId = id;
    this.configs.set(id, config);
    this.saveToStorage();
    return true;
  }

  /**
   * 启用/禁用配置
   * @param {string} id - 配置ID
   * @param {boolean} enabled - 是否启用
   * @returns {boolean} 是否操作成功
   */
  setConfigEnabled(id, enabled) {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error('配置不存在');
    }

    config.enabled = enabled;
    config.updatedAt = new Date().toISOString();
    this.configs.set(id, config);
    this.saveToStorage();
    return true;
  }

  /**
   * 获取配置数量
   * @returns {number} 配置总数
   */
  getConfigCount() {
    return this.configs.size;
  }

  /**
   * 获取启用的配置数量
   * @returns {number} 启用的配置数量
   */
  getEnabledConfigCount() {
    return this.getEnabledConfigs().length;
  }

  /**
   * 清空所有配置
   */
  clearAllConfigs() {
    this.configs.clear();
    this.defaultConfigId = null;
    this.saveToStorage();
  }

  /**
   * 导出配置数据
   * @returns {Object} 配置数据
   */
  exportData() {
    return {
      configs: Array.from(this.configs.values()).map(config => config.toObject()),
      defaultConfigId: this.defaultConfigId,
      exportTime: new Date().toISOString()
    };
  }

  /**
   * 导入配置数据
   * @param {Object} data - 配置数据
   * @returns {boolean} 是否导入成功
   */
  importData(data) {
    try {
      if (!data.configs || !Array.isArray(data.configs)) {
        throw new Error('无效的配置数据格式');
      }

      // 清空现有配置
      this.configs.clear();
      this.defaultConfigId = null;

      // 导入新配置
      data.configs.forEach(configData => {
        const config = AIConfig.fromObject(configData);
        this.configs.set(config.id, config);
      });

      // 设置默认配置
      if (data.defaultConfigId && this.configs.has(data.defaultConfigId)) {
        this.defaultConfigId = data.defaultConfigId;
        const defaultConfig = this.configs.get(data.defaultConfigId);
        if (defaultConfig) {
          defaultConfig.isDefault = true;
          this.configs.set(data.defaultConfigId, defaultConfig);
        }
      }

      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('导入AI配置失败:', error);
      throw error;
    }
  }
}
