import { app, BrowserWindow, nativeImage } from 'electron';
import { join } from 'path';
import fs from 'fs';

let splashWindow = null;
let mainWindowInstance = null;

/**
 * 将图片转换为base64
 */
function imageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = imagePath.split('.').pop().toLowerCase();
    return `data:image/${ext};base64,${base64}`;
  } catch (error) {
    console.warn('无法加载启动图:', error.message);
    return null;
  }
}

/**
 * 创建启动图HTML内容
 */
function createSplashHTML() {
  // 尝试多个可能的图片路径
  let logoBase64 = null;
  
  // 首先尝试开发环境的路径
  const devPath = join(__dirname, '../../src/assets/qidong.png');
  logoBase64 = imageToBase64(devPath);
  
  // 如果开发环境路径失败，尝试打包后的路径
  if (!logoBase64 && app.isPackaged) {
    const prodPath = join(process.resourcesPath, 'qidong.png');
    logoBase64 = imageToBase64(prodPath);
  }
  
  // 如果都失败了，使用一个简单的占位符
  if (!logoBase64) {
    console.warn('无法加载启动图LOGO，使用默认图标');
    const fallbackPath = join(__dirname, '../../src/assets/BlackLOGO.png');
    logoBase64 = imageToBase64(fallbackPath);
  }
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CS-Explorer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            /* 禁止选中文本 */
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            /* 禁止拖动 */
            -webkit-user-drag: none;
            -khtml-user-drag: none;
            -moz-user-drag: none;
            -o-user-drag: none;
            user-drag: none;
        }

        body {
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            color: white;
            opacity: 0;
            animation: fadeIn 0.8s ease-out forwards;
            /* 禁止选中文本 */
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            /* 禁止拖动 */
            -webkit-user-drag: none;
            -khtml-user-drag: none;
            -moz-user-drag: none;
            -o-user-drag: none;
            user-drag: none;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        .splash-container {
            text-align: center;
            /* 禁止选中文本 */
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
        }

        .logo {
            width: 200px;
            border-radius: 20px;
            position: relative;
            animation: logoFloat 3s ease-in-out infinite, logoGlow 2s ease-in-out infinite alternate;
            /* 禁止拖动图片 */
            -webkit-user-drag: none;
            -khtml-user-drag: none;
            -moz-user-drag: none;
            -o-user-drag: none;
            user-drag: none;
            pointer-events: none;
            /* 透明背景，只添加轻微阴影增加层次感 */
            filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2));
        }

        @keyframes logoFloat {
            0%, 100% {
                transform: translateY(0px) rotate(0deg);
            }
            33% {
                transform: translateY(-8px) rotate(2deg);
            }
            66% {
                transform: translateY(4px) rotate(-1deg);
            }
        }

        @keyframes logoGlow {
            0% {
                filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2))
                        drop-shadow(0 0 20px rgba(255, 255, 255, 0.3));
            }
            100% {
                filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2))
                        drop-shadow(0 0 30px rgba(255, 255, 255, 0.5))
                        drop-shadow(0 0 40px rgba(255, 255, 255, 0.2));
            }
        }

        .fade-out {
            animation: fadeOut 0.6s ease-in forwards !important;
        }

        @keyframes fadeOut {
            from {
                opacity: 1;
                transform: scale(1);
            }
            to {
                opacity: 0;
                transform: scale(0.95);
            }
        }
    </style>
</head>
<body>
    <div class="splash-container">
        <img src="${logoBase64 || '../../src/assets/qidong.png'}" alt="CS-Explorer" class="logo">
    </div>
</body>
</html>`;
}

/**
 * 创建启动图窗口
 */
function createSplashWindow() {
  // 创建启动图窗口
  splashWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 400,
    minHeight: 600,
    show: false,
    frame: false,
    transparent: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    }
  });

  // 加载启动图HTML内容
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(createSplashHTML())}`);

  // 窗口准备好后显示
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  // 防止用户关闭启动图
  splashWindow.on('close', (e) => {
    e.preventDefault();
  });

  // 窗口关闭时清理资源
  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

/**
 * 显示启动图
 */
function showSplash(mainWindow = null) {
  if (mainWindow) {
    mainWindowInstance = mainWindow; // 保存主窗口实例
  }
  if (!splashWindow) {
    createSplashWindow();
  } else {
    splashWindow.show();
  }
}

/**
 * 隐藏启动图
 */
function hideSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    // 直接执行渐隐动画
    splashWindow.webContents.executeJavaScript(`
      document.body.classList.add('fade-out');
    `);
    
    // 等待渐隐动画完成后隐藏启动图并显示主窗口
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.hide();
        // 启动图关闭后显示主窗口
        if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
          mainWindowInstance.show();
        }
      }
    }, 1000); // 渐隐动画时间
  }
}

/**
 * 销毁启动图窗口
 */
function destroySplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
}

export {
  createSplashWindow,
  showSplash,
  hideSplash,
  destroySplash
};
