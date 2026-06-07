// server/routes/users.js - 用户管理路由
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const database = require('../database');
const { requireRole } = require('../middleware/auth');

// 获取当前登录用户信息
router.get('/me', (req, res) => {
  const db = database.getDb();
  db.get(
    'SELECT id, username, name, email, phone, role, status, last_login, login_count, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) return res.status(500).json({ error: '数据库错误' });
      if (!user) return res.status(404).json({ error: '用户不存在' });
      res.json({ user });
    }
  );
});

// 修改当前用户密码
router.post('/me/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '旧密码和新密码不能为空' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少6位' });
  }

  const db = database.getDb();

  db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], async (err, row) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    if (!row) return res.status(404).json({ error: '用户不存在' });

    const validPassword = await bcrypt.compare(oldPassword, row.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: '旧密码错误' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newHash, req.user.id],
      (err) => {
        if (err) return res.status(500).json({ error: '修改密码失败' });
        res.json({ message: '密码修改成功' });
      }
    );
  });
});

// 获取用户列表（管理员/经理可访问）
router.get('/', requireRole(['admin', 'manager']), (req, res) => {
  const db = database.getDb();
  const { role, status, search, page = 1, limit = 20 } = req.query;
  
  let query = 'SELECT id, username, name, email, phone, role, status, last_login, login_count, created_at FROM users WHERE 1=1';
  const params = [];

  if (role) {
    query += ' AND role = ?';
    params.push(role);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (username LIKE ? OR name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(query, params, (err, users) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json({ 
      users, 
      page: parseInt(page), 
      limit: parseInt(limit),
      total: users.length 
    });
  });
});

// 获取单个用户详情（管理员可访问）
router.get('/:id', requireRole(['admin']), (req, res) => {
  const db = database.getDb();
  db.get(
    'SELECT id, username, name, email, phone, role, status, last_login, login_count, created_at, updated_at FROM users WHERE id = ?',
    [req.params.id],
    (err, user) => {
      if (err) return res.status(500).json({ error: '数据库错误' });
      if (!user) return res.status(404).json({ error: '用户不存在' });
      res.json({ user });
    }
  );
});

// 创建用户（管理员可访问）
router.post('/', requireRole(['admin']), async (req, res) => {
  const { username, password, name, email, phone, role } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: '用户名、密码和姓名不能为空' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  const db = database.getDb();

  // 检查用户名是否存在
  db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    if (row) return res.status(400).json({ error: '用户名已存在' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();
    const userRole = role && ['admin', 'manager', 'user'].includes(role) ? role : 'user';

    db.run(
      `INSERT INTO users (username, password_hash, name, email, phone, role, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, passwordHash, name, email || null, phone || null, userRole, 'active', now, now],
      function(err) {
        if (err) {
          console.error('创建用户失败:', err);
          return res.status(500).json({ error: '创建用户失败' });
        }
        res.status(201).json({ 
          message: '用户创建成功', 
          userId: this.lastID 
        });
      }
    );
  });
});

// 更新用户信息（管理员可访问）
router.put('/:id', requireRole(['admin']), async (req, res) => {
  const { name, email, phone, role, status } = req.body;
  const userId = req.params.id;

  // 不能修改自己的角色（防止误操作丢失权限）
  if (parseInt(userId) === req.user.id && role && role !== req.user.role) {
    return res.status(400).json({ error: '不能修改自己的角色' });
  }

  const db = database.getDb();
  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
  if (role !== undefined && ['admin', 'manager', 'user'].includes(role)) { 
    updates.push('role = ?'); 
    params.push(role); 
  }
  if (status !== undefined && ['active', 'disabled'].includes(status)) { 
    updates.push('status = ?'); 
    params.push(status); 
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(userId);

  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

  db.run(sql, params, function(err) {
    if (err) {
      console.error('更新用户失败:', err);
      return res.status(500).json({ error: '更新用户失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ message: '用户更新成功' });
  });
});

// 重置用户密码（管理员可访问）
router.post('/:id/reset-password', requireRole(['admin']), async (req, res) => {
  const { newPassword } = req.body;
  const userId = req.params.id;

  if (!newPassword) {
    return res.status(400).json({ error: '新密码不能为空' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少6位' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  const db = database.getDb();
  db.run(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [passwordHash, userId],
    function(err) {
      if (err) return res.status(500).json({ error: '重置密码失败' });
      if (this.changes === 0) return res.status(404).json({ error: '用户不存在' });
      res.json({ message: '密码重置成功' });
    }
  );
});

// 删除用户（管理员可访问，不能删除自己）
router.delete('/:id', requireRole(['admin']), (req, res) => {
  const userId = req.params.id;

  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: '不能删除自己' });
  }

  // 不能删除最后一个管理员
  const db = database.getDb();
  db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin'], (err, row) => {
    if (err) return res.status(500).json({ error: '数据库错误' });

    db.get('SELECT role FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) return res.status(500).json({ error: '数据库错误' });
      if (!user) return res.status(404).json({ error: '用户不存在' });

      if (user.role === 'admin' && row.count <= 1) {
        return res.status(400).json({ error: '不能删除最后一个管理员' });
      }

      db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) return res.status(500).json({ error: '删除用户失败' });
        res.json({ message: '用户删除成功' });
      });
    });
  });
});

// 获取登录日志（管理员可访问）
router.get('/logs/login', requireRole(['admin']), (req, res) => {
  const db = database.getDb();
  const { userId, page = 1, limit = 50 } = req.query;

  let query = `
    SELECT l.*, u.name as user_name 
    FROM login_logs l 
    LEFT JOIN users u ON l.user_id = u.id 
    WHERE 1=1
  `;
  const params = [];

  if (userId) {
    query += ' AND l.user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(query, params, (err, logs) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json({ logs });
  });
});

module.exports = router;
