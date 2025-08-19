const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database');
const { createUserSession, cleanupExpiredSessions } = require('../middleware/auth');

const router = express.Router();

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名、邮箱和密码不能为空'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少6位'
      });
    }

    const db = getDatabase();

    // 检查用户名是否已存在
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: '用户名或邮箱已存在'
      });
    }

    // 加密密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const [result] = await db.execute(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, [username, email, passwordHash, 'admin']); // 默认创建管理员用户

    const userId = result.insertId;

    // 创建会话
    const token = await createUserSession(userId);

    res.json({
      success: true,
      message: '用户注册成功',
      data: {
        user: {
          id: userId,
          username,
          email,
          role: 'admin'
        },
        token
      }
    });
  } catch (error) {
    console.error('用户注册失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空'
      });
    }

    const db = getDatabase();

    // 查找用户
    const [users] = await db.execute(`
      SELECT id, username, email, password_hash, role, is_active
      FROM users
      WHERE username = ? OR email = ?
    `, [username, username]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: '账户已被禁用'
      });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '用户名或密码错误'
      });
    }

    // 更新最后登录时间
    await db.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // 创建会话
    const token = await createUserSession(user.id);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('用户登录失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '未认证'
      });
    }

    const db = getDatabase();

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

    res.json({
      success: true,
      data: {
        user: {
          id: session.user_id,
          username: session.username,
          email: session.email,
          role: session.role
        }
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 用户登出
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const db = getDatabase();
      await db.execute('DELETE FROM sessions WHERE token = ?', [token]);
    }

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('用户登出失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 修改密码
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: '未认证'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: '当前密码和新密码不能为空'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: '新密码长度至少6位'
      });
    }

    const db = getDatabase();

    // 获取用户信息
    const [sessions] = await db.execute(`
      SELECT s.user_id, u.password_hash
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > NOW()
    `, [token]);

    if (sessions.length === 0) {
      return res.status(401).json({
        success: false,
        error: '访问令牌无效或已过期'
      });
    }

    const session = sessions[0];

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, session.password_hash);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: '当前密码错误'
      });
    }

    // 加密新密码
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 更新密码
    await db.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, session.user_id]
    );

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 定期清理过期会话
setInterval(cleanupExpiredSessions, 60 * 60 * 1000); // 每小时清理一次

module.exports = router;
