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
