# 🚀 部署说明

## 📋 环境配置

### 开发环境
- 使用 `package.json` 中的 `proxy` 配置
- 后端运行在 `http://localhost:3006`
- 前端运行在 `http://localhost:3000`

### 生产环境
- 需要设置环境变量 `REACT_APP_API_URL`
- 后端地址：`https://cstj.server.aiqji.cn`

## 🔧 部署步骤

### 1. 开发环境
```bash
# 启动后端
npm run server

# 启动前端（新终端）
npm run client

# 或者同时启动
npm run dev
```

### 2. 生产环境构建
```bash
# 设置环境变量
export REACT_APP_API_URL=https://cstj.server.aiqji.cn

# 构建前端
npm run build

# 构建后的文件在 client/build 目录
```

### 3. 环境变量配置

#### 方法1：构建时设置
```bash
# Windows
set REACT_APP_API_URL=https://cstj.server.aiqji.cn && npm run build

# Linux/Mac
REACT_APP_API_URL=https://cstj.server.aiqji.cn npm run build
```

#### 方法2：创建 .env.production 文件
```bash
# 在 client 目录下创建 .env.production
echo "REACT_APP_API_URL=https://cstj.server.aiqji.cn" > .env.production
npm run build
```

#### 方法3：在服务器上设置
```bash
# 在服务器上设置环境变量
export REACT_APP_API_URL=https://cstj.server.aiqji.cn
npm run build
```

## 📁 文件结构
```
analytics-website/
├── client/
│   ├── src/
│   │   ├── config/
│   │   │   └── api.ts          # API配置
│   │   └── components/
│   │       └── Dashboard.tsx   # 使用API配置
│   ├── package.json            # 开发环境代理
│   └── .env.production         # 生产环境配置
└── server/
    └── index.js                # 后端服务
```

## 🔍 故障排除

### 问题：生产环境请求404
**原因**：环境变量未正确设置
**解决**：确保 `REACT_APP_API_URL` 指向正确的后端地址

### 问题：开发环境请求失败
**原因**：后端未启动或代理配置错误
**解决**：检查后端服务状态和代理配置

### 问题：环境变量不生效
**原因**：React 需要以 `REACT_APP_` 开头
**解决**：确保环境变量名称正确

## 📝 注意事项

1. **环境变量必须以 `REACT_APP_` 开头**
2. **构建后环境变量会被嵌入到代码中**
3. **开发环境使用代理，生产环境使用环境变量**
4. **修改环境变量后需要重新构建**
