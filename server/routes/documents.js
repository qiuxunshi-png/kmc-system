// server/routes/documents.js - 文档管理路由（文件上传/下载/自动分类/多部门协作）
const express = require('express');
const router = express.Router();
const database = require('../database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// ========== 文件上传配置 ==========
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 生成安全文件名
function safeFilename(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `${base}_${ts}${rand}${ext}`;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        // 处理中文文件名
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
        cb(null, safeFilename(originalName));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        const banned = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.com'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (banned.includes(ext)) {
            return cb(new Error('不允许上传可执行文件: ' + ext));
        }
        cb(null, true);
    }
});

// ========== 自动文档类型识别 ==========
const CATEGORY_RULES = [
    { category: '财务报表', keywords: ['报价', '报价表', '财务', '费用', '预算', '报销', 'invoice', 'payment', 'cost', 'finance', '账单', '结算', '工资', 'salary'], exts: ['.xlsx', '.xls', '.csv'] },
    { category: '车辆管理', keywords: ['派车', '车辆', '接送机', '用车', '司机', 'vehicle', 'car', 'transport', '行程', '出行', '机票', '航班'], exts: [] },
    { category: '安保管理', keywords: ['安保', '巡逻', '检查点', '安全', '消防', 'security', 'patrol', '安检', '保安'], exts: [] },
    { category: '后勤物资', keywords: ['物资', '采购', '库存', '出入库', '领用', '补给', 'supply', 'inventory', '仓库'], exts: [] },
    { category: '人事档案', keywords: ['人事', '员工', '入职', '离职', '考勤', '合同', 'HR', 'personnel', 'staff', '简历', '面试'], exts: [] },
    { category: '行政公文', keywords: ['通知', '公告', '制度', '规定', '管理办法', '政策', '函', '决定', '意见', 'notice', 'policy', '规定'], exts: [] },
    { category: '技术文档', keywords: ['技术', '方案', '设计', '规范', '手册', '操作指南', 'technical', 'manual', 'guide', 'spec'], exts: [] },
    { category: '会议文件', keywords: ['会议', '纪要', '议程', '决议', 'meeting', 'minutes', 'agenda'], exts: [] },
];

// 文件类型标签映射
const TYPE_LABELS = {
    '.pdf': { icon: '📄', label: 'PDF文档' },
    '.doc': { icon: '📝', label: 'Word文档' },
    '.docx': { icon: '📝', label: 'Word文档' },
    '.xls': { icon: '📊', label: 'Excel表格' },
    '.xlsx': { icon: '📊', label: 'Excel表格' },
    '.ppt': { icon: '📽️', label: 'PPT演示' },
    '.pptx': { icon: '📽️', label: 'PPT演示' },
    '.txt': { icon: '📃', label: '文本文件' },
    '.md': { icon: '📃', label: 'Markdown' },
    '.csv': { icon: '📊', label: 'CSV数据' },
    '.json': { icon: '🔧', label: 'JSON数据' },
    '.jpg': { icon: '🖼️', label: '图片' },
    '.jpeg': { icon: '🖼️', label: '图片' },
    '.png': { icon: '🖼️', label: '图片' },
    '.gif': { icon: '🖼️', label: '图片' },
    '.zip': { icon: '📦', label: '压缩包' },
    '.rar': { icon: '📦', label: '压缩包' },
    '.7z': { icon: '📦', label: '压缩包' },
    '.mp4': { icon: '🎬', label: '视频' },
    '.mp3': { icon: '🎵', label: '音频' },
};

function autoDetectCategory(filename, ext) {
    const lowerName = filename.toLowerCase();
    // 1. 按文件名关键词匹配
    for (const rule of CATEGORY_RULES) {
        for (const kw of rule.keywords) {
            if (lowerName.includes(kw.toLowerCase())) return rule.category;
        }
    }
    // 2. 按扩展名匹配（仅财务类有特殊扩展名规则）
    for (const rule of CATEGORY_RULES) {
        if (rule.exts.includes(ext.toLowerCase())) {
            if (rule.category === '财务报表') return rule.category;
        }
    }
    return '其他';
}

function getFileTypeInfo(ext) {
    return TYPE_LABELS[ext.toLowerCase()] || { icon: '📎', label: ext.replace('.', '').toUpperCase() + '文件' };
}

// ========== 数据库迁移：添加新字段 ==========
function migrateDocumentsTable() {
    const db = database.getDb();
    const newColumns = [
        { name: 'uploader_id', type: 'INTEGER' },
        { name: 'uploader_name', type: 'TEXT' },
        { name: 'department', type: 'TEXT' },
        { name: 'shared_departments', type: 'TEXT DEFAULT "[]"' },
        { name: 'file_path', type: 'TEXT' },
        { name: 'mime_type', type: 'TEXT' },
        { name: 'type_icon', type: 'TEXT' },
        { name: 'type_label', type: 'TEXT' },
        { name: 'download_count', type: 'INTEGER DEFAULT 0' },
    ];
    newColumns.forEach(col => {
        db.run(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type}`, (err) => {
            // 列已存在会报错，忽略即可
            if (!err) console.log(`  ✅ 添加列 documents.${col.name}`);
        });
    });
}

// 启动时迁移
setTimeout(migrateDocumentsTable, 1500);

// ========== API 路由 ==========

// 文件上传（支持多文件）
router.post('/upload', upload.array('files', 20), (req, res) => {
    const db = database.getDb();
    const files = req.files;
    const user = req.user;
    const department = req.body.department || '综合部';
    const sharedDeps = req.body.shared_departments ? JSON.parse(req.body.shared_departments) : [];

    if (!files || files.length === 0) {
        return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const results = [];
    let processed = 0;

    files.forEach((file, index) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
        const ext = path.extname(originalName).toLowerCase();
        const category = autoDetectCategory(originalName, ext);
        const typeInfo = getFileTypeInfo(ext);
        const now = new Date().toISOString();

        db.run(
            `INSERT INTO documents 
             (name, path, ext, size, folder, category, mtime, content, indexed_at, 
              uploader_id, uploader_name, department, shared_departments, file_path, mime_type, type_icon, type_label, download_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                originalName,
                file.path, // 兼容旧字段
                ext,
                file.size,
                category,
                category,
                now,
                '',
                now,
                user.id,
                user.name || user.username,
                department,
                JSON.stringify(sharedDeps),
                file.path,
                file.mimetype,
                typeInfo.icon,
                typeInfo.label,
                0
            ],
            function(err) {
                if (err) {
                    console.error('上传文档入库失败:', err);
                    results.push({ name: originalName, status: 'error', error: err.message });
                } else {
                    results.push({
                        id: this.lastID,
                        name: originalName,
                        category,
                        typeIcon: typeInfo.icon,
                        typeLabel: typeInfo.label,
                        size: file.size,
                        status: 'ok'
                    });
                }
                processed++;
                if (processed === files.length) {
                    res.json({
                        message: `成功上传 ${results.filter(r => r.status === 'ok').length}/${files.length} 个文件`,
                        results
                    });
                }
            }
        );
    });
});

// 文件下载
router.get('/:id/download', (req, res) => {
    const db = database.getDb();
    db.get('SELECT * FROM documents WHERE id = ?', [req.params.id], (err, doc) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        if (!doc) return res.status(404).json({ error: '文档不存在' });

        const filePath = doc.file_path || doc.path;
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: '文件不存在于服务器' });
        }

        // 更新下载计数
        db.run('UPDATE documents SET download_count = download_count + 1 WHERE id = ?', [doc.id]);

        // 设置响应头
        const safeName = encodeURIComponent(doc.name);
        res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
        res.setHeader('Content-Length', doc.size || fs.statSync(filePath).size);

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    });
});

// 获取文档列表（支持搜索、筛选、分页、部门过滤）
router.get('/', (req, res) => {
    const db = database.getDb();
    const { 
        search, folder, ext, category, department,
        page = 1, limit = 50 
    } = req.query;
    const user = req.user;

    let query = 'SELECT * FROM documents WHERE 1=1';
    const params = [];

    // 部门过滤：管理员看全部，普通用户看本部门+共享的
    if (user.role !== 'admin' && user.role !== 'manager' && department !== 'all') {
        query += ' AND (department = ? OR shared_departments LIKE ? OR uploader_id = ?)';
        const dept = department || user.department || '综合部';
        params.push(dept, `%"${dept}"%`, user.id);
    }

    if (search) {
        query += ' AND (name LIKE ? OR category LIKE ? OR uploader_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (folder) {
        query += ' AND folder = ?';
        params.push(folder);
    }
    if (ext) {
        query += ' AND ext = ?';
        params.push(ext);
    }
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    if (department && department !== 'all') {
        query += ' AND (department = ? OR shared_departments LIKE ?)';
        params.push(department, `%"${department}"%`);
    }

    query += ' ORDER BY mtime DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    db.all(query, params, (err, docs) => {
        if (err) {
            console.error('查询文档失败:', err);
            return res.status(500).json({ error: '数据库错误' });
        }
        res.json({ 
            documents: docs, 
            page: parseInt(page), 
            limit: parseInt(limit) 
        });
    });
});

// 获取单个文档详情
router.get('/:id', (req, res) => {
    const db = database.getDb();
    db.get('SELECT * FROM documents WHERE id = ?', [req.params.id], (err, doc) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        if (!doc) return res.status(404).json({ error: '文档不存在' });
        res.json({ document: doc });
    });
});

// 搜索文档（智能搜索）
router.post('/search', (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: '搜索关键词不能为空' });

    const db = database.getDb();
    const searchTerm = `%${query}%`;

    db.all(
        `SELECT * FROM documents 
         WHERE name LIKE ? OR folder LIKE ? OR category LIKE ? OR uploader_name LIKE ?
         ORDER BY 
           CASE 
             WHEN name LIKE ? THEN 1
             WHEN category LIKE ? THEN 2
             WHEN uploader_name LIKE ? THEN 3
             ELSE 4
           END,
           mtime DESC
         LIMIT 100`,
        [searchTerm, searchTerm, searchTerm, searchTerm, `%${query}%`, `%${query}%`, `%${query}%`],
        (err, docs) => {
            if (err) return res.status(500).json({ error: '搜索失败' });
            res.json({ results: docs, count: docs.length, query });
        }
    );
});

// 获取分类统计
router.get('/meta/stats', (req, res) => {
    const db = database.getDb();
    db.all(
        `SELECT category, COUNT(*) as count, SUM(size) as total_size 
         FROM documents WHERE category IS NOT NULL 
         GROUP BY category ORDER BY count DESC`,
        [], (err, stats) => {
            if (err) return res.status(500).json({ error: '数据库错误' });
            db.get('SELECT COUNT(*) as total FROM documents', [], (err2, totalRow) => {
                if (err2) return res.status(500).json({ error: '数据库错误' });
                res.json({ total: totalRow.total, byCategory: stats });
            });
        }
    );
});

// 获取文件夹/分类列表
router.get('/meta/folders', (req, res) => {
    const db = database.getDb();
    db.all('SELECT DISTINCT folder FROM documents WHERE folder IS NOT NULL ORDER BY folder', [], (err, rows) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        db.all('SELECT DISTINCT category FROM documents WHERE category IS NOT NULL ORDER BY category', [], (err2, cats) => {
            if (err2) return res.status(500).json({ error: '数据库错误' });
            res.json({ folders: rows.map(r => r.folder), categories: cats.map(c => c.category) });
        });
    });
});

// 获取部门列表
router.get('/meta/departments', (req, res) => {
    const db = database.getDb();
    db.all('SELECT DISTINCT department FROM documents WHERE department IS NOT NULL ORDER BY department', [], (err, rows) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        res.json({ departments: rows.map(r => r.department) });
    });
});

// 更新文档分类/共享（管理员或上传者）
router.put('/:id', (req, res) => {
    const db = database.getDb();
    const { category, department, shared_departments } = req.body;
    const user = req.user;

    db.get('SELECT * FROM documents WHERE id = ?', [req.params.id], (err, doc) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        if (!doc) return res.status(404).json({ error: '文档不存在' });

        // 权限检查：管理员或上传者可修改
        if (user.role !== 'admin' && user.role !== 'manager' && doc.uploader_id !== user.id) {
            return res.status(403).json({ error: '无权修改此文档' });
        }

        const updates = [];
        const values = [];
        if (category) { updates.push('category = ?'); values.push(category); }
        if (department) { updates.push('department = ?'); values.push(department); }
        if (shared_departments) { updates.push('shared_departments = ?'); values.push(JSON.stringify(shared_departments)); }

        if (updates.length === 0) return res.status(400).json({ error: '没有需要更新的字段' });

        values.push(req.params.id);
        db.run(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`, values, function(err2) {
            if (err2) return res.status(500).json({ error: '更新失败' });
            res.json({ message: '文档更新成功', changes: this.changes });
        });
    });
});

// 添加/更新文档索引（保留旧接口兼容）
router.post('/', (req, res) => {
    const { name, path: docPath, ext, size, folder, category, mtime, content } = req.body;
    if (!name || !docPath) return res.status(400).json({ error: '文档名称和路径不能为空' });

    const db = database.getDb();
    const now = new Date().toISOString();
    const autoCategory = category || autoDetectCategory(name, ext || '');
    const typeInfo = getFileTypeInfo(ext || '');

    db.get('SELECT id FROM documents WHERE path = ?', [docPath], (err, row) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        if (row) {
            db.run(
                `UPDATE documents SET name=?, ext=?, size=?, folder=?, category=?, mtime=?, content=?, indexed_at=?, type_icon=?, type_label=? WHERE path=?`,
                [name, ext, size, folder, autoCategory, mtime, content, now, typeInfo.icon, typeInfo.label, docPath],
                function(err2) {
                    if (err2) return res.status(500).json({ error: '更新文档失败' });
                    res.json({ message: '文档更新成功', id: row.id, action: 'updated', category: autoCategory });
                }
            );
        } else {
            db.run(
                `INSERT INTO documents (name, path, ext, size, folder, category, mtime, content, indexed_at, type_icon, type_label)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, docPath, ext, size, folder, autoCategory, mtime, content, now, typeInfo.icon, typeInfo.label],
                function(err2) {
                    if (err2) return res.status(500).json({ error: '添加文档失败' });
                    res.status(201).json({ message: '文档添加成功', id: this.lastID, action: 'created', category: autoCategory });
                }
            );
        }
    });
});

// 批量删除文档
router.delete('/bulk', (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '请提供要删除的文档ID列表' });

    const db = database.getDb();
    // 先获取文件路径，删除磁盘文件
    const placeholders = ids.map(() => '?').join(',');
    db.all(`SELECT file_path, path FROM documents WHERE id IN (${placeholders})`, ids, (err, docs) => {
        if (docs) {
            docs.forEach(doc => {
                const fp = doc.file_path || doc.path;
                if (fp && fs.existsSync(fp)) {
                    try { fs.unlinkSync(fp); } catch (e) { console.error('删除文件失败:', fp, e); }
                }
            });
        }
        db.run(`DELETE FROM documents WHERE id IN (${placeholders})`, ids, function(err2) {
            if (err2) return res.status(500).json({ error: '删除失败' });
            res.json({ message: `成功删除 ${this.changes} 个文档` });
        });
    });
});

// 删除单个文档
router.delete('/:id', (req, res) => {
    const db = database.getDb();
    db.get('SELECT * FROM documents WHERE id = ?', [req.params.id], (err, doc) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        if (!doc) return res.status(404).json({ error: '文档不存在' });

        // 权限检查
        if (req.user.role !== 'admin' && req.user.role !== 'manager' && doc.uploader_id !== req.user.id) {
            return res.status(403).json({ error: '无权删除此文档' });
        }

        // 删除磁盘文件
        const fp = doc.file_path || doc.path;
        if (fp && fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch (e) { console.error('删除文件失败:', fp, e); }
        }

        db.run('DELETE FROM documents WHERE id = ?', [req.params.id], function(err2) {
            if (err2) return res.status(500).json({ error: '删除失败' });
            res.json({ message: '文档删除成功' });
        });
    });
});

// 读取文档内容
router.post('/:id/content', (req, res) => {
    const db = database.getDb();
    db.get('SELECT * FROM documents WHERE id = ?', [req.params.id], (err, doc) => {
        if (err) return res.status(500).json({ error: '数据库错误' });
        if (!doc) return res.status(404).json({ error: '文档不存在' });

        const filePath = doc.file_path || doc.path;
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: '文件不存在于磁盘' });
        }

        const ext = (doc.ext || '').toLowerCase();
        try {
            if (['.txt', '.md', '.csv', '.json', '.log'].includes(ext)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                res.json({ content, encoding: 'utf-8' });
            } else if (ext === '.pdf') {
                res.json({ content: 'PDF 文件，请下载查看', type: 'pdf', downloadUrl: `/api/documents/${doc.id}/download` });
            } else if (['.docx', '.doc'].includes(ext)) {
                res.json({ content: 'Word 文件，请下载查看', type: 'docx', downloadUrl: `/api/documents/${doc.id}/download` });
            } else if (['.xlsx', '.xls'].includes(ext)) {
                res.json({ content: 'Excel 文件，请下载查看', type: 'xlsx', downloadUrl: `/api/documents/${doc.id}/download` });
            } else {
                res.json({ content: '请下载查看', type: 'unknown', downloadUrl: `/api/documents/${doc.id}/download` });
            }
        } catch (error) {
            res.status(500).json({ error: '读取文件内容失败: ' + error.message });
        }
    });
});

module.exports = router;
