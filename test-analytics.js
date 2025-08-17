const https = require('https');

// 测试统计API
async function testAnalytics() {
  console.log('🧪 测试 R2APP 统计功能...\n');

  const testData = {
    type: 'install',
    machineId: 'test-machine-' + Date.now(),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    platform: 'win32',
    arch: 'x64',
    installType: 'first_time',
    previousVersion: null
  };

  const postData = JSON.stringify(testData);
  const url = 'https://cstj.server.aiqji.cn/api/analytics/install';

  console.log('📡 发送测试数据到:', url);
  console.log('📊 测试数据:', testData);
  console.log('');

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'R2APP/1.0.0 (Test)'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('📥 响应状态:', res.statusCode);
        console.log('📥 响应头:', res.headers);
        console.log('📥 响应数据:', data);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('\n✅ 统计API测试成功！');
          resolve(true);
        } else {
          console.log('\n❌ 统计API测试失败！');
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ 请求错误:', err.message);
      reject(err);
    });

    req.on('timeout', () => {
      console.error('❌ 请求超时');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// 测试健康检查
async function testHealth() {
  console.log('🏥 测试健康检查...\n');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'cstj.server.aiqji.cn',
      port: 443,
      path: '/health',
      method: 'GET',
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('📥 健康检查状态:', res.statusCode);
        console.log('📥 健康检查数据:', data);
        
        if (res.statusCode === 200) {
          console.log('\n✅ 健康检查成功！');
          resolve(true);
        } else {
          console.log('\n❌ 健康检查失败！');
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ 健康检查错误:', err.message);
      reject(err);
    });

    req.on('timeout', () => {
      console.error('❌ 健康检查超时');
      req.destroy();
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
}

// 主函数
async function main() {
  try {
    // 先测试健康检查
    await testHealth();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 再测试统计API
    await testAnalytics();
    
    console.log('\n🎉 所有测试完成！');
  } catch (error) {
    console.error('\n💥 测试过程中出现错误:', error.message);
  }
}

main();
