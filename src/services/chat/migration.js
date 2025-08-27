/**
 * 数据迁移工具
 * 将现有的JSON存储数据迁移到SQLite数据库
 */
class ChatMigration {
  constructor() {
    this.storageKey = 'ai-chat-history';
  }

  /**
   * 检查是否有需要迁移的数据
   * @returns {Promise<boolean>} 是否有需要迁移的数据
   */
  async hasLegacyData() {
    try {
      const result = await window.api.getSetting(this.storageKey);
      if (!result || !result.success || !result.value) {
        return false;
      }

      const data = JSON.parse(result.value);
      return Object.keys(data).length > 0;
    } catch (error) {
      console.error('[ChatMigration] 检查遗留数据失败:', error);
      return false;
    }
  }

  /**
   * 获取遗留数据
   * @returns {Promise<Object>} 遗留数据
   */
  async getLegacyData() {
    try {
      const result = await window.api.getSetting(this.storageKey);
      if (!result || !result.success || !result.value) {
        return {};
      }

      return JSON.parse(result.value);
    } catch (error) {
      console.error('[ChatMigration] 获取遗留数据失败:', error);
      return {};
    }
  }

  /**
   * 迁移数据到SQLite
   * @returns {Promise<Object>} 迁移结果
   */
  async migrateToSQLite() {
    try {
      console.log('[ChatMigration] 开始数据迁移...');

      const legacyData = await this.getLegacyData();
      if (Object.keys(legacyData).length === 0) {
        console.log('[ChatMigration] 没有需要迁移的数据');
        return { success: true, migrated: 0, errors: [] };
      }

      let migratedCount = 0;
      const errors = [];

      for (const [configId, chatData] of Object.entries(legacyData)) {
        try {
          if (!chatData.messages || !Array.isArray(chatData.messages)) {
            console.warn(`[ChatMigration] 跳过无效配置: ${configId}`);
            continue;
          }

          // 保存配置信息
          if (chatData.messages.length > 0 && chatData.messages[0].config) {
            await window.api.chatSaveConfig({
              id: configId,
              name: chatData.messages[0].config.name || configId,
              type: chatData.messages[0].config.type || 'unknown',
              model: chatData.messages[0].config.model || ''
            });
          }

          // 保存消息
          await window.api.chatSaveMessages(configId, chatData.messages);
          
          migratedCount += chatData.messages.length;
          console.log(`[ChatMigration] 已迁移配置 ${configId}: ${chatData.messages.length} 条消息`);
        } catch (error) {
          console.error(`[ChatMigration] 迁移配置 ${configId} 失败:`, error);
          errors.push({ configId, error: error.message });
        }
      }

      console.log(`[ChatMigration] 迁移完成: ${migratedCount} 条消息, ${errors.length} 个错误`);
      return { success: true, migrated: migratedCount, errors };
    } catch (error) {
      console.error('[ChatMigration] 迁移失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 备份遗留数据
   * @returns {Promise<boolean>} 备份是否成功
   */
  async backupLegacyData() {
    try {
      const legacyData = await this.getLegacyData();
      if (Object.keys(legacyData).length === 0) {
        return true;
      }

      const backupKey = `${this.storageKey}-backup-${Date.now()}`;
      await window.api.setSetting(backupKey, JSON.stringify(legacyData));
      
      console.log(`[ChatMigration] 遗留数据已备份到: ${backupKey}`);
      return true;
    } catch (error) {
      console.error('[ChatMigration] 备份遗留数据失败:', error);
      return false;
    }
  }

  /**
   * 清理遗留数据
   * @returns {Promise<boolean>} 清理是否成功
   */
  async cleanupLegacyData() {
    try {
      await window.api.setSetting(this.storageKey, '{}');
      console.log('[ChatMigration] 遗留数据已清理');
      return true;
    } catch (error) {
      console.error('[ChatMigration] 清理遗留数据失败:', error);
      return false;
    }
  }

  /**
   * 执行完整迁移流程
   * @returns {Promise<Object>} 迁移结果
   */
  async performMigration() {
    try {
      console.log('[ChatMigration] 开始执行数据迁移...');

      // 检查是否有遗留数据
      const hasLegacyData = await this.hasLegacyData();
      if (!hasLegacyData) {
        console.log('[ChatMigration] 没有需要迁移的数据');
        return { success: true, message: '没有需要迁移的数据' };
      }

      // 备份遗留数据
      const backupSuccess = await this.backupLegacyData();
      if (!backupSuccess) {
        return { success: false, error: '备份遗留数据失败' };
      }

      // 迁移数据
      const migrationResult = await this.migrateToSQLite();
      if (!migrationResult.success) {
        return migrationResult;
      }

      // 清理遗留数据
      const cleanupSuccess = await this.cleanupLegacyData();
      if (!cleanupSuccess) {
        console.warn('[ChatMigration] 清理遗留数据失败，但不影响迁移结果');
      }

      return {
        success: true,
        message: `迁移完成: ${migrationResult.migrated} 条消息`,
        migrated: migrationResult.migrated,
        errors: migrationResult.errors
      };
    } catch (error) {
      console.error('[ChatMigration] 迁移流程失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 创建单例实例
const chatMigration = new ChatMigration();

export default chatMigration;
