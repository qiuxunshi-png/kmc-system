// server/routes/skills.js - AI 自主学习技能路由
const express = require('express');
const router = express.Router();
const database = require('../database');

// ===== 技能市场（可扩展的技能注册表） =====
const SKILL_REGISTRY = [
  { id:'doc-parser', name:'文档解析器', icon:'📄', version:'1.0.0', category:'core',
    desc:'解析 PDF、Word、Excel 等文档格式，提取文本内容',
    triggers:['文档','解析','PDF','Word','Excel','读取','提取','内容'],
    installed:true },
  { id:'semantic-search', name:'语义搜索', icon:'🔍', version:'1.2.0', category:'core',
    desc:'基于自然语言的智能文档搜索',
    triggers:['搜索','查找','找到','检索','查询','关键词'],
    installed:true },
  { id:'multi-export', name:'多格式导出', icon:'📤', version:'1.1.0', category:'core',
    desc:'导出为 PDF、Excel、Markdown、CSV 等格式',
    triggers:['导出','下载','保存','输出','格式转换','PDF导出','Excel导出'],
    installed:false },
  { id:'data-viz', name:'数据可视化', icon:'📊', version:'0.9.0', category:'data',
    desc:'将数据自动生成柱状图、折线图、饼图等图表',
    triggers:['图表','可视化','柱状图','折线图','饼图','统计图','数据图','分析图','chart'],
    installed:false },
  { id:'ocr', name:'OCR 图片识别', icon:'👁️', version:'1.3.0', category:'ai',
    desc:'从扫描件和图片中提取文字，支持中英文',
    triggers:['OCR','图片识别','扫描','文字识别','图片转文字','识别文字'],
    installed:false },
  { id:'translate', name:'多语言翻译', icon:'🌐', version:'1.1.0', category:'ai',
    desc:'支持中文、英文等20+语言文档翻译',
    triggers:['翻译','translate','英文','中文','日语','韩语','语言转换'],
    installed:false },
  { id:'summarize', name:'智能摘要', icon:'📝', version:'2.0.0', category:'ai',
    desc:'自动生成文档摘要、关键词和思维导图',
    triggers:['摘要','总结','概括','提取要点','要点','大纲','概要'],
    installed:false },
  { id:'batch-rename', name:'批量重命名', icon:'✏️', version:'1.0.0', category:'efficiency',
    desc:'根据规则批量重命名文档，支持正则和模板',
    triggers:['重命名','改名','批量改名','文件名','命名规则'],
    installed:false },
  { id:'doc-compare', name:'文档对比', icon:'🔀', version:'1.2.0', category:'data',
    desc:'智能对比两份文档差异，高亮增删改',
    triggers:['对比','比较','差异','不同','版本对比','变更'],
    installed:false },
  { id:'template-gen', name:'模板生成器', icon:'📋', version:'1.0.0', category:'efficiency',
    desc:'根据已有文档自动生成模板，支持合同、报告等',
    triggers:['模板','生成','合同','报告','申请','模板生成'],
    installed:false },
  { id:'schedule-parser', name:'排班解析', icon:'📅', version:'1.1.0', category:'data',
    desc:'智能解析排班表、考勤表，生成统计和冲突检测',
    triggers:['排班','考勤','班次','值班','出勤','打卡','工时'],
    installed:false },
  { id:'email-notify', name:'邮件通知', icon:'📧', version:'0.8.0', category:'efficiency',
    desc:'文档更新、审批完成等事件自动发送邮件通知',
    triggers:['邮件','通知','提醒','发送','email','通知我'],
    installed:false },
  { id:'report-gen', name:'自动报告', icon:'📑', version:'1.0.0', category:'ai',
    desc:'根据数据自动生成周报、月报、年报等分析报告',
    triggers:['报告','周报','月报','年报','汇报','总结报告','分析报告'],
    installed:false },
  { id:'smart-classify', name:'智能分类', icon:'🏷️', version:'1.0.0', category:'ai',
    desc:'AI 自动识别文档类型并分类归档',
    triggers:['分类','归类','归档','整理','标签','自动分类'],
    installed:false },
  { id:'approval-flow', name:'审批流程', icon:'✅', version:'1.0.0', category:'efficiency',
    desc:'自定义审批流程，多级审批、会签、加签',
    triggers:['审批','流程','批准','审核','同意','驳回','申请审批'],
    installed:false },
  { id:'inventory', name:'库存管理', icon:'📦', version:'1.0.0', category:'data',
    desc:'物资入库出库管理，库存预警，盘点自动化',
    triggers:['库存','入库','出库','物资','盘点','库存预警','仓库'],
    installed:false },
  { id:'finance', name:'财务报表', icon:'💰', version:'1.0.0', category:'data',
    desc:'自动生成财务报表、费用统计、预算对比',
    triggers:['财务','费用','预算','报表','收入','支出','账目','报销'],
    installed:false },
  { id:'personnel', name:'人员管理', icon:'👥', version:'1.0.0', category:'data',
    desc:'员工信息管理、权限分配、组织架构维护',
    triggers:['人员','员工','组织','权限','人事','HR','招聘','离职'],
    installed:false },
  { id:'vehicle', name:'车辆管理', icon:'🚗', version:'1.0.0', category:'data',
    desc:'派车申请、车辆调度、里程统计、维修记录',
    triggers:['车辆','派车','调度','里程','加油','维修','司机'],
    installed:false },
  { id:'security', name:'安保管理', icon:'🛡️', version:'1.0.0', category:'data',
    desc:'安保排班、巡检记录、事件上报、应急预案',
    triggers:['安保','巡逻','巡检','安全','防护','应急预案','门禁'],
    installed:false },
];

// ===== AI 意图分析 → 推荐技能 =====
router.post('/recommend', (req, res) => {
  const { query, installedSkills } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: '请提供查询内容' });
  }
  
  const installed = new Set(installedSkills || []);
  const q = query.toLowerCase();
  
  // 计算每个技能与查询的匹配度
  const scored = SKILL_REGISTRY
    .filter(s => !installed.has(s.id))  // 排除已安装的
    .map(skill => {
      let score = 0;
      let matchedTriggers = [];
      
      // 关键词匹配
      skill.triggers.forEach(trigger => {
        if (q.includes(trigger.toLowerCase())) {
          score += 10;
          matchedTriggers.push(trigger);
        }
      });
      
      // 名称匹配
      if (q.includes(skill.name.toLowerCase())) {
        score += 20;
        matchedTriggers.push(skill.name);
      }
      
      // 分类匹配
      if (q.includes(skill.category)) {
        score += 5;
      }
      
      // 描述匹配
      skill.desc.split(/[，、,]/).forEach(seg => {
        const segTrim = seg.trim();
        if (segTrim.length >= 2 && q.includes(segTrim.toLowerCase())) {
          score += 3;
          matchedTriggers.push(segTrim);
        }
      });
      
      return { ...skill, score, matchedTriggers };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  
  res.json({
    query,
    recommendations: scored.slice(0, 5),
    allAvailable: SKILL_REGISTRY.filter(s => !installed.has(s.id))
  });
});

// ===== 安装技能 =====
router.post('/install', (req, res) => {
  const { skillId } = req.body;
  const skill = SKILL_REGISTRY.find(s => s.id === skillId);
  
  if (!skill) {
    return res.status(404).json({ error: '技能不存在' });
  }
  
  // 记录安装到数据库
  const db = database.getDb();
  db.run(
    `INSERT OR REPLACE INTO installed_skills (skill_id, name, version, installed_at, enabled) 
     VALUES (?, ?, ?, datetime('now'), 1)`,
    [skill.id, skill.name, skill.version],
    function(err) {
      if (err) {
        console.error('技能安装失败:', err);
        return res.status(500).json({ error: '安装失败' });
      }
      res.json({ 
        message: `${skill.name} 安装成功`,
        skill: {
          id: skill.id,
          name: skill.name,
          version: skill.version,
          icon: skill.icon,
          category: skill.category,
          desc: skill.desc
        }
      });
    }
  );
});

// ===== 卸载技能 =====
router.post('/uninstall', (req, res) => {
  const { skillId } = req.body;
  const db = database.getDb();
  
  db.run('DELETE FROM installed_skills WHERE skill_id = ?', [skillId], function(err) {
    if (err) {
      return res.status(500).json({ error: '卸载失败' });
    }
    res.json({ message: '技能已卸载', skillId });
  });
});

// ===== 获取已安装技能列表 =====
router.get('/installed', (req, res) => {
  const db = database.getDb();
  db.all('SELECT * FROM installed_skills ORDER BY installed_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json({ skills: rows });
  });
});

// ===== 获取技能市场 =====
router.get('/market', (req, res) => {
  const { category, search } = req.query;
  
  let skills = [...SKILL_REGISTRY];
  if (category && category !== 'all') {
    skills = skills.filter(s => s.category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    skills = skills.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.desc.toLowerCase().includes(q) ||
      s.triggers.some(t => t.toLowerCase().includes(q))
    );
  }
  
  res.json({ skills, total: skills.length });
});

// ===== AI 对话 + 技能推荐一体化 =====
router.post('/chat', (req, res) => {
  const { message, userId, installedSkills } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '请提供消息内容' });
  }
  
  const installed = new Set(installedSkills || []);
  const q = message.toLowerCase();
  
  // 1. 分析意图
  let intent = 'general';
  let relevantDocs = [];
  
  // 检测关键词意图
  const intentMap = {
    'search': ['搜索','查找','找到','查询','检索','有没有','帮我找'],
    'export': ['导出','下载','保存','输出'],
    'install': ['安装','添加','启用','开启'],
    'help': ['帮助','怎么','如何','使用','指南','教程'],
    'report': ['报告','统计','汇总','分析'],
    'manage': ['管理','修改','更新','删除','编辑'],
  };
  
  for (const [key, triggers] of Object.entries(intentMap)) {
    if (triggers.some(t => q.includes(t))) {
      intent = key;
      break;
    }
  }
  
  // 2. 检查是否有技能可以推荐
  const skillRecommendations = SKILL_REGISTRY
    .filter(s => !installed.has(s.id))
    .map(skill => {
      let score = 0;
      skill.triggers.forEach(trigger => {
        if (q.includes(trigger.toLowerCase())) score += 10;
      });
      return { ...skill, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  
  // 3. 生成回复
  let reply = '';
  let suggestedSkills = [];
  
  if (skillRecommendations.length > 0) {
    suggestedSkills = skillRecommendations.map(s => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      desc: s.desc,
      version: s.version,
      category: s.category
    }));
    
    reply += `💡 我检测到以下技能可能对你有帮助：\n\n`;
    skillRecommendations.forEach((s, i) => {
      reply += `${i+1}. **${s.icon} ${s.name}** — ${s.desc}\n`;
    });
    reply += `\n点击推荐卡片即可一键安装，或告诉我"安装 XXX"来启用。\n\n`;
  }
  
  // 4. 根据意图生成具体回复
  if (intent === 'search') {
    reply += `🔍 我正在为你搜索相关信息...请描述你需要查找的具体内容。`;
  } else if (intent === 'export') {
    reply += `📤 导出功能已就绪！你可以在文档管理页面选择文档并导出为 PDF/Excel/Markdown/CSV 格式。`;
  } else if (intent === 'install') {
    reply += `🛠️ 告诉我你需要什么功能，我会为你推荐和安装相应的技能。`;
  } else if (intent === 'help') {
    reply += `🆘 **使用指南**\n\n• 用自然语言提问，我会智能回答\n• 如果需要新功能，我会推荐可安装的技能\n• 输入关键词如"车辆"、"安保"快速查找文档\n• 点击推荐技能卡片即可一键安装\n\n快捷键：Ctrl+D 切换主题 | Ctrl+K 搜索文档 | Ctrl+E 导出`;
  } else {
    reply += `我理解了你的需求。如果需要更多功能，我会自动推荐合适的技能。`;
  }
  
  // 记录对话到数据库（无外键约束的简单版本）
  try {
    const db = database.getDb();
    db.run(
      `INSERT INTO chat_logs (user_id, message, reply, intent, skills_suggested, created_at) 
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [userId || null, message, reply, intent, JSON.stringify(suggestedSkills.map(s=>s.id))]
    );
  } catch(logErr) {
    console.warn('对话日志记录失败:', logErr.message);
  }
  
  res.json({
    reply,
    intent,
    suggestedSkills,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
