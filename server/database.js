// server/database.js - SQLite 数据库管理
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kmc.db');
let db = null;

function getDb() {
  return db;
}

async function init() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('数据库连接失败:', err);
        reject(err);
        return;
      }
      console.log('📦 数据库连接成功:', DB_PATH);
    });

    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON');

    // 创建表
    const schema = `
      -- 用户表
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'manager', 'user')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
        last_login DATETIME,
        login_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 用户会话表（用于强制下线）
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- 登录日志表
      CREATE TABLE IF NOT EXISTS login_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        ip_address TEXT,
        user_agent TEXT,
        status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
        fail_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      -- 操作日志表
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        target TEXT,
        detail TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      -- 文档表（存储文档索引）
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        ext TEXT,
        size INTEGER DEFAULT 0,
        folder TEXT,
        category TEXT,
        mtime DATETIME,
        content TEXT,
        indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON operation_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(name);
      CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);

      -- 已安装技能表
      CREATE TABLE IF NOT EXISTS installed_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        version TEXT,
        enabled INTEGER DEFAULT 1,
        config TEXT DEFAULT '{}',
        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 对话日志表（AI 学习用，无外键避免约束问题）
      CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        message TEXT NOT NULL,
        reply TEXT,
        intent TEXT,
        skills_suggested TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_installed_skills_id ON installed_skills(skill_id);
      CREATE INDEX IF NOT EXISTS idx_chat_logs_user ON chat_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(created_at);
    `;

    db.exec(schema, async (err) => {
      if (err) {
        console.error('创建表失败:', err);
        reject(err);
        return;
      }
      console.log('✅ 数据库表结构创建成功');

      // 检查是否需要创建默认管理员
      await createDefaultAdmin();
      resolve();
    });
  });
}

async function createDefaultAdmin() {
  return new Promise((resolve) => {
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
      if (err) {
        console.error('检查管理员失败:', err);
        resolve();
        return;
      }
      if (!row) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('admin123', salt);
        const now = new Date().toISOString();
        db.run(
          `INSERT INTO users (username, password_hash, name, email, role, status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ['admin', passwordHash, '系统管理员', 'admin@kmc.com', 'admin', 'active', now, now],
          function(err) {
            if (err) {
              console.error('创建默认管理员失败:', err);
            } else {
              console.log('');
              console.log('🔑 默认管理员账号已创建:');
              console.log('   用户名: admin');
              console.log('   密码:   admin123');
              console.log('   ⚠️  请登录后立即修改密码！');
              console.log('');
            }
            resolve();
          }
        );
      } else {
        resolve();
      }
    });
  });
}

function close() {
  if (db) {
    db.close((err) => {
      if (err) console.error('关闭数据库失败:', err);
      else console.log('📦 数据库连接已关闭');
    });
  }
}

module.exports = { getDb, init, close };
