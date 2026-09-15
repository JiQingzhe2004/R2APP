# CS-Explorer 存储服务对接规划

更新日期：2026-09-15

本文是后续开发的对接设计和验收依据。下述新增适配器均处于规划阶段，不代表应用已经支持；配置字段和接口名称为建议方案，开发时需与现有数据结构兼容。

> 实施状态（2026-09-15）：P0-P2 五个方向的适配器、配置界面与 IPC 均已实现并通过构建；
> S3 与 WebDAV 已通过本地自动化冒烟测试，SFTP、OneDrive、Google Drive 及各服务的
> 真实环境专项验收仍为"待实测"。逐项状态与验收清单见
> [STORAGE_INTEGRATION_STATUS.md](./STORAGE_INTEGRATION_STATUS.md)。

## 1. 对接范围与顺序

| 阶段 | 对接方向 | 覆盖服务或场景 | 相对工作量 | 首期交付 | 实现状态 |
| --- | --- | --- | --- | --- | --- |
| P0 | 通用 S3 | Amazon S3、MinIO、Backblaze B2，以及通过实测的 S3 兼容服务 | 较小 | 自定义 Endpoint、桶内文件管理、完整上传下载 | 已实现（本地冒烟通过，真实服务待实测） |
| P1 | WebDAV | Nextcloud、ownCloud、开放 WebDAV 的 NAS | 中等 | 目录浏览、文件管理、用户名及应用密码认证 | 已实现（本地冒烟通过，真实服务待实测） |
| P1 | SFTP | Linux 服务器、开放 SSH/SFTP 的 NAS | 中等 | 密码或私钥连接、主机指纹校验、文件管理 | 已实现（待实测） |
| P2 | OneDrive / SharePoint | 个人 OneDrive、企业 OneDrive、SharePoint 文档库 | 较大 | 账号授权、选择驱动器或文档库、文件管理 | 已实现（待实测，需注册 Azure 应用） |
| P2 | Google Drive | Google 个人网盘，后续扩展共享云端硬盘 | 较大 | 账号授权、文件管理、Google 文档导出 | 已实现（待实测，需注册 Google OAuth 应用） |

优先完成通用 S3，再接 WebDAV 和 SFTP，最后处理依赖 OAuth 的两类网盘。工作量是基于现有代码复用程度的估计，不是开发工期承诺。

S3 兼容不等于所有 S3 功能都可用。服务只有通过对应验收后才能列为“已支持”。MinIO 和 Backblaze B2 均提供 S3 兼容接口。参考：[MinIO](https://min.io/docs/minio/linux/index.html)、[Backblaze B2](https://www.backblaze.com/docs/en/cloud-storage-call-the-s3-compatible-api)。

## 2. 现有实现与接入位置

仓库已有 R2、阿里云 OSS、腾讯云 COS、京东云、华为 OBS、七牛云、Google Cloud Storage、Gitee、SM.MS、兰空图床等适配代码；本次文档不重新验证这些服务的运行状态。

| 现有文件 | 用途 | 新增对接时的修改方向 |
| --- | --- | --- |
| [electron/main/index.js](../electron/main/index.js) | `getAPIInstance`、配置保存、连接测试、列表及传输等 IPC 分发 | 增加类型注册、实例缓存与操作分发，逐步收敛重复分支 |
| [electron/main/jdcloud-api.js](../electron/main/jdcloud-api.js) | 基于 AWS SDK，已有 Endpoint、Region、Path Style 参数 | 通用 S3 的主要参考实现 |
| [electron/main/r2-api.js](../electron/main/r2-api.js) | S3 上传、对象列表和预签名链接 | 复用传输能力，避免照搬 R2 固定 Endpoint 和 `auto` 区域 |
| [electron/main/gcs-api.js](../electron/main/gcs-api.js) | Google Cloud Storage 桶接口 | 仅参考模块组织；不能当作 Google Drive 实现 |
| [electron/main/proxy-config.js](../electron/main/proxy-config.js) | 网络代理处理 | 检查新增 SDK 的代理行为，避免不同账号互相影响 |
| [electron/preload/index.mjs](../electron/preload/index.mjs) | 向渲染进程开放受控 IPC | 优先兼容现有方法，必要时增加能力查询和 OAuth 操作 |
| [src/pages/Settings.jsx](../src/pages/Settings.jsx) | 服务配置入口 | 增加类型、字段、连接测试、账号授权及校验提示 |
| [src/pages/Files.jsx](../src/pages/Files.jsx) | 文件管理页面 | 按服务能力展示操作，支持基于 ID 的网盘项目 |
| [src/pages/Uploads.jsx](../src/pages/Uploads.jsx)、[src/pages/Downloads.jsx](../src/pages/Downloads.jsx) | 传输任务页面 | 显示进度、取消、失败原因和恢复状态 |
| [src/contexts/UploadsContext.jsx](../src/contexts/UploadsContext.jsx) | 上传状态管理 | 任务绑定配置 ID，切换账号不改变已创建任务的目标 |

当前主要配置由 `new Store()` 写入 electron-store。新增类型继续使用 `profiles` 和现有配置 ID，不自动改写用户已有 R2、京东云等配置。

## 3. 公共适配约定

### 3.1 配置结构

新增配置建议包含 `id`、`name`、`type`、`schemaVersion`、`root`、`credentialRef`，以及服务专属参数。建议类型值为 `s3`、`webdav`、`sftp`、`onedrive`、`google-drive`；SharePoint 通过 OneDrive 适配器中的资源类型区分。

`credentialRef` 是拟新增的凭据引用机制，当前仓库尚未实现。新增 OAuth refresh token、密码和私钥口令应由主进程管理并使用系统凭据存储或适当的系统加密能力；不能假设现有 `config.json` 已加密。凭据存储不可用时，应明确提示或仅在本次会话保存，不静默降级为长期明文保存。配置导出默认排除秘密字段。

### 3.2 统一接口草案

```ts
interface StorageAdapter {
  capabilities(): StorageCapabilities;
  testConnection(): Promise<ConnectionResult>;
  listEntries(parent: EntryRef, cursor?: string): Promise<EntryPage>;
  stat(entry: EntryRef): Promise<StorageEntry>;
  upload(request: UploadRequest): Promise<StorageEntry>;
  download(request: DownloadRequest): Promise<void>;
  createDirectory(parent: EntryRef, name: string): Promise<StorageEntry>;
  deleteEntry(entry: EntryRef, options: DeleteOptions): Promise<void>;
  moveEntry?(entry: EntryRef, destination: EntryRef): Promise<StorageEntry>;
  createShareLink?(entry: EntryRef, options: ShareOptions): Promise<ShareResult>;
}
```

以上是新抽象的接口草案，不是已存在的 TypeScript 类型。首个适配器接入时，可通过桥接层转换为现有 `listObjects`、`deleteObject`、`testConnection` 等 IPC 方法的参数和返回值，避免一次性重写全部服务。

公共模型的最低要求：

- `EntryRef` 至少包含 `profileId`、`id`；路径仅在服务有路径语义时使用。对象存储 key、SFTP 路径和网盘文件 ID 不互相替代。
- `StorageEntry` 包含名称、父级标识、文件/目录类型、大小、修改时间和 MIME 类型；未知大小与时间允许为空。
- `EntryPage` 返回 `items` 和不透明的 `nextCursor`，不让页面假设所有服务都使用页码。
- 传输参数包含本地路径、目标标识、冲突策略、进度回调及取消信号。总大小未知时显示已传字节，不显示虚假的百分比。
- 能力声明覆盖真实目录、移动、分享、范围下载、可恢复上传和配额查询。不支持的能力隐藏或明确说明，不能返回伪造成功。
- 错误统一区分认证失败、权限不足、目标不存在、同名冲突、限流、配额不足、网络错误和用户取消；保留脱敏后的服务错误码。
- 同名处理统一提供询问、跳过、覆盖、重命名。删除目录需要列明范围；跨服务移动首期不支持，避免下载上传后误删源文件。

## 4. 通用 S3

### 4.1 配置字段

| 字段 | 要求 | 说明 |
| --- | --- | --- |
| `endpoint` | 兼容服务必填，AWS 可由 SDK 按区域解析 | API 地址，不是管理控制台或 CDN 地址 |
| `region` | 必填或由服务预设明确提供 | 按服务文档填写，不统一使用 R2 的 `auto` |
| `bucket` | 必填 | 首期直接连接指定桶，不要求列出账号所有桶 |
| `accessKeyId`、`secretAccessKey` | 必填 | 引用主进程管理的凭据 |
| `sessionToken` | 可选 | 临时凭据使用；过期后提示重新配置或刷新 |
| `forcePathStyle` | 可选开关 | 按服务要求控制桶名称位于路径还是主机名 |
| `publicDomain` | 可选 | 用户已经配置的公开访问域名 |
| `rootPrefix` | 可选 | 限定界面管理的对象前缀，不替代服务端权限 |
| `linkMode` | 必填，有默认值 | 公开链接或临时预签名链接 |

提供 Amazon S3、MinIO、Backblaze B2 和“自定义”预设。预设仅帮助填写参数，保持用户可覆盖；B2 的 Endpoint 与区域按桶所属区域填写。服务间差异应查阅各自官方文档，而不是硬编码为同一种默认行为。

### 4.2 实现步骤

1. 新增 `electron/main/s3-api.js`，提取现有京东云/R2 中可复用的 S3 逻辑。
2. 实现连接测试、按前缀分页列举、上传、下载、删除和预签名链接。连接测试只做读取探测，不创建测试文件。
3. 对“列桶权限不足但指定桶可访问”的账号给出正确结果；`HeadBucket` 失败时区分认证、权限和 Endpoint 问题。
4. 目录采用对象前缀模型；文件夹创建是否写入空目录标记作为明确策略。移动对象按复制再删除处理，复制成功前不得删除源对象。
5. 为 S3 兼容服务处理签名、校验和、分页及分片能力差异；只在确认具体服务不支持时添加有范围的兼容开关。

验收：Amazon S3、MinIO、B2 分别测试；覆盖 Path Style 开关、私有桶、临时链接过期、超过一页的对象、中文/空格/`+`/`#` 文件名、分片上传、取消上传、同名处理及错误凭据。

## 5. WebDAV

Nextcloud 和 ownCloud 可通过 WebDAV 进行文件操作；NAS 需已启用对应服务，不能只填写其管理后台地址。[Nextcloud WebDAV](https://github.com/nextcloud/documentation/blob/master/developer_manual/client_apis/WebDAV/basic.rst)、[ownCloud WebDAV](https://doc.owncloud.com/server/next/developer_manual/webdav_api/index.html)。

### 5.1 配置与功能

配置字段：`baseUrl`、`username`、凭据引用、`rootPath`、连接超时，以及可选的受信任 CA 配置。Nextcloud 可填写账号专用应用密码。首期不承诺支持交互式 SSO 登录。

新增 `electron/main/webdav-api.js`，将目录查询、下载、上传、建目录、删除、移动映射到 WebDAV 操作。Nextcloud 的用户文件地址通常形如 `https://cloud.example.com/remote.php/dav/files/USERNAME/`，以实际部署地址为准。

### 5.2 适配重点

- 正确处理 `PROPFIND` 返回的多状态结果、目录项本身、尾斜杠和 URL 编码，避免重复编码路径。
- 默认逐层加载目录，避免深度递归查询拖慢 NAS；不要假设所有服务器提供统一分页。
- `MOVE`/覆盖、锁定文件、只读账号和配额能力需按服务器实测。
- WebDAV 普通 PUT 不代表支持断点续传；Nextcloud 专属分块上传作为后续能力单独实现。
- 私有 WebDAV 地址不直接作为公开分享链接。首期不提供通用分享，后续可接服务商专属分享 API。
- 保持 TLS 校验；自签名 NAS 使用受信任证书/CA 配置，不全局关闭证书验证。

验收：Nextcloud、ownCloud 和至少一种启用 WebDAV 的 NAS；覆盖根目录/子目录、中文路径、只读权限、移动冲突、锁定文件、大文件、网络中断及证书错误提示。

## 6. SFTP

SFTP 基于 SSH，与 FTP/FTPS 是不同协议。首期只承诺支持已经启用 SFTP 子系统的服务器，不自动开启服务端 SSH。

### 6.1 配置与功能

配置字段：`host`、`port`（默认 22）、`username`、`authMode`（密码/私钥）、凭据引用、`privateKeyPath`、私钥口令引用、`rootPath`、连接超时，以及已信任主机指纹。

新增 `electron/main/sftp-api.js`，候选实现可基于 `ssh2` 的 SFTP 能力。依赖版本在开发时选择并锁定，不在本文预先宣称已经安装。[ssh2 官方仓库](https://github.com/mscdex/ssh2)。

首期支持目录读取、属性查询、上传下载、创建目录、删除和服务器内重命名。使用独立连接管理、超时和显式关闭；账号切换不能让进行中的任务串用连接。

### 6.2 适配重点

- 首次连接显示服务器主机指纹，由用户核对并信任后保存；指纹变化时阻止自动连接，不能默默接受。
- 远端路径使用 POSIX 规则，本地 Windows 路径使用本地路径规则，不能直接共用 `path.join`。
- 明确符号链接处理，递归删除不跟随链接进入其他目录；对配置根目录进行规范化和范围检查。
- 私钥文件由主进程读取，UI 显示路径而不回传私钥内容；兼容格式和口令错误需实测。
- 上传可先写入临时文件，完成后再重命名；原子覆盖能力取决于服务器，不能默认所有服务器一致。
- 首期不提供通用公开链接、分享或准确的账号总容量；恢复传输需要检查远端文件状态后再实现。

验收：至少测试 OpenSSH SFTP；覆盖密码/加密私钥、首次信任、主机指纹变化、权限不足、符号链接、中文文件名、断线重连和取消后临时文件处理。

## 7. OneDrive / SharePoint

Microsoft Graph 提供 OneDrive、企业 OneDrive 和 SharePoint 文档库的文件接口，可共享适配器，但账号、租户和权限行为需要分别测试。[文件 API 概览](https://learn.microsoft.com/en-us/graph/api/resources/onedrive?view=graph-rest-1.0)。

### 7.1 授权和配置

新增 `electron/main/onedrive-api.js`，并建立可供 Google Drive 复用的主进程 OAuth 管理模块。桌面端采用系统浏览器授权，设计使用授权码流程与 PKCE；不把桌面应用当作能够保密的服务端客户端。

配置字段：`clientId`、租户/账号类型、账号展示信息、凭据引用、`resourceKind`（个人盘/企业盘/SharePoint）、`driveId`、可选 `siteId`、`rootItemId`。`clientId` 是应用标识，不等于秘密密钥。

注册应用、回调地址及权限范围属于开发前置条件。浏览个人文件、企业文件和发现站点可能需要不同权限，开发时按当前 Graph 文档列出权限用途；不默认申请整个租户的读写权限。企业租户可能限制用户自行授权，界面应显示管理员批准需求。

### 7.2 功能和差异

- 按 `driveId` 和 `itemId` 定位文件，名称和路径仅供展示与导航；重命名不改变业务引用。
- 提供账号登录/退出、选择驱动器或文档库、分页列举、上传下载、建目录、移动和删除。
- 大文件使用上传会话，处理会话到期、恢复位置和限流；按官方要求确定分片尺寸。[上传会话](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/api/driveitem_createuploadsession?view=odsp-graph-online)。
- 下载地址可能是短期有效的授权 URL，不作为永久公开链接保存；分享操作按租户政策开放。
- 删除优先使用平台提供的正常删除语义，界面标明是否可从回收站恢复；不把删除描述成所有场景都可恢复。

验收：个人账号、企业账号、SharePoint 文档库分别测试；覆盖登录取消、令牌刷新/撤销、授权不足、分页、重命名、大文件断点续传、限流、租户禁止外部分享及多账号隔离。

## 8. Google Drive

Google Drive 是用户网盘，Google Cloud Storage 是对象存储，两者不共用桶模型和认证配置。现有 `gcs-api.js` 不能直接用于 Google Drive。[Drive 文件模型](https://developers.google.cn/workspace/drive/api/guides/about-files?hl=en)。

### 8.1 授权和配置

新增 `electron/main/google-drive-api.js`，使用 Google Drive API v3，授权采用系统浏览器中的桌面应用 OAuth 流程。配置字段：桌面 OAuth 应用标识、账号展示信息、凭据引用、`rootFolderId`，以及后续共享云端硬盘需要的 `driveId`。

注册 Google OAuth 应用并配置同意屏幕。PKCE、回调地址、令牌刷新和权限范围按桌面应用流程实现；取消或完成登录后关闭本地回调监听，并验证 `state`。[桌面应用 OAuth](https://developers.google.com/identity/protocols/oauth2/native-app)。

权限范围是开发前必须确定的产品边界：只管理应用创建/用户明确选定的文件，与浏览整个网盘需要的权限不同，不能用较小范围却向用户承诺全盘管理。涉及敏感或受限范围时，需按 Google 当前要求确认验证及发布条件。[OAuth 政策](https://developers.google.com/identity/protocols/oauth2/policies)。

### 8.2 功能和差异

- 按文件 ID 和父目录 ID 操作；同一目录可能存在同名项目，不能以名称作为唯一标识。
- 普通文件支持列举、上传、下载、移动和移入回收站；永久删除不作为首期默认行为。
- Google 文档、表格和演示文稿需要选择导出格式，不能当作普通二进制文件直接下载。
- 大文件使用 resumable upload，会话信息作为敏感数据处理；恢复时查询服务器已接收范围。[上传文件数据](https://developers.google.com/workspace/drive/api/guides/manage-uploads)。
- 第一阶段支持“我的云端硬盘”；“与我共享”、快捷方式、共享云端硬盘和分享权限管理单独声明与验收。

验收：登录取消、令牌刷新/撤销、授权范围边界、分页、同名文件、回收站、Google 文档导出、大文件恢复、限流和多账号隔离；共享云端硬盘支持完成前不标记为可用。

## 9. 开发与回归清单

每新增一个服务按以下顺序交付：

1. 确定首期能力与权限，准备独立测试账号/桶/目录，记录测试服务版本和配置。
2. 实现主进程适配器、配置校验与错误映射，增加类型注册和实例缓存失效逻辑。
3. 接入设置页、连接测试及现有 IPC；渲染进程只接收必要结果，不直接持有长期凭据。
4. 接入文件列表、上传下载、进度和取消；按能力控制分享、移动、统计等功能。
5. 完成上文各服务专项验收，并回归现有 R2 和京东云的关键上传下载路径。
6. 验证 Windows、macOS、Linux 的路径、凭据存储和 OAuth 回调差异；没有实际验证的平台明确标为待测。
7. 更新支持列表、用户配置示例和版本说明。依据项目约定，开发阶段不自行构建应用；实际打包由开发者或已授权的 GitHub Actions 执行。

通用验收还应包括：空目录与空文件、大量目录项、文件名编码、大文件内存占用、连接中断、取消与重试、同名冲突、账号切换、代理设置、配置升级兼容及日志脱敏。容量统计无法从服务准确获取时显示“暂不支持”，不能将当前页大小当作总容量。

## 10. 交付边界

首期聚焦单个服务内部的文件管理，不默认承诺跨云直传、双向同步、后台定时备份、服务端加密配置管理或完整权限管理。后续可在统一适配层上另行设计这些功能，并明确流量路径、冲突策略与失败恢复方式。

本文仅新增开发规划，不创建账号、不配置云资源、不安装 SDK、不修改应用功能，也不触发打包。实施时按阶段逐项完成，再将对应状态更新为“已实现/已验证”。
