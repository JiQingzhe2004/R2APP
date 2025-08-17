-- R2APP 统计数据库初始化脚本
-- 请在 MySQL 中执行此脚本

-- 创建数据库
CREATE DATABASE IF NOT EXISTS r2app_analytics 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE r2app_analytics;

-- 创建安装统计表
CREATE TABLE IF NOT EXISTS installs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建使用统计表 - 改名为usage_stats避免关键字冲突
CREATE TABLE IF NOT EXISTS usage_stats (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建每日统计汇总表
CREATE TABLE IF NOT EXISTS daily_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  new_installs INT DEFAULT 0,
  total_usage INT DEFAULT 0,
  unique_users INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入一些测试数据（可选）
INSERT INTO installs (machine_id, version, platform, arch, ip_address, user_agent) VALUES
('test-machine-001', '1.0.0', 'win32', 'x64', '127.0.0.1', 'Test User Agent'),
('test-machine-002', '1.0.0', 'darwin', 'arm64', '127.0.0.1', 'Test User Agent'),
('test-machine-003', '1.0.1', 'linux', 'x64', '127.0.0.1', 'Test User Agent')
ON DUPLICATE KEY UPDATE version = VALUES(version);

INSERT INTO usage_stats (machine_id, session_id, version, platform, arch, uptime, ip_address, user_agent) VALUES
('test-machine-001', 'session-001', '1.0.0', 'win32', 'x64', 300, '127.0.0.1', 'Test User Agent'),
('test-machine-002', 'session-002', '1.0.0', 'darwin', 'arm64', 450, '127.0.0.1', 'Test User Agent'),
('test-machine-003', 'session-003', '1.0.1', 'linux', 'x64', 200, '127.0.0.1', 'Test User Agent');

-- 显示创建的表
SHOW TABLES;

-- 显示表结构
DESCRIBE installs;
DESCRIBE usage_stats;
DESCRIBE daily_stats;

-- 显示测试数据
SELECT 'Installs:' as table_name, COUNT(*) as count FROM installs
UNION ALL
SELECT 'Usage Stats:' as table_name, COUNT(*) as count FROM usage_stats;
