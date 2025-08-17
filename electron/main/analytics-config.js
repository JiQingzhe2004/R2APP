// 统计配置
export const ANALYTICS_CONFIG = {
  // 统计接口地址 - 请替换为您的实际接口地址
  API_URL: 'https://cstj.server.aiqji.cn/analytics',
  
  // 是否启用统计（开发环境可以关闭）
  ENABLED: process.env.NODE_ENV === 'production',
  
  // 统计超时时间（毫秒）
  TIMEOUT: 10000,
  
  // 重试次数
  RETRY_COUNT: 3,
  
  // 重试间隔（毫秒）
  RETRY_DELAY: 2000
};
