const axios = require('axios');

const API_BASE = 'https://cstj.server.aiqji.cn/api/analytics';

// 模拟Electron应用的请求头
const electronHeaders = {
  'User-Agent': 'R2APP/1.0.0 (Electron/28.0.0)',
  'X-Electron-App': 'true',
  'Content-Type': 'application/json'
};

// 测试数据
const testInstallData = {
  machineId: 'electron-machine-' + Date.now(),
  version: '1.0.0',
  platform: 'win32',
  arch: 'x64'
};

const testUsageData = {
  machineId: 'electron-machine-' + Date.now(),
  version: '1.0.0',
  platform: 'win32',
  arch: 'x64',
  uptime: 300
};

async function testElectronAPI() {
  console.log('🧪 开始测试 Electron 应用 API 兼容性...\n');

  try {
    // 测试健康检查
    console.log('1. 测试健康检查...');
    const healthResponse = await axios.get('https://cstj.server.aiqji.cn/health');
    console.log('✅ 健康检查成功:', healthResponse.data);
    console.log('Electron支持:', healthResponse.data.electronSupport);
    console.log('CORS启用:', healthResponse.data.corsEnabled);
    console.log('');

    // 测试安装统计（使用Electron请求头）
    console.log('2. 测试安装统计（Electron模式）...');
    const installResponse = await axios.post(`${API_BASE}/install`, testInstallData, {
      headers: electronHeaders
    });
    console.log('✅ 安装统计成功:', installResponse.data);
    console.log('');

    // 测试使用统计（使用Electron请求头）
    console.log('3. 测试使用统计（Electron模式）...');
    const usageResponse = await axios.post(`${API_BASE}/usage`, testUsageData, {
      headers: electronHeaders
    });
    console.log('✅ 使用统计成功:', usageResponse.data);
    console.log('');

    // 测试获取仪表盘数据
    console.log('4. 测试获取仪表盘数据...');
    const dashboardResponse = await axios.get(`${API_BASE}/dashboard`, {
      headers: electronHeaders
    });
    console.log('✅ 仪表盘数据获取成功');
    console.log('总安装数:', dashboardResponse.data.data.overview.totalInstalls);
    console.log('总使用次数:', dashboardResponse.data.data.overview.totalUsage);
    console.log('');

    // 测试获取详细统计
    console.log('5. 测试获取详细统计...');
    const statsResponse = await axios.get(`${API_BASE}/stats?period=7d`, {
      headers: electronHeaders
    });
    console.log('✅ 详细统计获取成功');
    console.log('统计周期:', statsResponse.data.data.period);
    console.log('数据条数:', statsResponse.data.data.dailyStats.length);
    console.log('');

    // 测试CORS预检请求
    console.log('6. 测试CORS预检请求...');
    try {
      const optionsResponse = await axios.options(`${API_BASE}/install`, {
        headers: electronHeaders
      });
      console.log('✅ CORS预检请求成功');
      console.log('允许的方法:', optionsResponse.headers['access-control-allow-methods']);
      console.log('允许的头:', optionsResponse.headers['access-control-allow-headers']);
    } catch (error) {
      console.log('⚠️ CORS预检请求:', error.message);
    }
    console.log('');

    console.log('🎉 所有 Electron API 测试通过！');
    console.log('📱 您的 R2APP 应用现在可以正常发送统计数据了！');

  } catch (error) {
    console.error('❌ Electron API 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
      console.error('响应头:', error.response.headers);
    }
    
    // 提供故障排除建议
    console.log('\n🔧 故障排除建议:');
    console.log('1. 确保后端服务器正在运行');
    console.log('2. 检查数据库连接');
    console.log('3. 验证端口 3006 未被占用');
    console.log('4. 检查防火墙设置');
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    const response = await axios.get('https://cstj.server.aiqji.cn/health');
    return response.data.electronSupport;
  } catch (error) {
    return false;
  }
}

// 主函数
async function main() {
  console.log('🔍 检查服务器状态和Electron支持...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ 服务器未运行或Electron支持未启用，请先启动服务器：');
    console.log('   npm run server');
    console.log('   或者运行 start-dev.bat');
    return;
  }

  console.log('✅ 服务器正在运行，Electron支持已启用，开始测试...\n');
  await testElectronAPI();
}

main();
