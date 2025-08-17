const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { getDatabase } = require('../database');

const router = express.Router();

// 获取客户端IP地址
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

// 记录安装统计
router.post('/install', async (req, res) => {
  try {
    const { machineId, version, platform, arch } = req.body;
    
    if (!machineId || !version || !platform || !arch) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['machineId', 'version', 'platform', 'arch']
      });
    }

    const db = getDatabase();
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    // 检查是否已经记录过这个机器ID的安装
    const [existingRows] = await db.execute(
      'SELECT id FROM installs WHERE machine_id = ?',
      [machineId]
    );

    if (existingRows.length > 0) {
      // 已存在，更新版本信息
      await db.execute(
        'UPDATE installs SET version = ?, platform = ?, arch = ?, ip_address = ?, user_agent = ? WHERE machine_id = ?',
        [version, platform, arch, ipAddress, userAgent, machineId]
      );
      
      res.json({ 
        success: true, 
        message: '安装记录已更新',
        machineId,
        timestamp: new Date().toISOString()
      });
    } else {
      // 新安装，插入记录
      await db.execute(
        'INSERT INTO installs (machine_id, version, platform, arch, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
        [machineId, version, platform, arch, ipAddress, userAgent]
      );
      
      res.json({ 
        success: true, 
        message: '安装记录已创建',
        machineId,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('安装统计处理失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 记录使用统计
router.post('/usage', async (req, res) => {
  try {
    const { machineId, version, platform, arch, uptime } = req.body;
    
    if (!machineId || !version || !platform || !arch) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['machineId', 'version', 'platform', 'arch']
      });
    }

    const db = getDatabase();
    const sessionId = uuidv4();
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    await db.execute(
      'INSERT INTO usage_stats (machine_id, session_id, version, platform, arch, uptime, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [machineId, sessionId, version, platform, arch, uptime || 0, ipAddress, userAgent]
    );
    
    res.json({ 
      success: true, 
      message: '使用记录已创建',
      sessionId,
      machineId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('使用统计处理失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取仪表盘统计数据
router.get('/dashboard', async (req, res) => {
  try {
    const db = getDatabase();
    const today = moment().format('YYYY-MM-DD');
    const last7Days = moment().subtract(7, 'days').format('YYYY-MM-DD');

    // 获取总安装数
    const [installResult] = await db.execute('SELECT COUNT(*) as total FROM installs');
    
    // 获取今日安装数
    const [todayInstallResult] = await db.execute(
      'SELECT COUNT(*) as today FROM installs WHERE DATE(timestamp) = ?',
      [today]
    );
    
    // 获取总使用次数
    const [usageResult] = await db.execute('SELECT COUNT(*) as total FROM usage_stats');
    
    // 获取今日使用次数
    const [todayUsageResult] = await db.execute(
      'SELECT COUNT(*) as today FROM usage_stats WHERE DATE(timestamp) = ?',
      [today]
    );
    
    // 获取最近7天每日数据
    const [weeklyData] = await db.execute(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT machine_id) as unique_users,
        COUNT(*) as total_usage
       FROM usage_stats 
       WHERE DATE(timestamp) >= ? 
       GROUP BY DATE(timestamp) 
       ORDER BY date DESC`,
      [last7Days]
    );
    
    // 获取平台分布
    const [platformData] = await db.execute(
      'SELECT platform, COUNT(*) as count FROM installs GROUP BY platform'
    );
    
    // 获取版本分布
    const [versionData] = await db.execute(
      'SELECT version, COUNT(*) as count FROM installs GROUP BY version ORDER BY count DESC LIMIT 10'
    );

    res.json({
      success: true,
      data: {
        overview: {
          totalInstalls: installResult[0].total,
          todayInstalls: todayInstallResult[0].today,
          totalUsage: usageResult[0].total,
          todayUsage: todayUsageResult[0].today
        },
        weeklyData: weeklyData || [],
        platformDistribution: platformData || [],
        versionDistribution: versionData || []
      }
    });
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取详细统计数据
router.get('/stats', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const db = getDatabase();
    
    let startDate;
    switch (period) {
      case '1d':
        startDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
        break;
      case '7d':
        startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
        break;
      case '30d':
        startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
        break;
      default:
        startDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
    }

    // 获取每日统计数据
    const [dailyStats] = await db.execute(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT machine_id) as unique_users,
        COUNT(*) as total_usage
       FROM usage_stats 
       WHERE DATE(timestamp) >= ? 
       GROUP BY DATE(timestamp) 
       ORDER BY date DESC`,
      [startDate]
    );

    res.json({
      success: true,
      data: {
        period,
        startDate,
        dailyStats: dailyStats || []
      }
    });
  } catch (error) {
    console.error('获取详细统计失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
