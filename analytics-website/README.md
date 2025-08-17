# R2APP 统计网站

这是一个用于收集和展示 R2APP 应用使用统计数据的网站，包含后端 API 和前端仪表盘。

## 功能特性

- 📊 实时统计仪表盘
- 📈 安装和使用数据可视化
- 🖥️ 平台分布统计
- 🔢 版本分布分析
- 📱 响应式设计
- 🚀 高性能图表展示

## 技术栈

### 后端
- Node.js + Express
- MySQL 数据库
- RESTful API

### 前端
- React + TypeScript
- Tailwind CSS
- Recharts 图表库
- Axios HTTP 客户端

## 快速开始

### 环境要求
- Node.js 16+
- MySQL 8.0+
- npm 或 yarn

### 安装依赖

1. 安装后端依赖：
```bash
npm install
```

2. 安装前端依赖：
```bash
cd client
npm install
```

### 数据库配置

1. 创建 MySQL 数据库：
```sql
CREATE DATABASE r2app_analytics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 复制环境变量文件：
```bash
cp env.example .env
```

3. 修改 `.env` 文件中的数据库配置：
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=r2app_analytics
DB_PORT=3306
```

### 启动应用

1. 启动后端服务器：
```bash
npm run server
```

2. 启动前端开发服务器：
```bash
npm run client
```

3. 或者同时启动前后端：
```bash
npm run dev
```

## API 接口

### 安装统计
- **POST** `/api/analytics/install`
- 记录应用安装信息

### 使用统计
- **POST** `/api/analytics/usage`
- 记录应用使用信息

### 仪表盘数据
- **GET** `/api/analytics/dashboard`
- 获取统计概览数据

### 详细统计
- **GET** `/api/analytics/stats?period=7d`
- 获取指定时间段的详细统计数据

## 部署

### 生产环境构建

1. 构建前端：
```bash
npm run build
```

2. 启动生产服务器：
```bash
NODE_ENV=production npm start
```

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3006
CMD ["npm", "start"]
```

## 项目结构

```
analytics-website/
├── server/                 # 后端代码
│   ├── index.js           # 服务器入口
│   ├── database.js        # 数据库连接
│   └── routes/            # API 路由
│       └── analytics.js   # 统计相关接口
├── client/                 # 前端代码
│   ├── src/
│   │   ├── components/    # React 组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── UsageChart.tsx
│   │   │   ├── PlatformChart.tsx
│   │   │   └── VersionChart.tsx
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
├── package.json
└── README.md
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
