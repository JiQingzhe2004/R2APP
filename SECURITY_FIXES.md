# 安全修复报告 (Security Fixes Report)

本应用通过使用 `@doyensec/electronegativity` 进行自动化安全扫描，识别并修复了多项潜在的安全漏洞。以下是本次修复的详细内容及对应的代码变更。

## 1. 启用沙箱模式 (Enable Sandbox)

**问题描述**: 应用中的窗口（如更新窗口、启动窗口）之前禁用了沙箱模式 (`sandbox: false`)，这使得渲染进程拥有了过高的权限，一旦被攻破可能危及整个系统。

**修复方案**: 为所有辅助窗口启用了沙箱模式，并确保上下文隔离 (`contextIsolation`) 处于开启状态。

### 代码变更

**文件**: `electron/main/index.js` (更新窗口)
```javascript
updateWindow = new BrowserWindow({
  // ... 其他配置
  webPreferences: {
    preload: join(__dirname, '../preload/index.mjs'),
    sandbox: true, // 启用沙箱
    contextIsolation: true, // 开启上下文隔离
    webSecurity: true,
  },
  // ...
});
```

**文件**: `electron/main/splash-screen.js` (启动窗口)
```javascript
splashWindow = new BrowserWindow({
  // ... 其他配置
  webPreferences: {
    preload: join(__dirname, '../preload/index.mjs'),
    sandbox: true, // 启用沙箱
    contextIsolation: true,
  }
});
```

## 2. 安全地暴露 API (Secure Context Bridge)

**问题描述**: 预加载脚本直接导出了 `api` 对象。虽然 Electron 新版本会自动处理，但在启用上下文隔离的情况下，显式使用 `contextBridge` 是更安全、更规范的做法，可以防止原型污染攻击。

**修复方案**: 使用 `contextBridge.exposeInMainWorld` 将 API 暴露给渲染进程。

### 代码变更

**文件**: `electron/preload/index.mjs`
```javascript
import { contextBridge, ipcRenderer, webUtils } from 'electron'

// 定义 versions 和 api 对象 (省略具体内容)
const versions = { ... }
const api = { ... }

// 使用 contextBridge 安全地暴露 API
try {
  contextBridge.exposeInMainWorld('versions', versions)
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
```

## 3. 限制导航与新窗口 (Navigation & New Window Limits)

**问题描述**: 默认情况下，Electron 允许窗口导航到任意 URL 或打开新窗口，这可能导致用户被重定向到恶意网站（钓鱼攻击）。

**修复方案**: 
1. 全局拦截 `will-navigate` 事件，阻止主窗口跳转到非受信任的 URL。对于普通的 HTTP/HTTPS 链接，自动调用系统默认浏览器打开，而不是在应用内跳转。
2. 为辅助窗口（如启动页）添加专门的拦截器，禁止任何导航和新窗口创建。

### 代码变更

**文件**: `electron/main/index.js` (全局防护)
```javascript
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // 1. 允许本地文件 (应用页面)
    if (parsedUrl.protocol === 'file:') return;
    
    // 2. 允许受信任的更新源
    if (navigationUrl.startsWith('https://wpaiupload.aiqji.com')) return;

    // 3. 处理外部链接：调用系统浏览器打开
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      shell.openExternal(navigationUrl);
      event.preventDefault();
      return;
    }

    // 4. 阻止其他非法导航
    console.log(`Blocked navigation to: ${navigationUrl}`);
    event.preventDefault();
  });
});
```

**文件**: `electron/main/splash-screen.js` (启动窗口防护)
```javascript
// Security: Limit navigation
splashWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
splashWindow.webContents.on('will-navigate', (event, url) => {
  event.preventDefault();
});
```

## 4. 权限请求拦截 (Permission Request Handler)

**问题描述**: 应用未处理权限请求，默认情况下 Electron 可能会自动批准某些权限，或让恶意页面有机会请求敏感权限（如摄像头、麦克风）。

**修复方案**: 添加全局权限请求处理程序，默认拒绝所有敏感权限请求，仅允许必要的本地文件访问。

### 代码变更

**文件**: `electron/main/index.js`
```javascript
session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  const parsedUrl = new URL(webContents.getURL());
  // 仅允许本地文件或开发者工具通过权限检查（通常不需要特定权限，这里作为安全兜底）
  if (parsedUrl.protocol === 'file:' || parsedUrl.protocol === 'devtools:') {
    callback(true);
  } else {
    console.log(`Blocked permission '${permission}' for ${webContents.getURL()}`);
    callback(false);
  }
});
```

## 5. 内容安全策略 (Content Security Policy - CSP)

**问题描述**: 应用的 CSP 配置中包含了 `unsafe-eval`，这允许执行字符串形式的代码（如 `eval()`），增加了 XSS 攻击的风险。

**修复方案**: 限制脚本和资源的加载源。
*(注: 为了兼容开发环境的热重载 (HMR) 和 React 开发工具，暂时保留了 `unsafe-eval`。生产环境建议在构建流程中移除它。)*

### 代码变更

**文件**: `index.html`
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: *; media-src 'self' data: blob: *; frame-src 'self'; worker-src 'self' blob:; connect-src *; font-src 'self' data:;">
```
*(注: `unsafe-inline` 用于样式兼容，`unsafe-eval` 用于开发环境兼容)*

---

**扫描清理**: 自动化扫描生成的 `audit_result.csv` 文件已删除。
