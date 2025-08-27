import { ipcMain } from 'electron';
import { ChatDatabase } from './chat-database.js';

class IPCHandlers {
  constructor() {
    this.chatDatabase = null;
  }

  // 初始化数据库和注册所有 IPC 处理器
  initialize() {
    this.chatDatabase = new ChatDatabase();
    this.registerChatHandlers();
  }

  // 注册聊天相关的 IPC 处理器
  registerChatHandlers() {
    // 保存聊天配置
    ipcMain.handle('chat-save-config', async (event, config) => {
      try {
        await this.chatDatabase.saveConfig(config);
        return { success: true };
      } catch (error) {
        console.error('[IPC] 保存聊天配置失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 保存聊天消息
    ipcMain.handle('chat-save-messages', async (event, configId, messages) => {
      try {
        await this.chatDatabase.saveMessages(configId, messages);
        return { success: true };
      } catch (error) {
        console.error('[IPC] 保存聊天消息失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 加载聊天消息
    ipcMain.handle('chat-load-messages', async (event, configId, limit) => {
      try {
        const messages = await this.chatDatabase.loadMessages(configId, limit);
        return { success: true, messages };
      } catch (error) {
        console.error('[IPC] 加载聊天消息失败:', error);
        return { success: false, error: error.message, messages: [] };
      }
    });

    // 获取聊天统计
    ipcMain.handle('chat-get-stats', async (event) => {
      try {
        const stats = await this.chatDatabase.getStats();
        return { success: true, stats };
      } catch (error) {
        console.error('[IPC] 获取聊天统计失败:', error);
        return { success: false, error: error.message, stats: { totalConfigs: 0, totalMessages: 0, configs: {} } };
      }
    });

    // 清除特定配置的聊天记录
    ipcMain.handle('chat-clear-config', async (event, configId) => {
      try {
        const changes = await this.chatDatabase.clearConfig(configId);
        return { success: true, changes };
      } catch (error) {
        console.error('[IPC] 清除配置聊天记录失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 清除所有聊天记录
    ipcMain.handle('chat-clear-all', async (event) => {
      try {
        const changes = await this.chatDatabase.clearAll();
        return { success: true, changes };
      } catch (error) {
        console.error('[IPC] 清除所有聊天记录失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 清理过期聊天记录
    ipcMain.handle('chat-cleanup-expired', async (event) => {
      try {
        const changes = await this.chatDatabase.cleanupExpired();
        return { success: true, changes };
      } catch (error) {
        console.error('[IPC] 清理过期聊天记录失败:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取数据库大小
    ipcMain.handle('chat-get-database-size', async (event) => {
      try {
        const size = await this.chatDatabase.getDatabaseSize();
        return { success: true, size };
      } catch (error) {
        console.error('[IPC] 获取数据库大小失败:', error);
        return { success: false, error: error.message, size: 0 };
      }
    });
  }

  // 关闭数据库连接
  close() {
    if (this.chatDatabase) {
      this.chatDatabase.close();
    }
  }
}

export { IPCHandlers };
