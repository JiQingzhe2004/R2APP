// 统计配置
export const ANALYTICS_CONFIG = {
  // 统计接口基础地址 - 请替换为您的实际接口地址
  BASE_URL: 'https://cstj.server.aiqji.cn',
  
  // 是否启用统计（默认启用，可以手动控制）
  ENABLED: true,
  
  // 统计超时时间（毫秒）
  TIMEOUT: 10000,
  
  // 重试次数
  RETRY_COUNT: 3,
  
  // 重试间隔（毫秒）
  RETRY_DELAY: 2000,
  
  // 调试模式
  DEBUG: true
};

// 获取完整的API URL
export const getAnalyticsUrl = (endpoint) => {
  return `${ANALYTICS_CONFIG.BASE_URL}/api/analytics${endpoint}`;
};

// 打印配置信息
if (ANALYTICS_CONFIG.DEBUG) {
  console.log('[Analytics Config] 统计配置已加载:');
  console.log('[Analytics Config] BASE_URL:', ANALYTICS_CONFIG.BASE_URL);
  console.log('[Analytics Config] ENABLED:', ANALYTICS_CONFIG.ENABLED);
  console.log('[Analytics Config] DEBUG:', ANALYTICS_CONFIG.DEBUG);
  console.log('[Analytics Config] 安装统计URL:', getAnalyticsUrl('/install'));
  console.log('[Analytics Config] 使用统计URL:', getAnalyticsUrl('/usage'));
}
