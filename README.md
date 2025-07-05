# R2 存储资源管理器

一个用于管理 Cloudflare R2 存储桶的现代化、跨平台桌面应用程序。使用 Electron、React 和 Tailwind CSS 构建。

## ✨ 功能特性

-   **现代化的用户界面**: 专业的设计，包含侧边栏，便于导航。
-   **双主题支持**: 同时支持亮色和深色两种配色方案。
-   **文件管理**: 浏览、上传和删除您 R2 存储桶中的文件。
-   **安全配置**: 您的所有凭据都安全地存储在本地计算机上，绝不会上传到云端。
-   **跨平台**: 可在 Windows、macOS 和 Linux 上运行。

## 🚀 开始使用

请按照以下说明在您的本地计算机上设置并运行项目，以进行开发和测试。

### 准备工作

您需要在您的系统上安装 [Node.js](https://nodejs.org/) 及其包管理器 npm。

### ⚙️ 安装

1.  **克隆仓库** (或下载源代码)。
    ```sh
    git clone https://github.com/your-username/r2-desktop-app.git
    cd r2-desktop-app
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
3.  输入您的 Cloudflare R2 详细信息：
    -   **Cloudflare Account ID**: 您可以在 Cloudflare 仪表板的 URL 或 R2 页面上找到。
    -   **R2 Access Key ID**: 您创建的 R2 API 令牌的 ID。
    -   **R2 Secret Access Key**: R2 API 令牌的密钥。
    -   **Bucket Name**: 您想要管理的 R2 存储桶的名称。
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

打包后的应用程序将位于 `dist` 目录下。

---

使用 ❤️ 和 Electron 构建。

```bash
npm run dev