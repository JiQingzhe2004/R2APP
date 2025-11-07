# R2 存储资源管理器

一个用于管理 Cloudflare R2 存储桶的现代化、跨平台桌面应用程序。使用 Electron、React 和 Tailwind CSS 构建。

## ✨ 功能特性

-   **现代化的用户界面**: 专业的设计，包含侧边栏，便于导航。
-   **双主题支持**: 同时支持亮色和深色两种配色方案。
-   **多存储服务支持**: 支持 Cloudflare R2、阿里云 OSS、腾讯云 COS、京东云对象存储、华为云 OBS、七牛云 Kodo、SM.MS 图床、兰空图床等多种存储服务。
-   **文件管理**: 浏览、上传和删除您存储桶中的文件。
-   **安全配置**: 您的所有凭据都安全地存储在本地计算机上，绝不会上传到云端。
-   **跨平台**: 可在 Windows、macOS 和 Linux 上运行。

## 🚀 开始使用

请按照以下说明在您的本地计算机上设置并运行项目，以进行开发和测试。

### 准备工作

您需要在您的系统上安装 [Node.js](https://nodejs.org/) 及其包管理器 npm。

### ⚙️ 安装

1.  **克隆仓库** (或下载源代码)。
    ```sh
    git clone https://gitee.com/jiqingzhe/r2-app.git
    ```

2.  **安装 NPM 依赖包**。
    此命令将下载 `package.json` 中列出的所有必需依赖项。

    ```sh
    npm install
    ```

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

4.  点击 **保存设置**。
5.  导航回 **文件管理** 视图即可查看您存储桶的内容。

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

---

使用 ❤️ 和 Electron 构建。

```bash
npm run dev


git push origin {标签}