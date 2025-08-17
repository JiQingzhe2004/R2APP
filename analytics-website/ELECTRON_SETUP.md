# 📱 Electron 应用配置指南

## 🎯 概述

本统计网站专门为 Electron 应用（如 R2APP）设计，完全支持跨域请求和数据收集。后端已优化配置，确保 Electron 应用可以无障碍地发送统计数据。

## 🔧 后端配置优化

### CORS 配置
```javascript
const corsOptions = {
  origin: function (origin, callback) {
    // 允许所有来源，包括Electron应用
    if (!origin || origin === 'null' || origin.startsWith('file://') || origin.startsWith('app://')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'User-Agent'],
  exposedHeaders: ['Content-Length', 'X-Total-Count'],
  maxAge: 86400
};
```

### Helmet 安全配置
```javascript
app.use(helmet({
  // 为Electron应用放宽一些安全限制
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
```

### Electron 应用识别
```javascript
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isElectron = userAgent.includes('Electron') || 
                     userAgent.includes('R2APP') || 
                     req.headers['x-electron-app'];
  
  req.isElectronApp = isElectron;
  console.log(`${req.method} ${req.path} - ${isElectron ? 'Electron App' : 'Browser'}`);
  next();
});
```

## 📱 R2APP 配置

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

### 2. 确保请求头包含正确的 User-Agent
```javascript
// 在您的统计请求中添加正确的User-Agent
const headers = {
  'User-Agent': 'R2APP/1.0.0 (Electron/28.0.0)',
  'Content-Type': 'application/json'
};

// 发送安装统计
fetch('http://localhost:3006/api/analytics/install', {
  method: 'POST',
  headers: headers,
  body: JSON.stringify({
    machineId: machineId,
    version: appVersion,
    platform: process.platform,
    arch: process.arch
  })
});

// 发送使用统计
fetch('http://localhost:3006/api/analytics/usage', {
  method: 'POST',
  headers: headers,
  body: JSON.stringify({
    machineId: machineId,
    version: appVersion,
    platform: process.platform,
    arch: process.arch,
    uptime: uptime
  })
});
```

## 🧪 测试 Electron 兼容性

### 运行 Electron 测试脚本
```bash
node test-electron-api.js
```

这个脚本会：
1. 模拟 Electron 应用的请求头
2. 测试所有 API 接口
3. 验证 CORS 预检请求
4. 检查跨域支持

### 预期输出
```
🧪 开始测试 Electron 应用 API 兼容性...

1. 测试健康检查...
✅ 健康检查成功: { status: 'ok', electronSupport: true, corsEnabled: true }
Electron支持: true
CORS启用: true

2. 测试安装统计（Electron模式）...
✅ 安装统计成功: { success: true, message: '安装记录已创建' }

3. 测试使用统计（Electron模式）...
✅ 使用统计成功: { success: true, message: '使用记录已创建' }

🎉 所有 Electron API 测试通过！
📱 您的 R2APP 应用现在可以正常发送统计数据了！
```

## 🔍 故障排除

### 1. 跨域错误 (CORS Error)
**症状**: 浏览器控制台显示 CORS 错误
**解决方案**: 
- 确认后端服务器正在运行
- 检查 CORS 配置是否正确
- 验证 API 地址是否正确

### 2. 网络连接失败
**症状**: 请求超时或连接被拒绝
**解决方案**:
- 检查端口 3006 是否被占用
- 验证防火墙设置
- 确认网络连接正常

### 3. 数据发送失败
**症状**: 请求成功但数据未保存
**解决方案**:
- 检查数据库连接
- 验证请求数据格式
- 查看后端日志

### 4. User-Agent 识别失败
**症状**: 后端日志显示为普通浏览器请求
**解决方案**:
- 确保请求头包含正确的 User-Agent
- 检查是否包含 'R2APP' 或 'Electron' 标识

## 📊 监控和日志

### 后端日志示例
```
GET /health - Browser - Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
POST /api/analytics/install - Electron App - R2APP/1.0.0 (Electron/28.0.0)
POST /api/analytics/usage - Electron App - R2APP/1.0.0 (Electron/28.0.0)
```

### 健康检查响应
```json
{
  "status": "ok",
  "timestamp": "2025-08-18T00:00:00.000Z",
  "electronSupport": true,
  "corsEnabled": true
}
```

## 🚀 生产环境部署

### 1. 更新 API 地址
```javascript
export const ANALYTICS_CONFIG = {
  API_URL: 'https://your-domain.com/api/analytics', // 生产环境地址
  ENABLED: true,
  // ... 其他配置
};
```

### 2. 配置反向代理
如果使用 Nginx，确保配置支持 CORS：
```nginx
location /api/ {
    proxy_pass http://localhost:3006;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    
    # CORS 支持
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, User-Agent";
}
```

## 📞 技术支持

如果遇到问题，请：

1. 运行 `node test-electron-api.js` 测试兼容性
2. 检查后端服务器日志
3. 验证数据库连接
4. 确认网络配置

---

**Electron 支持状态**: ✅ 完全支持  
**跨域支持**: ✅ 完全支持  
**R2APP 兼容性**: ✅ 完全兼容
