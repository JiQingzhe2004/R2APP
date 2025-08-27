/**
 * 对话存储管理器
 * 使用SQLite数据库进行对话数据的持久化存储和加载
 */
class ChatStorage {
  constructor() {
    this.maxHistorySize = 1000; // 最大保存1000条对话
  }

  /**
   * 保存对话历史
   * @param {Array} messages 对话消息数组
   * @param {string} conversationId 对话ID
   * @param {Object} conversationInfo 对话信息（可选）
   */
  async saveChatHistory(messages, conversationId = 'default', conversationInfo = null) {
    try {
      // 保存对话信息
      if (conversationInfo) {
        await window.api.chatSaveConfig({
          id: conversationId,
          name: conversationInfo.name || `对话 ${conversationId}`,
          type: 'conversation',
          model: 'multi-ai',
          participants: conversationInfo.participants || [],
          messageCount: messages.length,
          lastMessageTime: new Date().toISOString()
        });
      } else {
        // 如果没有提供对话信息，至少保存基本的对话元数据
        await window.api.chatSaveConfig({
          id: conversationId,
          name: `对话 ${conversationId}`,
          type: 'conversation',
          model: 'multi-ai',
          participants: [],
          messageCount: messages.length,
          lastMessageTime: new Date().toISOString()
        });
      }

      // 确保消息对象包含AI的logo和名字信息
      const enhancedMessages = messages.map(msg => {
        if (msg.role === 'assistant' && msg.config) {
          return {
            ...msg,
            config: {
              ...msg.config,
              // 确保AI类型和名字被正确保存
              type: msg.config.type || 'custom',
              name: msg.config.name || 'AI助手'
            }
          };
        }
        return msg;
      });

      // 保存消息
      await window.api.chatSaveMessages(conversationId, enhancedMessages);
      
      console.log(`[ChatStorage] 已保存 ${messages.length} 条对话消息到SQLite，对话ID: ${conversationId}`);
      return true;
    } catch (error) {
      console.error('[ChatStorage] 保存对话失败:', error);
      return false;
    }
  }

  /**
   * 加载指定对话的历史
   * @param {string} conversationId 对话ID
   * @returns {Array} 对话消息数组
   */
  async loadChatHistory(conversationId = 'default') {
    try {
      const result = await window.api.chatLoadMessages(conversationId, this.maxHistorySize);
      
      if (!result.success) {
        console.error('[ChatStorage] 加载消息失败:', result.error);
        return [];
      }

      const messages = result.messages;
      
      console.log(`[ChatStorage] 已从SQLite加载 ${messages.length} 条对话消息，对话ID: ${conversationId}`);
      return messages;
    } catch (error) {
      console.error('[ChatStorage] 加载对话失败:', error);
      return [];
    }
  }

  /**
   * 获取所有对话历史
   * @returns {Object} 所有配置的对话数据
   */
  async getAllChatHistory() {
    try {
      const result = await window.api.chatGetStats();
      
      if (!result.success) {
        console.error('[ChatStorage] 获取统计信息失败:', result.error);
        return {};
      }

      return result.stats;
    } catch (error) {
      console.error('[ChatStorage] 获取所有对话失败:', error);
      return {};
    }
  }

  /**
   * 清空指定对话的历史
   * @param {string} conversationId 对话ID
   */
  async clearChatHistory(conversationId = 'default') {
    try {
      const result = await window.api.chatClearConfig(conversationId);
      
      if (result.success) {
        console.log(`[ChatStorage] 已清空对话 ${conversationId} 的历史`);
        return true;
      } else {
        console.error('[ChatStorage] 清空对话失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[ChatStorage] 清空对话失败:', error);
      return false;
    }
  }

  /**
   * 删除指定对话（包括配置和消息）
   * @param {string} conversationId 对话ID
   */
  async deleteConversation(conversationId) {
    try {
      // 先清空消息
      const clearResult = await window.api.chatClearConfig(conversationId);
      
      if (clearResult.success) {
        console.log(`[ChatStorage] 已删除对话 ${conversationId}`);
        return true;
      } else {
        console.error('[ChatStorage] 删除对话失败:', clearResult.error);
        return false;
      }
    } catch (error) {
      console.error('[ChatStorage] 删除对话失败:', error);
      return false;
    }
  }

  /**
   * 清空所有对话历史
   */
  async clearAllChatHistory() {
    try {
      const result = await window.api.chatClearAll();
      
      if (result.success) {
        console.log('[ChatStorage] 已清空所有对话历史');
        return true;
      } else {
        console.error('[ChatStorage] 清空所有对话失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[ChatStorage] 清空所有对话失败:', error);
      return false;
    }
  }

  /**
   * 删除过期的对话历史（保留最近30天）
   */
  async cleanupExpiredHistory() {
    try {
      const result = await window.api.chatCleanupExpired();
      
      if (result.success) {
        console.log(`[ChatStorage] 已清理 ${result.changes} 条过期消息`);
        return result.changes;
      } else {
        console.error('[ChatStorage] 清理过期对话失败:', result.error);
        return 0;
      }
    } catch (error) {
      console.error('[ChatStorage] 清理过期对话失败:', error);
      return 0;
    }
  }

  /**
   * 获取对话统计信息
   * @returns {Object} 统计信息
   */
  async getChatStats() {
    try {
      const result = await window.api.chatGetStats();
      
      if (result.success) {
        return result.stats;
      } else {
        console.error('[ChatStorage] 获取统计信息失败:', result.error);
        return { totalConversations: 0, totalMessages: 0, conversations: {} };
      }
    } catch (error) {
      console.error('[ChatStorage] 获取统计信息失败:', error);
      return { totalConversations: 0, totalMessages: 0, conversations: {} };
    }
  }

  /**
   * 更新对话信息
   * @param {string} conversationId 对话ID
   * @param {Object} conversationInfo 对话信息
   */
  async updateConversationInfo(conversationId, conversationInfo) {
    try {
      const result = await window.api.chatSaveConfig({
        id: conversationId,
        name: conversationInfo.name,
        type: 'conversation',
        model: 'multi-ai',
        participants: conversationInfo.participants || [],
        messageCount: conversationInfo.messageCount || 0,
        lastMessageTime: conversationInfo.lastMessageTime || new Date().toISOString()
      });
      
      if (result.success) {
        console.log(`[ChatStorage] 已更新对话信息: ${conversationId}`);
        return true;
      } else {
        console.error('[ChatStorage] 更新对话信息失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[ChatStorage] 更新对话信息失败:', error);
      return false;
    }
  }

  /**
   * 获取所有对话列表
   * @returns {Array} 对话列表
   */
  async getConversations() {
    try {
      const stats = await this.getChatStats();
      const conversations = [];
      
      // 只返回对话类型的数据
      Object.keys(stats.configs || {}).forEach(conversationId => {
        const conversationData = stats.configs[conversationId];
        if (conversationData.type === 'conversation') {
          conversations.push({
            id: conversationId,
            name: conversationData.name,
            messageCount: conversationData.messageCount || 0,
            lastMessageTime: conversationData.lastMessageTime || conversationData.lastUpdated || null,
            participants: conversationData.participants || []
          });
        }
      });
      
      // 按最后消息时间排序
      conversations.sort((a, b) => {
        if (!a.lastMessageTime && !b.lastMessageTime) return 0;
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      });
      
      return conversations;
    } catch (error) {
      console.error('[ChatStorage] 获取对话列表失败:', error);
      return [];
    }
  }

  /**
   * 获取数据库文件大小
   * @returns {number} 文件大小（字节）
   */
  async getDatabaseSize() {
    try {
      const result = await window.api.chatGetDatabaseSize();
      
      if (result.success) {
        return result.size;
      } else {
        console.error('[ChatStorage] 获取数据库大小失败:', result.error);
        return 0;
      }
    } catch (error) {
      console.error('[ChatStorage] 获取数据库大小失败:', error);
      return 0;
    }
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 字节数
   * @returns {string} 格式化后的大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// 创建单例实例
const chatStorage = new ChatStorage();

export default chatStorage;
