const axios = require('axios');

const API_BASE = 'https://cstj.server.aiqji.cn/api/analytics';

// 测试数据
const testInstallData = {
  machineId: 'test-machine-' + Date.now(),
  version: '1.0.0',
  platform: 'win32',
  arch: 'x64'
};

const testUsageData = {
  machineId: 'test-machine-' + Date.now(),
  version: '1.0.0',
  platform: 'win32',
  arch: 'x64',
  uptime: 300
};

async function testAPI() {
  console.log('🧪 开始测试 R2APP 统计 API...\n');

  try {
    // 测试健康检查
    console.log('1. 测试健康检查...');
    const healthResponse = await axios.get('https://cstj.server.aiqji.cn/health');
    console.log('✅ 健康检查成功:', healthResponse.data);
    console.log('');

    // 测试安装统计
    console.log('2. 测试安装统计...');
    const installResponse = await axios.post(`${API_BASE}/install`, testInstallData);
    console.log('✅ 安装统计成功:', installResponse.data);
    console.log('');

    // 测试使用统计
    console.log('3. 测试使用统计...');
    const usageResponse = await axios.post(`${API_BASE}/usage`, testUsageData);
    console.log('✅ 使用统计成功:', usageResponse.data);
    console.log('');

    // 测试获取仪表盘数据
    console.log('4. 测试获取仪表盘数据...');
    const dashboardResponse = await axios.get(`${API_BASE}/dashboard`);
    console.log('✅ 仪表盘数据获取成功');
    console.log('总安装数:', dashboardResponse.data.data.overview.totalInstalls);
    console.log('总使用次数:', dashboardResponse.data.data.overview.totalUsage);
    console.log('');

    // 测试获取详细统计
    console.log('5. 测试获取详细统计...');
    const statsResponse = await axios.get(`${API_BASE}/stats?period=7d`);
    console.log('✅ 详细统计获取成功');
    console.log('统计周期:', statsResponse.data.data.period);
    console.log('数据条数:', statsResponse.data.data.dailyStats.length);
    console.log('');

    console.log('🎉 所有 API 测试通过！');

  } catch (error) {
    console.error('❌ API 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    await axios.get('https://cstj.server.aiqji.cn/health');
    return true;
  } catch (error) {
    return false;
  }
}

// 主函数
async function main() {
  console.log('🔍 检查服务器状态...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ 服务器未运行，请先启动服务器：');
    console.log('   npm run server');
    console.log('   或者运行 start-dev.bat');
    return;
  }

  console.log('✅ 服务器正在运行，开始测试...\n');
  await testAPI();
}

main();
