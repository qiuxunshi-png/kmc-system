// server/index.js - KMC 后勤管理系统后端服务主入口
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const database = require('./database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const docRoutes = require('./routes/documents');
const skillRoutes = require('./routes/skills');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// 信任代理（用于获取真实 IP，部署在反向代理后时需要）
app.set('trust proxy', 1);

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false, // 关闭 CSP，方便前端部署
}));

// CORS 配置
const corsOptions = {
  origin: function(origin, callback) {
    // 允许无 origin 的请求（移动端 APP、服务端请求等）
    if (!origin) return callback(null, true);
    // 允许的域名列表
    const allowed = ['http://localhost:3000', 'http://localhost:3001', 'file://',
      // localtunnel 公网域名（动态生成）
      ...Array.from({length: 1}, () => {
        const pattern = /\.loca\.lt$/;
        return pattern;
      })
    ];
    // 检查是否匹配 localtunnel 域名
    if (origin.match(/\.loca\.lt$/) || allowed.includes(origin)) {
      return callback(null, true);
    }
    callback(null, true); // 开发模式下允许所有来源
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 解析 JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path} | ${res.statusCode} | ${duration}ms | IP: ${req.ip}`);
  });
  next();
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development'
  });
});

// 公开路由（不需要认证）
app.use('/api/auth', authRoutes);
// 技能路由（部分接口需要认证，部分公开）
app.use('/api/skills', skillRoutes);

// 认证中间件 - 以下所有路由都需要登录
app.use('/api', authenticateToken);

// 受保护的路由
app.use('/api/users', userRoutes);
app.use('/api/documents', docRoutes);

// 管理员路由示例（需要 admin 角色）
app.get('/api/admin/stats', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  // 返回系统统计信息
  const db = database.getDb();
  db.get('SELECT COUNT(*) as total FROM users', [], (err, row) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json({ totalUsers: row.total, onlineUsers: 0, totalDocs: 0 });
  });
});

// 静态文件服务（开发+生产都启用，方便 localtunnel 部署）
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));
// SPA 兜底：非 /api 的 GET 请求返回 login.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendPath, 'login.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

// 启动服务器
async function startServer() {
  try {
    await database.init();
    console.log('✅ 数据库初始化成功');
    
    app.listen(PORT, HOST, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║          KMC 后勤管理系统后端服务 v1.0.0                  ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  服务地址: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}              `);
      console.log(`║  健康检查: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/health       `);
      console.log('║  环境: ' + (process.env.NODE_ENV || 'development').padEnd(43) + '║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

startServer();

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  database.close();
  process.exit(0);
});
