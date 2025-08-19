const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { getDatabase } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 获取公告列表
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    
    // 获取所有公告，按创建时间倒序排列
    const [rows] = await db.execute(`
      SELECT 
        id,
        title,
        content,
        type,
        priority,
        link,
        show_date,
        start_date,
        end_date,
        created_at,
        updated_at
      FROM announcements 
      ORDER BY created_at DESC
    `);

    // 格式化数据
    const announcements = rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type || 'info',
      priority: row.priority || 'normal',
      link: row.link,
      showDate: Boolean(row.show_date),
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      success: true,
      data: announcements,
      count: announcements.length
    });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: '服务器内部错误' 
    });
  }
});

// 创建新公告 - 需要管理员权限
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      title, 
      content, 
      type = 'info', 
      priority = 'normal',
      link,
      showDate = true,
      startDate,
      endDate 
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = new Date();

    await db.execute(`
      INSERT INTO announcements (
        id, title, content, type, priority, link, show_date, 
        start_date, end_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, title, content, type, priority, link, showDate,
      startDate || now, endDate, now, now
    ]);

    res.json({
      success: true,
      message: '公告创建成功',
      data: { id }
    });
  } catch (error) {
    console.error('创建公告失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 更新公告 - 需要管理员权限
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      content, 
      type, 
      priority,
      link,
      showDate,
      startDate,
      endDate 
    } = req.body;

    const db = getDatabase();
    const now = new Date();

    // 检查公告是否存在
    const [existingRows] = await db.execute(
      'SELECT id FROM announcements WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      });
    }

    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (content !== undefined) {
      updateFields.push('content = ?');
      updateValues.push(content);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (link !== undefined) {
      updateFields.push('link = ?');
      updateValues.push(link);
    }
    if (showDate !== undefined) {
      updateFields.push('show_date = ?');
      updateValues.push(showDate);
    }
    if (startDate !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(startDate);
    }
    if (endDate !== undefined) {
      updateFields.push('end_date = ?');
      updateValues.push(endDate);
    }

    updateFields.push('updated_at = ?');
    updateValues.push(now);
    updateValues.push(id);

    await db.execute(`
      UPDATE announcements 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    res.json({
      success: true,
      message: '公告更新成功'
    });
  } catch (error) {
    console.error('更新公告失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 删除公告 - 需要管理员权限
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const [result] = await db.execute(
      'DELETE FROM announcements WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      });
    }

    res.json({
      success: true,
      message: '公告删除成功'
    });
  } catch (error) {
    console.error('删除公告失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 获取单个公告详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const [rows] = await db.execute(`
      SELECT 
        id, title, content, type, priority, link, show_date,
        start_date, end_date, created_at, updated_at
      FROM announcements 
      WHERE id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '公告不存在'
      });
    }

    const announcement = {
      id: rows[0].id,
      title: rows[0].title,
      content: rows[0].content,
      type: rows[0].type || 'info',
      priority: rows[0].priority || 'normal',
      link: rows[0].link,
      showDate: Boolean(rows[0].show_date),
      startDate: rows[0].start_date,
      endDate: rows[0].end_date,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };

    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    console.error('获取公告详情失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

module.exports = router;
