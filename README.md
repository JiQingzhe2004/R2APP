# R2 存储资源管理器

一个用于管理 Cloudflare R2 存储桶的现代化、跨平台桌面应用程序。使用 Electron、React 和 Tailwind CSS 构建。

## ✨ 功能特性

-   **现代化的用户界面**: 专业的设计，包含侧边栏，便于导航。
-   **双主题支持**: 同时支持亮色和深色两种配色方案。
-   **多存储服务支持**: 支持 Cloudflare R2、阿里云 OSS、腾讯云 COS、京东云对象存储、华为云 OBS、七牛云 Kodo、SM.MS 图床、兰空图床等存储服务；并新增通用 S3 兼容存储（Amazon S3 / MinIO / Backblaze B2）、WebDAV（Nextcloud / ownCloud / NAS）、SFTP、OneDrive / SharePoint 与 Google Drive 的接入实现。
-   **文件管理**: 浏览、上传和删除您存储桶中的文件。
-   **凭据加密**: 新增服务的密码、密钥与 OAuth 令牌通过系统加密能力（safeStorage）加密保存在独立的 `credentials.json` 中，配置文件不再包含明文秘密字段。
-   **跨平台**: 可在 Windows、macOS 和 Linux 上运行。

## 🚀 开始使用

存储服务扩展的实现状态与验收清单见 [存储服务对接实施状态](docs/STORAGE_INTEGRATION_STATUS.md)，设计依据见 [存储服务对接规划](docs/STORAGE_INTEGRATION_PLAN.md)。新增的 S3 / WebDAV / SFTP / OneDrive / Google Drive 已完成代码接入；其中 S3 与 WebDAV 已通过本地自动化冒烟测试，SFTP 与两类网盘需要真实服务与账号完成专项验收后才会标记为正式支持。

请按照以下说明在您的本地计算机上设置并运行项目，以进行开发和测试。

### 准备工作

您需要在您的系统上安装 [Node.js](https://nodejs.org/) 及其包管理器 npm。

### ⚙️ 安装

1.  **克隆仓库** (或下载源代码)。
    ```sh
    git clone https://github.com/JiQingzhe2004/R2APP.git
    ```

2.  **安装 NPM 依赖包**。
    此命令将下载 `package.json` 中列出的所有必需依赖项。

    ```sh
    npm install
    ```

## 📦 构建应用

要将应用程序打包为适用于您平台的可执行文件（例如，Windows 的 `.exe`，macOS 的 `.dmg`），您可以使用 `electron-builder`。

运行以下命令来为您当前的操作系统构建应用：

```sh
# 对于 Windows
npm run build:win

# 对于 macOS
npm run build:mac

# 对于 Linux
npm run build:linux
```

打包后的应用程序将位于 `release` 目录下。

### GitHub Actions 自动打包

`.github/workflows/release.yml` 会在 GitHub 上分别打包 Windows 和 macOS，无需在本地构建。

- **手动打包**：在仓库的 **Actions → Release → Run workflow** 选择分支运行。完成后，从该次运行的 **Artifacts** 下载 `CS-Explorer-win-*` 或 `CS-Explorer-mac-*`，保留 14 天。手动运行只生成产物，不发布 Release。
- **标签发布**：将 `package.json` 的版本号更新后，推送与之匹配的 `v版本号` 标签（例如版本为 `5.1.6` 时推送 `v5.1.6`），自动打包并上传到对应的 GitHub Release。electron-builder 默认创建草稿 Release，可检查附件后手动发布。
- **macOS 产物**：同时生成 Intel（`x64`）和 Apple Silicon（`arm64`）的 DMG 安装包、ZIP 包及更新元数据，文件名包含架构，避免相互覆盖。

发布使用 GitHub 自动提供的 `GITHUB_TOKEN`（工作流已声明 `contents: write`），无需配置个人访问令牌，也不依赖仓库中旧的 `GH_TOKEN` Secret。

当前 CI 的 macOS 包未配置 Apple Developer 签名和公证，首次启动可能受到 Gatekeeper 拦截，不应视为已签名的正式发行包。macOS 自动更新还需要有效的应用签名；生成 ZIP 和更新元数据本身并不代表自动更新已经可用。

更新器已禁用差分下载，统一下载完整安装包。NSIS 差分包和 DMG 差分信息也已关闭，Actions 附件不再收集或要求 `.blockmap` 文件。当前 electron-builder 24 仍会为 macOS ZIP 自动生成 `.blockmap`，标签发布时可能上传该辅助文件，但客户端不会使用它进行差分更新。未签名的 macOS 版本应下载 DMG 手动安装；改为全量下载不会解除 macOS 自动安装更新的签名要求。

## ▶️ 运行应用

安装完依赖项后，您可以在开发模式下运行应用程序。

```sh
npm run dev
```

此命令将启动 Electron 应用程序，并带有热重载功能，方便您进行开发。

### 如何配置

1.  启动应用程序。
2.  点击侧边栏中的 **设置** 图标。
3.  选择您要配置的存储服务类型，并输入相应的配置信息：

#### Cloudflare R2 配置
-   **Cloudflare Account ID**: 您可以在 Cloudflare 仪表板的 URL 或 R2 页面上找到。
-   **R2 Access Key ID**: 您创建的 R2 API 令牌的 ID。
-   **R2 Secret Access Key**: R2 API 令牌的密钥。
-   **Bucket Name**: 您想要管理的 R2 存储桶的名称。

#### 京东云对象存储配置
-   **Access Key ID / Secret Access Key**: 在京东云控制台创建的访问密钥对。
-   **Region**: 存储桶所在区域，例如 `cn-north-1`、`cn-east-2`。
-   **Bucket**: 需要管理的京东云 OSS 存储桶名称。
-   **Endpoint (可选)**: 若需访问自定义网关，可设置完整的 S3 兼容 Endpoint，例如 `https://s3.cn-north-1.jdcloud-oss.com`。
-   **自定义域名 (可选)**: 如果已绑定 CDN 或自定义域名，可在此填写以便生成公共访问链接。
-   **私有存储桶**: 勾选后默认使用预签名链接访问对象。

#### 兰空图床配置
-   **兰空图床地址**: 您的兰空图床实例地址，例如 `https://your-lsky-domain.com`
-   **兰空 Token**: 您的兰空图床 API Token，格式为 `Bearer 1|xxxxx`
-   **策略ID** (可选): 指定上传策略的ID
-   **相册ID** (可选): 指定上传到特定相册的ID

#### S3 兼容存储配置（Amazon S3 / MinIO / Backblaze B2）
-   **服务预设**: 选择 Amazon S3、MinIO、Backblaze B2 或自定义，预设仅帮助填写默认参数，可继续修改。
-   **Endpoint**: 兼容服务必填的 API 地址（不是控制台或 CDN 地址）；AWS 可留空由区域解析。
-   **Region**: 按服务文档填写，例如 AWS 的 `us-east-1`；不要沿用 R2 的 `auto`。
-   **Bucket / Access Key / Secret Key**: 直接连接指定桶；密钥保存后会加密存储。
-   **路径风格 (Path Style)**: MinIO 等服务需要勾选。
-   **链接模式**: 临时预签名链接（默认，私有桶可用）或公开链接。
-   **根前缀 (可选)**: 限定界面管理的对象前缀，例如 `photos/2026/`。

#### WebDAV 配置（Nextcloud / ownCloud / NAS）
-   **服务地址**: WebDAV 服务地址而非网页地址。Nextcloud 通常形如 `https://cloud.example.com/remote.php/dav/files/你的用户名/`，以实际部署为准；NAS 需先启用 WebDAV 服务。
-   **用户名 / 密码**: Nextcloud 建议使用账号专用的应用密码。
-   **受信任 CA (可选)**: 自签名证书的 NAS 粘贴 PEM 格式 CA 证书；应用始终校验 TLS，不提供关闭校验的开关。

#### SFTP 配置
-   **主机 / 端口 / 用户名**: 端口默认 22；服务器需已启用 SFTP 子系统。
-   **认证方式**: 密码，或私钥文件路径（支持 `~` 展开，口令可填，私钥只在主进程读取）。
-   **主机指纹**: 首次连接测试会展示服务器 SHA256 指纹，核对后信任保存；指纹变化时应用会阻止连接。

#### OneDrive / SharePoint 配置
-   **Client ID**: 在 Azure 应用注册中创建的桌面应用客户端 ID（公共客户端可使用 PKCE，无需 Secret）。
-   **账号类型 / 资源类型**: 个人账号、企业账号或 SharePoint 文档库（SharePoint 需提供 Site ID）。
-   **登录账号**: 填写 Client ID 后点击登录，在系统浏览器完成授权；企业租户可能需要管理员批准。

#### Google Drive 配置
-   **OAuth Client ID / Client Secret**: 在 Google Cloud 创建"桌面应用"类型 OAuth 客户端获得的凭据。
-   **登录账号**: 点击登录完成浏览器授权；应用会管理"我的云端硬盘"中的文件，Google 文档下载时自动转换为 docx/xlsx/pptx/png。

4.  点击 **保存设置**。
5.  导航回 **文件管理** 视图即可查看您存储桶的内容。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=JiQingzhe2004/R2APP&type=date&legend=top-left)](https://www.star-history.com/#JiQingzhe2004/R2APP&type=date&legend=top-left)


---

使用 ❤️ 和 Electron 构建。

```bash


git push origin {标签}
