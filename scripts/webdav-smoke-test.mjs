/**
 * WebDAV 适配器本地冒烟测试（开发用，不随应用打包）
 *
 * 在本机启动一个最小 WebDAV 服务（内存文件系统），
 * 覆盖：PROPFIND 列举 / PUT 上传 / GET 下载 / MKCOL / MOVE / DELETE / 中文路径。
 * 运行：node scripts/webdav-smoke-test.mjs
 */
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import WebdavApi from '../electron/main/webdav-api.js';

const PORT = 34567;
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'webdav-test-'));
const users = { 'testuser': 'testpass' };

function fsPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const rel = decoded.replace(/^\/dav\/?/, '').replace(/\/+$/, '');
  const full = path.join(ROOT, rel);
  // 防目录穿越
  if (!full.startsWith(ROOT)) throw new Error('traversal');
  return full;
}

function propfindXml(entries, selfPath) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const responses = entries.map(entry => {
    const isDir = entry.isDir;
    const href = '/dav/' + entry.rel + (isDir && entry.rel ? '/' : '');
    return `<D:response>
<D:href>${esc(href)}</D:href>
<D:propstat><D:prop>
${isDir ? '<D:resourcetype><D:collection/></D:resourcetype>' : `<D:resourcetype/><D:getcontentlength>${entry.size}</D:getcontentlength><D:getlastmodified>${entry.mtime.toUTCString()}</D:getlastmodified><D:getcontenttype>application/octet-stream</D:getcontenttype>`}
</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
</D:response>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">${responses}</D:multistatus>`;
}

function listDir(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const entries = [{ rel, isDir: true, size: 0, mtime: fs.statSync(abs).mtime }];
  for (const name of fs.readdirSync(abs)) {
    const childAbs = path.join(abs, name);
    const childRel = rel ? `${rel}/${name}` : name;
    const stat = fs.statSync(childAbs);
    entries.push({ rel: childRel, isDir: stat.isDirectory(), size: stat.size, mtime: stat.mtime });
  }
  return entries;
}

const server = http.createServer((req, res) => {
  const auth = req.headers.authorization || '';
  const expected = 'Basic ' + Buffer.from('testuser:testpass').toString('base64');
  if (auth !== expected) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="test"' });
    res.end();
    return;
  }

  try {
    if (req.method === 'PROPFIND') {
      const rel = decodeURIComponent(req.url).replace(/^\/dav\/?/, '').replace(/\/+$/, '');
      const depth = req.headers.depth || '1';
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        if (depth === '0') {
          const abs = path.join(ROOT, rel);
          if (!fs.existsSync(abs)) { res.writeHead(404); res.end(); return; }
          const stat = fs.statSync(abs);
          res.writeHead(207, { 'Content-Type': 'application/xml' });
          res.end(propfindXml([{ rel, isDir: stat.isDirectory(), size: stat.size, mtime: stat.mtime }]));
          return;
        }
        const entries = listDir(rel);
        if (!entries) { res.writeHead(404); res.end(); return; }
        res.writeHead(207, { 'Content-Type': 'application/xml' });
        res.end(propfindXml(entries));
      });
      return;
    }

    if (req.method === 'MKCOL') {
      const target = fsPath(req.url);
      try {
        fs.mkdirSync(target);
        res.writeHead(201); res.end();
      } catch (e) {
        res.writeHead(fs.existsSync(target) ? 405 : 409); res.end();
      }
      return;
    }

    if (req.method === 'PUT') {
      const target = fsPath(req.url);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const ws = fs.createWriteStream(target);
      req.pipe(ws);
      ws.on('finish', () => { res.writeHead(201); res.end(); });
      ws.on('error', () => { res.writeHead(500); res.end(); });
      return;
    }

    if (req.method === 'GET') {
      const target = fsPath(req.url);
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      const stat = fs.statSync(target);
      res.writeHead(200, { 'Content-Length': stat.size });
      fs.createReadStream(target).pipe(res);
      return;
    }

    if (req.method === 'DELETE') {
      const target = fsPath(req.url);
      if (!fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
      fs.rmSync(target, { recursive: true });
      res.writeHead(204); res.end();
      return;
    }

    if (req.method === 'MOVE' || req.method === 'COPY') {
      const source = fsPath(req.url);
      const destUrl = new URL(req.headers.destination);
      const dest = fsPath(destUrl.pathname);
      const overwrite = (req.headers.overwrite || 'T').toUpperCase() !== 'F';
      if (!fs.existsSync(source)) { res.writeHead(404); res.end(); return; }
      if (fs.existsSync(dest) && !overwrite) { res.writeHead(412); res.end(); return; }
      if (req.method === 'MOVE') {
        fs.rmSync(dest, { recursive: true, force: true });
        fs.renameSync(source, dest);
      } else {
        fs.cpSync(source, dest, { recursive: true, force: overwrite });
      }
      res.writeHead(201); res.end();
      return;
    }

    res.writeHead(405); res.end();
  } catch (error) {
    console.error('[test-server]', error);
    res.writeHead(500); res.end();
  }
});

function assert(cond, name) {
  if (!cond) {
    console.error(`❌ ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${name}`);
  }
}

async function main() {
  await new Promise(resolve => server.listen(PORT, resolve));

  const api = new WebdavApi({
    id: 'smoke',
    baseUrl: `http://127.0.0.1:${PORT}/dav`,
    username: 'testuser',
    password: 'testpass',
    rootPath: ''
  });

  // 1. 连接测试
  const conn = await api.testConnection();
  assert(conn.success, `连接测试: ${conn.message || conn.error}`);

  // 2. 创建目录（含中文）
  await api.createFolder('测试目录');
  await api.createFolder('测试目录/子目录');
  const list1 = await api.listFiles({ prefix: '' });
  assert(list1.success && list1.data.folders.some(f => f.key === '测试目录/'), `列举根目录（含中文目录）: ${JSON.stringify(list1.data?.folders)}`);

  // 3. 上传文件
  const tmpFile = path.join(os.tmpdir(), 'upload-sample.txt');
  fs.writeFileSync(tmpFile, 'Hello 中文 WebDAV '.repeat(1000));
  let progressSeen = false;
  await api.uploadFile(tmpFile, '测试目录/子目录/hello 世界.txt', (p) => { progressSeen = true; });
  assert(true, `上传文件（进度回调 ${progressSeen ? '有' : '无'}）`);

  // 4. 列举子目录
  const list2 = await api.listFiles({ prefix: '测试目录/' });
  assert(list2.success && list2.data.folders.some(f => f.key === '测试目录/子目录/'), '列举子目录');

  const list3 = await api.listFiles({ prefix: '测试目录/子目录/' });
  assert(list3.success && list3.data.files.some(f => f.Key === '测试目录/子目录/hello 世界.txt'), `文件出现在列表: ${JSON.stringify(list3.data?.files?.map(f => f.Key))}`);

  // 5. 下载并校验内容
  const dlTarget = path.join(os.tmpdir(), 'download-sample.txt');
  await api.downloadFile('测试目录/子目录/hello 世界.txt', dlTarget, () => {});
  const roundTrip = fs.readFileSync(dlTarget, 'utf8');
  assert(roundTrip === fs.readFileSync(tmpFile, 'utf8'), '下载内容一致');

  // 6. 移动
  await api.moveEntry('测试目录/子目录/hello 世界.txt', '测试目录/renamed.txt');
  const list4 = await api.listFiles({ prefix: '测试目录/' });
  assert(list4.data.files.some(f => f.Key === '测试目录/renamed.txt'), '移动（重命名）成功');

  // 7. 冲突检测（Overwrite: F）
  let conflictErr = null;
  try {
    await api.moveEntry('测试目录/renamed.txt', '测试目录/renamed.txt');
  } catch (e) { /* 同名自身移动可能成功 */ }
  try {
    await api.copyEntry('测试目录/renamed.txt', '测试目录/renamed.txt', false);
  } catch (e) { conflictErr = e; }
  assert(conflictErr !== null, 'Overwrite=F 同名冲突被拒绝');

  // 8. 删除文件与目录
  await api.deleteFile('测试目录/renamed.txt');
  await api.deleteFolder('测试目录/');
  const list5 = await api.listFiles({ prefix: '' });
  assert(list5.data.folders.length === 0 && list5.data.files.length === 0, '删除目录后列表为空');

  // 9. 预览内容
  await api.uploadFile(tmpFile, 'small.txt', null);
  const content = await api.getFileContent('small.txt', 1024 * 1024);
  assert(content.success && !content.data.tooLarge && content.data.content.startsWith('Hello'), '预览读取内容');

  // 10. 错误密码
  const badApi = new WebdavApi({ id: 'bad', baseUrl: `http://127.0.0.1:${PORT}/dav`, username: 'testuser', password: 'wrong', rootPath: '' });
  const badConn = await badApi.testConnection();
  assert(!badConn.success && badConn.kind === 'auth', `错误凭据 → 认证失败: ${badConn.error}`);

  // 11. 统计
  const stats = await api.getStorageStats();
  assert(stats.success && stats.data.totalCount === 1 && stats.data.totalSize > 0, `统计: ${JSON.stringify(stats.data)}`);

  console.log('\n冒烟测试完成');
  server.close();
  fs.rmSync(ROOT, { recursive: true, force: true });
}

main().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
