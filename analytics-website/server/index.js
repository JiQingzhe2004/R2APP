const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./database');
const analyticsRoutes = require('./routes/analytics');
const announcementsRoutes = require('./routes/announcements');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3006;

// 中间件
app.use(helmet({
  // 为Electron应用放宽一些安全限制
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 配置CORS以支持Electron应用
const corsOptions = {
  origin: function (origin, callback) {
    // 允许所有来源，包括Electron应用
    // Electron应用通常没有origin头，或者origin为null
    if (!origin || origin === 'null' || origin.startsWith('file://') || origin.startsWith('app://')) {
      callback(null, true);
    } else {
      // 也允许本地开发环境
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'User-Agent'],
  exposedHeaders: ['Content-Length', 'X-Total-Count'],
  maxAge: 86400 // 24小时
};

app.use(cors(corsOptions));

// 预检请求处理
app.options('*', cors(corsOptions));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 添加Electron应用识别中间件
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isElectron = userAgent.includes('Electron') || 
                     userAgent.includes('R2APP') || 
                     req.headers['x-electron-app'];
  
  // 为Electron请求添加特殊标识
  req.isElectronApp = isElectron;
  
  // 记录请求信息
  console.log(`${req.method} ${req.path} - ${isElectron ? 'Electron App' : 'Browser'} - ${userAgent.substring(0, 100)}`);
  
  next();
});

// 初始化数据库
initDatabase();

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/announcements', announcementsRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    electronSupport: true,
    corsEnabled: true
  });
});

// 静态文件服务（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试',
    electronSupport: true
  });
});

app.listen(PORT, () => {
  console.log(`🚀 统计服务器运行在端口 ${PORT}`);
  console.log(`📊 API地址: http://localhost:${PORT}/api/analytics`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔧 Electron应用支持: 已启用`);
  console.log(`🌐 CORS跨域支持: 已启用`);
});
