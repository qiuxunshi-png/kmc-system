#!/usr/bin/env node
/**
 * KMC 系统统一服务器
 * - 提供前端静态文件（login.html, kmc-app-v3.html）
 * - 代理 API 请求到后端服务
 * - 支持前后端同域部署（避免 CORS 问题）
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const API_PORT = process.env.API_PORT || 3001;

const app = express();

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kmc-web', port: PORT });
});

// 静态文件服务
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// API 代理（将 /api 请求转发到后端）
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:' + API_PORT,
  changeOrigin: true,
  logLevel: 'warn',
}));

// 默认路由 -> login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║            KMC 后勤管理系统 - Web 服务器                   ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  访问地址: http://localhost:${PORT}                       `);
  console.log(`║  API 代理: http://localhost:${PORT}/api -> :${API_PORT}  `);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('提示: 请确保后端服务已在端口', API_PORT, '运行');
  console.log('      启动后端: cd server && npm start');
  console.log('');
});

module.exports = app;
