const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');

// 验证JWT token的中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: '访问令牌缺失' 
      });
    }

    const db = getDatabase();
    
    // 查找有效的会话
    const [sessions] = await db.execute(`
      SELECT s.*, u.username, u.email, u.role, u.is_active
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > NOW() AND u.is_active = TRUE
    `, [token]);

    if (sessions.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: '访问令牌无效或已过期' 
      });
    }

    const session = sessions[0];
    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role
    };
    
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
};

// 验证管理员权限的中间件
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: '未认证' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: '需要管理员权限' 
    });
  }

  next();
};

// 生成会话token
const generateSessionToken = () => {
  return uuidv4();
};

// 创建用户会话
const createUserSession = async (userId) => {
  try {
    const db = getDatabase();
    const sessionId = uuidv4();
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

    await db.execute(`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `, [sessionId, userId, token, expiresAt]);

    return token;
  } catch (error) {
    console.error('创建用户会话失败:', error);
    throw error;
  }
};

// 清理过期会话
const cleanupExpiredSessions = async () => {
  try {
    const db = getDatabase();
    await db.execute('DELETE FROM sessions WHERE expires_at < NOW()');
  } catch (error) {
    console.error('清理过期会话失败:', error);
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  createUserSession,
  cleanupExpiredSessions
};
