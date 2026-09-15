# CS-Explorer 存储服务对接实施状态

更新日期：2026-09-15

本文记录 [STORAGE_INTEGRATION_PLAN.md](./STORAGE_INTEGRATION_PLAN.md) 的实施结果。状态分为：

- **已实现**：代码、配置界面、IPC 与文档完成，构建通过。
- **已验证（本地）**：通过本地自动化冒烟测试。
- **待实测**：代码完成，但需要真实服务/账号的专项验收（对应计划文档第 9 节第 1、5 步），标记为"待实测"的服务在验收前不应列入正式"已支持"名单。

## 1. 总览

| 阶段 | 对接方向 | 实现状态 | 验证状态 |
| --- | --- | --- | --- |
| P0 | 通用 S3（Amazon S3 / MinIO / Backblaze B2 / 自定义） | 已实现 | 已验证（本地逻辑冒烟 16/16）；真实服务专项验收待实测 |
| P1 | WebDAV（Nextcloud / ownCloud / NAS） | 已实现 | 已验证（本地 WebDAV 服务冒烟 12/12）；Nextcloud 等真实部署待实测 |
| P1 | SFTP（OpenSSH / NAS） | 已实现 | 待实测（本环境无 SSH 服务端，出站 22 端口受限） |
| P2 | OneDrive / SharePoint | 已实现 | 待实测（需要注册 Azure 应用与真实账号） |
| P2 | Google Drive | 已实现 | 待实测（需要注册 Google OAuth 应用与真实账号） |

## 2. 新增代码

| 文件 | 说明 |
| --- | --- |
| `electron/main/s3-api.js` | 通用 S3 适配器：可配置 Endpoint/Region/Path Style、rootPrefix、linkMode（公开/预签名）、上传取消、复制后删除的移动、错误分类 |
| `electron/main/webdav-api.js` | WebDAV 适配器：PROPFIND（Depth 1）解析、PUT/GET 流式传输、MKCOL/MOVE/COPY/DELETE、Overwrite 冲突检测、受信任 CA 配置 |
| `electron/main/sftp-api.js` | SFTP 适配器（ssh2 ^1.17.0）：密码/私钥（含口令）、SHA256 主机指纹校验（首次信任/变更阻止）、lstat 防符号链接递归、远端临时文件上传后重命名 |
| `electron/main/onedrive-api.js` | Microsoft Graph 适配器：个人/企业/SharePoint（resourceKind + driveId/siteId）、上传会话（5 MiB 分片 + Retry-After 退避）、短期授权 URL、回收站删除语义 |
| `electron/main/google-drive-api.js` | Drive v3 适配器：resumable 上传、按 ID 与父目录操作、Google 文档导出映射（docx/xlsx/pptx/png）、移入回收站（无永久删除） |
| `electron/main/oauth-manager.js` | 桌面 OAuth：系统浏览器 + PKCE(S256) + 本地回环回调 + state 校验 + 令牌自动刷新；OneDrive/Google Drive 共用 |
| `electron/main/secure-store.js` | 凭据引用机制：Electron safeStorage（系统加密能力）加密后存入独立 `credentials.json`；不可用时仅本次会话保存并明确提示 |
| `scripts/webdav-smoke-test.mjs` | 本地内存 WebDAV 服务 + 适配器冒烟测试（12 项断言） |
| `scripts/s3-smoke-test.mjs` | S3 适配器纯逻辑冒烟测试（16 项断言） |
| `scripts/sftp-online-test.mjs` | SFTP 在线冒烟测试脚本（公网测试服务器，本环境不可达，留作验收工具） |

## 3. 修改的现有代码

| 文件 | 修改 |
| --- | --- |
| `electron/main/index.js` | 新类型注册（`getAPIInstance` 按配置 ID 缓存实例）、15 处 IPC 分发覆盖（test-connection / check-status / get-bucket-stats / list-objects / delete-object / delete-folder / create-folder / get-object-content / upload / download / search / get-presigned-url）、`save-profiles` 机密字段脱敏与已删配置凭据清理、`get-provider-capabilities` / `start-oauth` / `cancel-oauth` 新 IPC、上传任务绑定配置 ID |
| `electron/preload/index.mjs` | 暴露 `getProviderCapabilities` / `startOAuth` / `cancelOAuth` |
| `electron.vite.config.js` | `ssh2` 加入主进程外部依赖 |
| `src/pages/Settings.jsx` | 五种新类型的模板、图标、表单（含 S3 预设、SFTP 指纹信任对话框、OneDrive/GDrive 浏览器授权按钮）；新类型机密输入框"已保存（加密）"占位语义 |
| `src/pages/Files.jsx` | 按能力声明隐藏复制链接/二维码；无公开链接服务的预览降级为下载；上传任务绑定配置 ID |
| `src/contexts/UploadsContext.jsx` | 上传任务记录并传递 `profileId`（切换账号不改变已排队任务目标） |
| `src/pages/Dashboard.jsx` | 统计不可用时显示"暂不支持"；遍历截断与服务端配额提示 |
| `package.json` | 新增 `ssh2` 依赖 |

## 4. 凭据与安全行为

- 新类型（s3/webdav/sftp/onedrive/google-drive）的机密字段（AccessKey、密码、私钥口令、clientSecret、OAuth 令牌）保存时由主进程经 `safeStorage` 加密写入 `credentials.json`（userData 下独立文件），`config.json` 中只保留 `credentialRef` 标记，导出/查看配置即默认脱敏。
- 系统加密能力不可用时：凭据仅保存在本次会话（内存），重启后需重新输入；应用不会静默降级为明文长期保存。
- SFTP：首次连接展示 SHA256 主机指纹，用户核对后保存；指纹变化时阻止自动连接并明确提示。
- OAuth：PKCE + state 校验 + 本地回环一次性回调服务；refresh token 只存在于主进程加密存储，渲染进程仅拿到账号展示邮箱。
- 老类型（R2、京东云等）行为不变，凭据仍保存在原配置文件中（与本文档实施前的现状一致）。

## 5. 专项验收清单（待实测，按计划文档各节）

以下需要在真实服务/账号上执行；完成后再将状态更新为"已验证"。

### 通用 S3
- [ ] Amazon S3、MinIO、Backblaze B2 分别完成连接测试（覆盖 Path Style 开关）
- [ ] 私有桶预签名链接可访问且按 expiry 过期；公开桶/自定义域名链接可用
- [ ] 超过 1000 个对象翻页；中文/空格/`+`/`#` 文件名上传下载
- [ ] 分片上传、取消上传；同名冲突；错误凭据的分类提示（auth/forbidden/endpoint）

### WebDAV
- [ ] Nextcloud（应用密码）、ownCloud、至少一种 NAS
- [ ] 根目录/子目录、中文路径、只读账号、移动冲突（412）、锁定文件（423）、大文件、网络中断、自签名证书 + CA 配置提示

### SFTP
- [ ] OpenSSH 密码登录、加密私钥（口令）登录
- [ ] 首次信任指纹流程；指纹变化阻止；权限不足；符号链接删除不逃逸根目录；断线重连；取消上传后远端无残留临时文件

### OneDrive / SharePoint
- [ ] 个人账号、企业账号、SharePoint 文档库分别授权并浏览
- [ ] 登录取消、令牌刷新/撤销、授权不足（管理员批准提示）、分页、重命名、大文件上传会话、限流重试、回收站恢复说明、多账号隔离

### Google Drive
- [ ] 登录取消、令牌刷新/撤销、权限范围边界说明、分页、同名文件、回收站、Google 文档导出（docx/xlsx/pptx/png）、大文件 resumable、限流、多账号隔离

### 通用回归
- [ ] 现有 R2 与京东云账号的上传/下载/删除/列表回归
- [ ] Windows / macOS / Linux 平台路径与凭据存储差异（当前仅 Windows 本地验证构建与冒烟）

## 6. 已知边界（与计划一致）

- 同名冲突策略首期与现有对象存储保持一致（覆盖）；询问/跳过/重命名的统一冲突 UI 为后续工作。
- WebDAV/SFTP 不提供公开分享链接；OneDrive/SharePoint 租户外部分享策略、Google 共享云端硬盘、"与我共享"、快捷方式均未在本期实现。
- WebDAV 普通 PUT 不代表断点续传；Nextcloud 分块上传为后续能力。
- 容量统计无法从服务准确获取时（OneDrive 文件总数、遍历截断等）显示"暂不支持"或部分结果，不虚构数据。
