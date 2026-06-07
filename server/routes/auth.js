// server/routes/auth.js - 认证相关路由（登录、注册、退出）
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const database = require('../database');
const { generateToken } = require('../middleware/auth');

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // 参数验证
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = database.getDb();

  // 查找用户
  db.get('SELECT * FROM users WHERE username = ? AND status = ?', [username, 'active'], async (err, user) => {
    if (err) {
      console.error('登录查询错误:', err);
      return res.status(500).json({ error: '数据库错误' });
    }

    // 记录登录尝试
    const logLogin = (status, failReason) => {
      db.run(
        `INSERT INTO login_logs (user_id, username, ip_address, user_agent, status, fail_reason) VALUES (?, ?, ?, ?, ?, ?)`,
        [user ? user.id : null, username, req.ip || req.connection.remoteAddress, req.get('User-Agent'), status, failReason]
      );
    };

    // 用户不存在或已禁用
    if (!user) {
      logLogin('failed', '用户不存在或已禁用');
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      logLogin('failed', '密码错误');
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间和登录次数
    db.run(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = ?',
      [user.id]
    );

    logLogin('success', null);

    // 生成 Token
    const token = generateToken(user);

    // 返回用户信息（不含密码）
    const userInfo = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      lastLogin: user.last_login,
      loginCount: user.login_count + 1
    };

    res.json({
      message: '登录成功',
      token,
      user: userInfo
    });
  });
});

// 注册（仅管理员可创建用户，或开放注册）
router.post('/register', async (req, res) => {
  const { username, password, name, email, phone, role } = req.body;

  // 参数验证
  if (!username || !password || !name) {
    return res.status(400).json({ error: '用户名、密码和姓名不能为空' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  const db = database.getDb();

  // 检查用户名是否已存在
  db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (row) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const now = new Date().toISOString();
    const userRole = role && ['admin', 'manager', 'user'].includes(role) ? role : 'user';

    // 创建用户
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
          message: '注册成功',
          userId: this.lastID
        });
      }
    );
  });
});

// 退出登录（客户端删除 Token 即可，服务端可选记录）
router.post('/logout', (req, res) => {
  // 如果实现了 Token 黑名单或会话管理，这里可以失效 Token
  res.json({ message: '退出成功' });
});

// 获取当前用户信息
router.get('/me', (req, res) => {
  // 这个路由会在 authenticateToken 中间件之后调用
  // 但 /auth/me 是公开路由，所以不能放在这里
  // 应该放在需要认证的路由组中
  res.json({ error: '请使用 /api/users/me 获取用户信息' });
});

// 修改密码
router.post('/change-password', (req, res) => {
  // 这个也需要认证，应该放在需要认证的路由组中
  res.json({ error: '此接口需要认证' });
});

module.exports = router;
