/**
 * SFTP 适配器在线冒烟测试（可选，需要能访问公网 test.rebex.net）。
 * Rebex 提供公开只读测试账号（demo/password），仅做连接、指纹与列举、下载验证。
 * 运行：node scripts/sftp-online-test.mjs
 */
import SftpApi from '../electron/main/sftp-api.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  // 第一连：期望返回未验证指纹（trustedFingerprint 为空）
  const first = new SftpApi({
    id: 'rebex',
    host: 'test.rebex.net',
    port: 22,
    username: 'demo',
    authMode: 'password',
    password: 'password',
    rootPath: '/',
    readyTimeout: 15000
  });

  const firstResult = await first.testConnection();
  console.log('第一次连接结果:', JSON.stringify(firstResult, null, 2));

  if (!firstResult.fingerprint) {
    console.log('⚠️ 未获得指纹（可能无法访问测试服务器），跳过剩余测试');
    return;
  }
  if (!firstResult.needsTrust) {
    console.error('❌ 期望"未信任指纹"结果');
    process.exit(1);
  }
  console.log('✅ 首次连接正确要求信任指纹:', firstResult.fingerprint);

  // 第二连：信任该指纹
  const trusted = new SftpApi({
    id: 'rebex2',
    host: 'test.rebex.net',
    port: 22,
    username: 'demo',
    authMode: 'password',
    password: 'password',
    rootPath: '/',
    readyTimeout: 15000,
    trustedFingerprint: firstResult.fingerprint
  });

  const ok = await trusted.testConnection();
  console.log('信任后连接结果:', JSON.stringify(ok, null, 2));
  if (!ok.success) {
    console.error('❌ 信任指纹后连接失败');
    process.exit(1);
  }
  console.log('✅ 信任指纹后连接成功');

  // 列举根目录
  const list = await trusted.listFiles({ prefix: '' });
  console.log('列举结果:', JSON.stringify(list.data, null, 2));
  if (!list.success || !list.data.files.some(f => f.Key === 'readme.txt')) {
    console.error('❌ 未能列出 readme.txt');
    process.exit(1);
  }
  console.log('✅ 列举成功（含 readme.txt）');

  // 下载
  const target = path.join(os.tmpdir(), 'rebex-readme.txt');
  await trusted.downloadFile('readme.txt', target, () => {});
  const content = fs.readFileSync(target, 'utf8');
  if (!content || content.length < 10) {
    console.error('❌ 下载内容为空');
    process.exit(1);
  }
  console.log('✅ 下载成功，内容长度:', content.length);

  // 错误密码
  const bad = new SftpApi({
    id: 'rebex3',
    host: 'test.rebex.net',
    port: 22,
    username: 'demo',
    authMode: 'password',
    password: 'wrong-password',
    rootPath: '/',
    readyTimeout: 15000,
    trustedFingerprint: firstResult.fingerprint
  });
  const badResult = await bad.testConnection();
  console.log('错误密码结果:', JSON.stringify(badResult, null, 2));
  if (badResult.success || badResult.kind !== 'auth') {
    console.error('❌ 期望认证失败');
    process.exit(1);
  }
  console.log('✅ 错误密码 → 认证失败');

  console.log('\nSFTP 在线冒烟测试全部通过');
}

main().catch(error => {
  console.error('测试失败:', error.message);
  process.exit(1);
});
