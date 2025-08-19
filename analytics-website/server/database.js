const mysql = require('mysql2/promise');
require('dotenv').config();

let connection;

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'r2app_analytics',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

async function initDatabase() {
  try {
    // 创建连接池
    connection = mysql.createPool(dbConfig);
    
    // 测试连接
    await connection.getConnection();
    console.log('✅ MySQL数据库连接成功');
    
    // 创建数据库表
    await createTables();
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    throw error;
  }
}

async function createTables() {
  try {
    const tables = [
      // 安装统计表
      `CREATE TABLE IF NOT EXISTS installs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        machine_id VARCHAR(255) UNIQUE NOT NULL,
        version VARCHAR(100) NOT NULL,
        platform VARCHAR(100) NOT NULL,
        arch VARCHAR(100) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        INDEX idx_machine_id (machine_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_platform (platform)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // 使用统计表 - 改名为usage_stats避免关键字冲突
      `CREATE TABLE IF NOT EXISTS usage_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        machine_id VARCHAR(255) NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        version VARCHAR(100) NOT NULL,
        platform VARCHAR(100) NOT NULL,
        arch VARCHAR(100) NOT NULL,
        uptime INT DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        INDEX idx_machine_id (machine_id),
        INDEX idx_session_id (session_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_platform (platform)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // 每日统计汇总表
      `CREATE TABLE IF NOT EXISTS daily_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE UNIQUE NOT NULL,
        new_installs INT DEFAULT 0,
        total_usage INT DEFAULT 0,
        unique_users INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // 公告表
      `CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type ENUM('info', 'warning', 'error', 'success') DEFAULT 'info',
        priority ENUM('low', 'normal', 'high') DEFAULT 'normal',
        link VARCHAR(500),
        show_date BOOLEAN DEFAULT TRUE,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_priority (priority),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // 用户表
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // 会话表
      `CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_token (token),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    for (let i = 0; i < tables.length; i++) {
      try {
        await connection.execute(tables[i]);
        console.log(`✅ 表 ${i + 1} 创建/检查完成`);
      } catch (error) {
        console.error(`❌ 创建表 ${i + 1} 失败:`, error.message);
        throw error;
      }
    }
    
    console.log('✅ 所有数据库表创建完成');
    
  } catch (error) {
    console.error('❌ 创建数据库表失败:', error);
    throw error;
  }
}

function getDatabase() {
  return connection;
}

async function closeDatabase() {
  try {
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  } catch (error) {
    console.error('❌ 关闭数据库连接失败:', error.message);
    throw error;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};
