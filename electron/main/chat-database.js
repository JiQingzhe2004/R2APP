import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import fs from 'fs';

/**
 * AI对话数据库管理器
 * 使用SQLite存储对话数据
 */
class ChatDatabase {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.init();
  }

  /**
   * 初始化数据库
   */
  init() {
    try {
      // 确保数据目录存在
      const userDataPath = app.getPath('userData');
      const dbDir = join(userDataPath, 'chat-data');
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.dbPath = join(dbDir, 'chat-history.db');
      this.db = new Database(this.dbPath);
      
      // 启用WAL模式以提高性能
      this.db.pragma('journal_mode = WAL');
      
      // 创建表结构
      this.createTables();
      
      console.log(`[ChatDatabase] 数据库初始化成功: ${this.dbPath}`);
    } catch (error) {
      console.error('[ChatDatabase] 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建数据库表
   */
  createTables() {
    // 创建对话配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建对话消息表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        thinking TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_error BOOLEAN DEFAULT FALSE,
        usage TEXT,
        ai_logo TEXT,
        ai_name TEXT,
        FOREIGN KEY (config_id) REFERENCES chat_configs(id) ON DELETE CASCADE
      )
    `);

    // 创建索引以提高查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_config_id ON chat_messages(config_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_configs_updated_at ON chat_configs(updated_at);
    `);

    // 检查是否需要添加新字段（向后兼容）
    this.addNewFieldsIfNeeded();

    // 升级现有数据库
    this.upgradeDatabase();

    // 同步AI配置到数据库
    this.syncAIConfigs();

    console.log('[ChatDatabase] 数据库表创建完成');
  }

  /**
   * 检查并添加新字段（向后兼容）
   */
  addNewFieldsIfNeeded() {
    try {
      // 检查ai_logo字段是否存在
      const checkLogoField = this.db.prepare("PRAGMA table_info(chat_messages)");
      const columns = checkLogoField.all();
      const hasAiLogo = columns.some(col => col.name === 'ai_logo');
      const hasAiName = columns.some(col => col.name === 'ai_name');

      if (!hasAiLogo) {
        this.db.exec('ALTER TABLE chat_messages ADD COLUMN ai_logo TEXT');
        console.log('[ChatDatabase] 已添加 ai_logo 字段');
      }

      if (!hasAiName) {
        this.db.exec('ALTER TABLE chat_messages ADD COLUMN ai_name TEXT');
        console.log('[ChatDatabase] 已添加 ai_name 字段');
      }
    } catch (error) {
      console.error('[ChatDatabase] 添加新字段失败:', error);
    }
  }

  /**
   * 保存或更新对话配置
   * @param {Object} config 配置对象
   */
  saveConfig(config) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO chat_configs (id, name, type, model, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(config.id, config.name, config.type, config.model);
      console.log(`[ChatDatabase] 配置已保存: ${config.id}`);
    } catch (error) {
      console.error('[ChatDatabase] 保存配置失败:', error);
      throw error;
    }
  }

  /**
   * 保存对话消息
   * @param {string} configId 配置ID
   * @param {Array} messages 消息数组
   */
  saveMessages(configId, messages) {
    try {
      // 开始事务
      const transaction = this.db.transaction(() => {
        // 先删除该配置的所有消息
        const deleteStmt = this.db.prepare('DELETE FROM chat_messages WHERE config_id = ?');
        deleteStmt.run(configId);

        // 插入新消息
        const insertStmt = this.db.prepare(`
          INSERT INTO chat_messages (config_id, role, content, thinking, timestamp, is_error, usage, ai_logo, ai_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const message of messages) {
          // 提取AI logo和名字信息
          let aiLogo = null;
          let aiName = null;
          
          if (message.role === 'assistant' && message.config) {
            aiLogo = message.config.type; // 使用AI类型作为logo标识
            aiName = message.config.name; // 使用AI配置名称
          }
          
          insertStmt.run(
            configId,
            message.role,
            message.content || '',
            message.thinking || '',
            message.timestamp,
            message.isError ? 1 : 0,
            message.usage ? JSON.stringify(message.usage) : null,
            aiLogo,
            aiName
          );
        }

        // 更新配置的更新时间
        const updateStmt = this.db.prepare('UPDATE chat_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        updateStmt.run(configId);
      });

      transaction();
      console.log(`[ChatDatabase] 已保存 ${messages.length} 条消息到配置 ${configId}`);
    } catch (error) {
      console.error('[ChatDatabase] 保存消息失败:', error);
      throw error;
    }
  }

  /**
   * 加载对话消息
   * @param {string} configId 配置ID
   * @param {number} limit 限制数量，默认1000
   * @returns {Array} 消息数组
   */
  loadMessages(configId, limit = 1000) {
    try {
      // 首先获取配置信息
      const configStmt = this.db.prepare(`
        SELECT id, name, type, model FROM chat_configs WHERE id = ?
      `);
      const configRow = configStmt.get(configId);
      
      if (!configRow) {
        console.warn(`[ChatDatabase] 配置 ${configId} 不存在`);
        return [];
      }
      
      const config = {
        id: configRow.id,
        name: configRow.name,
        type: configRow.type,
        model: configRow.model
      };
      
             // 获取消息
       const stmt = this.db.prepare(`
         SELECT * FROM chat_messages 
         WHERE config_id = ? 
         ORDER BY timestamp ASC
         LIMIT ?
       `);
      
      const rows = stmt.all(configId, limit);
      
      // 转换数据格式，为AI消息添加配置信息
      const messages = rows.map(row => {
        const message = {
          id: row.id,
          role: row.role,
          content: row.content,
          thinking: row.thinking,
          timestamp: row.timestamp,
          isError: Boolean(row.is_error),
          usage: row.usage ? JSON.parse(row.usage) : null
        };
        
        // 为AI消息添加配置信息
        if (row.role === 'assistant') {
          // 优先使用数据库中保存的AI信息，如果没有则使用配置信息
          message.config = {
            id: config.id,
            name: row.ai_name || config.name,
            type: row.ai_logo || config.type,
            model: config.model
          };
        }
        
        return message;
      });

      console.log(`[ChatDatabase] 已加载 ${messages.length} 条消息，配置: ${config.name}`);
      return messages;
    } catch (error) {
      console.error('[ChatDatabase] 加载消息失败:', error);
      return [];
    }
  }

  /**
   * 获取所有配置的统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    try {
             const configStmt = this.db.prepare(`
         SELECT 
           c.id,
           c.name,
           c.type,
           c.updated_at,
           COUNT(m.id) as message_count,
           MAX(m.timestamp) as last_message_time
         FROM chat_configs c
         LEFT JOIN chat_messages m ON c.id = m.config_id
         GROUP BY c.id
         ORDER BY last_message_time DESC, c.updated_at DESC
       `);
      
      const rows = configStmt.all();
      
      const stats = {
        totalConfigs: rows.length,
        totalMessages: 0,
        configs: {}
      };

             for (const row of rows) {
         stats.totalMessages += row.message_count;
         stats.configs[row.id] = {
           name: row.name,
           type: row.type,
           messageCount: row.message_count,
           lastUpdated: row.updated_at,
           lastMessageTime: row.last_message_time
         };
       }

      return stats;
    } catch (error) {
      console.error('[ChatDatabase] 获取统计信息失败:', error);
      return { totalConfigs: 0, totalMessages: 0, configs: {} };
    }
  }

  /**
   * 清空指定配置的对话
   * @param {string} configId 配置ID
   */
  clearConfig(configId) {
    try {
      // 删除消息
      const messageStmt = this.db.prepare('DELETE FROM chat_messages WHERE config_id = ?');
      const messageResult = messageStmt.run(configId);
      
      // 删除配置
      const configStmt = this.db.prepare('DELETE FROM chat_configs WHERE id = ?');
      const configResult = configStmt.run(configId);
      
      console.log(`[ChatDatabase] 已删除配置 ${configId} 的 ${messageResult.changes} 条消息和配置记录`);
      return messageResult.changes;
    } catch (error) {
      console.error('[ChatDatabase] 删除配置失败:', error);
      throw error;
    }
  }

  /**
   * 清空所有对话
   */
  clearAll() {
    try {
      const stmt = this.db.prepare('DELETE FROM chat_messages');
      const result = stmt.run();
      
      console.log(`[ChatDatabase] 已清空所有 ${result.changes} 条消息`);
      return result.changes;
    } catch (error) {
      console.error('[ChatDatabase] 清空所有对话失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期的对话（保留最近30天）
   */
  cleanupExpired() {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM chat_messages 
        WHERE timestamp < datetime('now', '-30 days')
      `);
      
      const result = stmt.run();
      
      console.log(`[ChatDatabase] 已清理 ${result.changes} 条过期消息`);
      return result.changes;
    } catch (error) {
      console.error('[ChatDatabase] 清理过期对话失败:', error);
      throw error;
    }
  }

  /**
   * 获取数据库文件大小
   * @returns {number} 文件大小（字节）
   */
  getDatabaseSize() {
    try {
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch (error) {
      console.error('[ChatDatabase] 获取数据库大小失败:', error);
      return 0;
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('[ChatDatabase] 数据库连接已关闭');
    }
  }

  /**
   * 升级现有数据库结构
   * 为现有消息添加AI logo和名字信息
   */
  upgradeDatabase() {
    try {
      console.log('[ChatDatabase] 开始升级数据库...');
      
      // 检查是否有需要升级的数据
      const checkStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM chat_messages 
        WHERE role = 'assistant' AND (ai_logo IS NULL OR ai_name IS NULL)
      `);
      const result = checkStmt.get();
      const needsUpgrade = result.count > 0;
      
      if (!needsUpgrade) {
        console.log('[ChatDatabase] 数据库已是最新版本，无需升级');
        return;
      }
      
      console.log(`[ChatDatabase] 发现 ${result.count} 条需要升级的消息`);
      
      // 获取所有AI消息的配置信息
      const configStmt = this.db.prepare(`
        SELECT DISTINCT config_id FROM chat_messages WHERE role = 'assistant'
      `);
      const configIds = configStmt.all().map(row => row.config_id);
      
      let upgradedCount = 0;
      
      for (const configId of configIds) {
        try {
          // 获取配置信息
          const configRow = this.db.prepare(`
            SELECT id, name, type, model FROM chat_configs WHERE id = ?
          `).get(configId);
          
          if (!configRow) continue;
          
          // 更新该配置下的所有AI消息
          const updateStmt = this.db.prepare(`
            UPDATE chat_messages 
            SET ai_logo = ?, ai_name = ? 
            WHERE config_id = ? AND role = 'assistant'
          `);
          
          const updateResult = updateStmt.run(
            configRow.type,
            configRow.name,
            configId
          );
          
          upgradedCount += updateResult.changes;
          console.log(`[ChatDatabase] 已升级配置 ${configId}: ${updateResult.changes} 条消息`);
        } catch (error) {
          console.error(`[ChatDatabase] 升级配置 ${configId} 失败:`, error);
        }
      }
      
      console.log(`[ChatDatabase] 数据库升级完成，共升级 ${upgradedCount} 条消息`);
    } catch (error) {
      console.error('[ChatDatabase] 数据库升级失败:', error);
    }
  }

  /**
   * 同步AI配置到数据库
   * 确保数据库中有对应的AI配置记录
   */
  syncAIConfigs() {
    try {
      console.log('[ChatDatabase] 开始同步AI配置...');
      
      // 这里我们需要从主进程获取AI配置信息
      // 由于这是数据库层，我们需要通过IPC或其他方式获取
      // 暂时先记录日志，实际实现需要与主进程通信
      console.log('[ChatDatabase] AI配置同步功能需要与主进程通信实现');
      
      // TODO: 实现AI配置同步逻辑
      // 1. 从主进程获取AI配置列表
      // 2. 检查数据库中是否已存在
      // 3. 如果不存在，则插入到chat_configs表
      // 4. 确保配置ID的一致性
      
    } catch (error) {
      console.error('[ChatDatabase] AI配置同步失败:', error);
    }
  }
}

// 创建单例实例
const chatDatabase = new ChatDatabase();

export { ChatDatabase, chatDatabase };
