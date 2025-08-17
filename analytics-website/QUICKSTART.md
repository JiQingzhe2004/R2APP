# 🚀 快速启动指南

## 前置要求

1. **Node.js 16+** - [下载地址](https://nodejs.org/)
2. **MySQL 8.0+** - [下载地址](https://dev.mysql.com/downloads/mysql/)
3. **Git** - [下载地址](https://git-scm.com/)

## 🗄️ 数据库设置

### 1. 启动 MySQL 服务

### 2. 创建数据库
```sql
CREATE DATABASE r2app_analytics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 执行初始化脚本
```bash
mysql -u root -p r2app_analytics < init-database.sql
```

## ⚙️ 环境配置

### 1. 复制环境变量文件
```bash
cp env.example .env
```

### 2. 编辑 .env 文件
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=r2app_analytics
DB_PORT=3306
PORT=3006
NODE_ENV=development

# Electron应用支持配置
ENABLE_ELECTRON_SUPPORT=true
ALLOW_ALL_ORIGINS=true
LOG_ELECTRON_REQUESTS=true
```

## 📦 安装依赖

### 1. 安装后端依赖
```bash
npm install
```

### 2. 安装前端依赖
```bash
cd client
npm install
cd ..
```

## 🚀 启动应用

### 方法 1: 使用批处理文件（推荐）
```bash
start-dev.bat
```

### 方法 2: 手动启动
```bash
# 终端 1: 启动后端
npm run server

# 终端 2: 启动前端
npm run client
```

### 方法 3: 同时启动
```bash
npm run dev
```

## 🌐 访问地址

- **前端仪表盘**: http://localhost:3000
- **后端 API**: http://localhost:3006
- **健康检查**: http://localhost:3006/health

## 🧪 测试 API

### 测试普通API
```bash
node test-api.js
```

### 测试Electron应用兼容性
```bash
node test-electron-api.js
```

## 📱 在 R2APP 中配置

### 1. 修改 analytics-config.js
```javascript
export const ANALYTICS_CONFIG = {
  // 统计接口地址 - 改为你的统计网站地址
  API_URL: 'http://localhost:3006/api/analytics',
  
  // 是否启用统计
  ENABLED: true,
  
  // 统计超时时间（毫秒）
  TIMEOUT: 10000,
  
  // 重试次数
  RETRY_COUNT: 3,
  
  // 重试间隔（毫秒）
  RETRY_DELAY: 2000
};
```

### 2. 确保R2APP中的请求包含正确的User-Agent
在您的R2APP中，统计请求应该包含类似这样的User-Agent：
```javascript
headers: {
  'User-Agent': 'R2APP/1.0.0 (Electron/28.0.0)',
  'Content-Type': 'application/json'
}
```

## 🔧 常见问题

### 1. 数据库连接失败
- 检查 MySQL 服务是否启动
- 验证数据库用户名和密码
- 确认数据库名称正确

### 2. 端口被占用
- 修改 `.env` 文件中的 `PORT` 值
- 或者关闭占用端口的程序

### 3. 前端无法连接后端
- 确认后端服务器已启动
- 检查 `client/package.json` 中的 `proxy` 配置
- 验证 CORS 设置

### 4. Electron应用跨域问题
- 后端已配置支持所有来源，包括Electron应用
- 检查R2APP中的网络请求配置
- 确保使用正确的API地址

## 📊 功能特性

- ✅ 实时统计仪表盘
- ✅ 安装和使用数据收集
- ✅ 平台和版本分布分析
- ✅ 响应式设计
- ✅ 高性能图表展示
- ✅ 自动重试机制
- ✅ 数据持久化存储
- ✅ **Electron应用完全支持**
- ✅ **跨域请求完全支持**

## 🎯 下一步

1. 启动应用并访问仪表盘
2. 在 R2APP 中配置统计接口
3. 测试数据收集功能
4. 根据需要自定义图表和样式
5. **验证Electron应用的统计数据收集**

## 🔍 Electron应用调试

如果您的R2APP仍然无法发送统计数据，请检查：

1. **网络请求日志** - 查看R2APP控制台的网络请求
2. **CORS错误** - 检查浏览器控制台是否有跨域错误
3. **API地址** - 确认API地址正确且可访问
4. **请求头** - 确保包含正确的Content-Type
5. **防火墙** - 检查本地防火墙是否阻止了请求

---

**需要帮助？** 请查看 `README.md` 或提交 Issue。
