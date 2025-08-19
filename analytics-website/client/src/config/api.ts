// API配置文件
const API_CONFIG = {
  // 开发环境使用代理，生产环境使用环境变量
  BASE_URL: process.env.REACT_APP_API_URL || 
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3006' : 'https://cstj.server.aiqji.cn'),
  
  // API端点
  ENDPOINTS: {
    DASHBOARD: '/api/analytics/dashboard',
    INSTALL: '/api/analytics/install',
    USAGE: '/api/analytics/usage',
    STATS: '/api/analytics/stats',
    HEALTH: '/health'
  }
};

// 获取完整的API URL
export const getApiUrl = (endpoint: string): string => {
  // 确保 endpoint 以 /api 开头
  const apiEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  return `${API_CONFIG.BASE_URL}${apiEndpoint}`;
};

// 导出配置
export default API_CONFIG;
