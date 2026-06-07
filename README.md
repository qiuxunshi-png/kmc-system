# KMC综合管理系统

🌐 **公网访问地址：https://silver-ways-crash.loca.lt/login.html**
> ⚠️ 此为临时链接，服务器重启后失效。如需固定链接，请部署至云服务器。

## 📋 系统概述

这是KMC后勤管理的整合系统，包含两大核心模块：
1. **物资管理** (Smart Sync v3.7) - 入库、出库、库存管理
2. **安保管理** (SiteOps V15.0) - 任务、督察、SOS、记录管理

## 🚀 快速开始

### 方法1：直接打开入口页面
双击打开 `kmc-integrated.html` 文件，选择要进入的系统。

### 方法2：直接访问子系统
- 物资管理：直接打开 `kmc-app-v3.html`
- 安保管理：直接打开 `kmc-security.html`

## 🔧 系统功能

### 物资管理系统
- **入库管理**：物资入库、批量提交、签字确认
- **出库管理**：物资出库、部门领用、用途记录
- **报表中心**：入库报表、出库报表、库存报表
- **数据导出**：支持PDF和Excel格式导出
- **智能同步**：支持云端同步（Supabase）

### 安保管理系统
- **任务管理**：固定岗/非固定任务分配与执行
- **督察模式**：违规上报、证据拍照、双方签字
- **SOS紧急求救**：紧急情况报警（火灾、入侵、事故、医疗）
- **记录中心**：所有记录浏览、PDF导出、审批流程
- **团队管理**：员工账号、配置中心、荣誉榜
- **离线支持**：无网络时保存数据，联网后自动同步

## 🔐 默认账号

### 后勤管理系统（主系统）
| 角色 | 账号 | 密码 | 权限 |
|------|------|------|------|
| 管理员 | `admin` | `admin123` | 全部权限 |
| 经理 | `manager` | `manager123` | 任务分配、审批 |
| 员工 | `user` | `user123` | 提交记录、查看个人 |

### 物资管理系统
- 库管员：密码 `666666`
- 管理员：密码 `admin123`
- 上帝模式：点击Logo 7次，密码 `sqx1987923`

### 安保管理系统
- 员工账号在 `kmc_staff` 表中配置
- 默认密码：`0000`

## 🔧 技术栈

### 物资管理
- 纯JavaScript（无框架）
- Supabase（云端同步）
- jsPDF + html2canvas（PDF导出）
- SheetJS（Excel导出）

### 安保管理
- Vue 3（响应式UI）
- Tailwind CSS（样式）
- Supabase（数据同步）
- Chart.js（数据可视化）

## 📊 数据库配置

### Supabase表结构

#### 物资管理
- `kmc_core` - 主数据表（id, content）
- `content` 字段存储JSON：list（物资列表）、history（操作历史）、settings（系统设置）

#### 安保管理
- `kmc_staff` - 员工账号（id, login_id, name, password, role, team）
- `kmc_tasks` - 任务配置（id, title, content, priority, assigned_team, ...）
- `kmc_submissions` - 提交记录（id, type, title, note, staff_name, status, ...）

## 🔨 修复记录

### 安保管理系统修复
- ✅ 修复CDN链接中的空格（`supabase-js`, `chart.js`）
- ✅ 修复CSS变量值中的空格（颜色值）
- ✅ 修复HTML属性中的空格（`user-scalable`, `apple-mobile-web-app-...`）
- ✅ 修复Tailwind类名中的空格

## 📱 移动端支持

两个系统都支持：
- 响应式设计
- 触摸手势
- PWA（可添加到主屏幕）
- 离线模式

## ⚠️ 注意事项

1. **物资管理**：首次使用需要配置Supabase密钥（在JS文件中修改）
2. **安保管理**：需要在Supabase中创建对应的表结构
3. **翻译功能**：使用MyMemory翻译API，可能需要科学上网
4. **PDF导出**：大量照片可能导致性能问题，建议分批导出

## 🆘 故障排查

### 物资管理
- 同步失败：检查Supabase配置、网络连接、RLS策略
- PDF导出失败：检查jsPDF和html2canvas是否加载成功

### 安保管理
- Vue未加载：检查 `https://unpkg.com/vue@3` 是否可访问
- 数据同步失败：检查Supabase配置和表权限

## 📞 技术支持

如有问题，请联系系统管理员。

---

**Build Date**: 2026-06-07  
**Version**: Integrated v1.0  
**Author**: KMC Development Team
