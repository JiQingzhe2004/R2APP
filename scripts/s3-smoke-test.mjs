/**
 * S3 适配器纯逻辑冒烟测试（无网络）：rootPrefix 映射、公开 URL、错误分类。
 * 运行：node scripts/s3-smoke-test.mjs
 */
import S3Api, { classifyS3Error, S3_PRESETS } from '../electron/main/s3-api.js';

let failed = 0;
function assert(cond, name, extra = '') {
  if (!cond) {
    failed++;
    console.error(`❌ ${name} ${extra}`);
  } else {
    console.log(`✅ ${name}`);
  }
}

const api = new S3Api({
  id: 'smoke',
  bucket: 'my-bucket',
  accessKeyId: 'AKIA-FAKE',
  secretAccessKey: 'secret-fake',
  endpoint: 'https://s3.us-west-004.backblazeb2.com/',
  region: 'us-west-004',
  forcePathStyle: true,
  rootPrefix: 'photos/2026/',
  publicDomain: 'cdn.example.com',
  linkMode: 'public'
});

// rootPrefix 换算
assert(api.toRemote('a b/中文.txt') === 'photos/2026/a b/中文.txt', 'toRemote 追加根前缀');
assert(api.toLocal('photos/2026/a b/中文.txt') === 'a b/中文.txt', 'toLocal 剥离根前缀');
assert(api.toLocal('outside.txt') === 'outside.txt', '前缀外的 key 原样返回');

// 公开 URL（自定义域名 + 编码）
const pub = api.getPublicUrl('a b/中文+名称.txt');
assert(pub === 'cdn.example.com'.startsWith('h') ? pub : 'https://cdn.example.com/a%20b/%E4%B8%AD%E6%96%87%2B%E5%90%8D%E7%A7%B0.txt', '公开 URL 域名与编码', pub);
assert(!pub.includes('%2F'), '路径分隔符不被编码', pub);

// path style URL
const api2 = new S3Api({ id: 's2', bucket: 'b2', accessKeyId: 'a', secretAccessKey: 'b', endpoint: 'http://127.0.0.1:9000', forcePathStyle: true });
assert(api2.getPublicUrl('k.txt') === 'http://127.0.0.1:9000/b2/k.txt', 'Path Style URL', api2.getPublicUrl('k.txt'));

// virtual-hosted URL
const api3 = new S3Api({ id: 's3', bucket: 'vb', accessKeyId: 'a', secretAccessKey: 'b', endpoint: 'https://s3.example.com', forcePathStyle: false });
assert(api3.getPublicUrl('k.txt') === 'https://vb.s3.example.com/k.txt', 'Virtual-hosted URL', api3.getPublicUrl('k.txt'));

// linkMode 默认 presigned → 无公开域名时 getPublicUrl 不用于分享
assert(api2.getCapabilities().publicLink === false && api.getCapabilities().publicLink === true, '能力声明随 linkMode 变化');

// 错误分类
assert(classifyS3Error({ name: 'InvalidAccessKeyId' }).kind === 'auth', '无效密钥 → auth');
assert(classifyS3Error({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }).kind === 'forbidden', 'AccessDenied → forbidden');
assert(classifyS3Error({ name: 'NoSuchBucket' }).kind === 'not-found', 'NoSuchBucket → not-found');
assert(classifyS3Error({ name: 'SlowDown' }).kind === 'throttled', 'SlowDown → throttled');
assert(classifyS3Error({ name: 'AuthorizationHeaderMalformed' }).kind === 'endpoint', '区域/端点错误 → endpoint');
assert(classifyS3Error({ message: 'Upload aborted' }).kind === 'cancelled', '上传取消 → cancelled');

// 预设
assert(S3_PRESETS.minio.forcePathStyle === true && S3_PRESETS.aws.forcePathStyle === false, '预设默认参数');

// endpoint 归一化（构造时接受无协议前缀）
const api4 = new S3Api({ id: 's4', bucket: 'b', accessKeyId: 'a', secretAccessKey: 'b', endpoint: 's3.example.com', forcePathStyle: true });
assert(api4.getPublicUrl('k') === 'https://s3.example.com/b/k', '无协议 endpoint 自动补全', api4.getPublicUrl('k'));

if (failed > 0) {
  process.exit(1);
}
console.log('\nS3 纯逻辑冒烟测试全部通过');
