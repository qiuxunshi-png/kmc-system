// server/middleware/auth.js - JWT 认证中间件
const jwt = require('jsonwebtoken');
const database = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'kmc-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成 JWT Token
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 验证 JWT Token 中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  // 支持 URL query 参数 token（用于文件下载等场景）
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌', code: 'NO_TOKEN' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: '认证令牌已过期', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: '认证令牌无效', code: 'TOKEN_INVALID' });
    }
    req.user = user;
    next();
  });
}

// 验证刷新 Token
function authenticateRefreshToken(req, res, next) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: '未提供刷新令牌' });
  }

  jwt.verify(refreshToken, JWT_SECRET + '_refresh', (err, user) => {
    if (err) {
      return res.status(403).json({ error: '刷新令牌无效' });
    }
    req.user = user;
    next();
  });
}

// 角色验证中间件
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足', required: roles, current: req.user.role });
    }
    next();
  };
}

// 记录操作日志
function logOperation(action, target, detail) {
  return (req, res, next) => {
    const db = database.getDb();
    const logData = {
      user_id: req.user ? req.user.id : null,
      username: req.user ? req.user.username : 'unknown',
      action,
      target,
      detail: detail || '',
      ip_address: req.ip || req.connection.remoteAddress
    };
    
    db.run(
      `INSERT INTO operation_logs (user_id, username, action, target, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
      [logData.user_id, logData.username, logData.action, logData.target, logData.detail, logData.ip_address],
      (err) => {
        if (err) console.error('记录操作日志失败:', err);
      }
    );
    next();
  };
}

module.exports = {
  generateToken,
  authenticateToken,
  authenticateRefreshToken,
  requireRole,
  logOperation,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
