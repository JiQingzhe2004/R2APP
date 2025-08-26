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
        }

        .logo {
            width: 200px;
            margin-bottom: 30px;
            border-radius: 20px;
            position: relative;
            animation: logoGlow 2s ease-in-out infinite alternate;
        }

        .logo::before {
            content: '';
            position: absolute;
            top: -3px;
            left: -3px;
            right: -3px;
            bottom: -3px;
            border-radius: 23px;
            background: linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ff00, #ff0000, #0000ff);
            background-size: 400% 400%;
            animation: borderGlow 3s ease-in-out infinite;
            z-index: -1;
            filter: blur(2px);
        }

        @keyframes logoGlow {
            0% {
                filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.5)) 
                        drop-shadow(0 0 10px rgba(255, 0, 255, 0.3));
            }
            100% {
                filter: drop-shadow(0 0 15px rgba(0, 255, 255, 0.8)) 
                        drop-shadow(0 0 25px rgba(255, 0, 255, 0.6))
                        drop-shadow(0 0 35px rgba(255, 255, 0, 0.4));
            }
        }

        @keyframes borderGlow {
            0% {
                background-position: 0% 50%;
                opacity: 0.7;
            }
            50% {
                background-position: 100% 50%;
                opacity: 1;
            }
            100% {
                background-position: 0% 50%;
                opacity: 0.7;
            }
        }



        .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
        }

        .loading-dot {
            width: 10px;
            height: 10px;
            background-color: white;
            border-radius: 50%;
            animation: loadingBounce 1.6s ease-in-out infinite both;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .loading-dot:nth-child(2) { animation-delay: -0.16s; }
        .loading-dot:nth-child(3) { animation-delay: 0s; }

        .loading-text {
            font-size: 16px;
            font-weight: 500;
            margin-top: 20px;
            color: rgba(255, 255, 255, 0.8);
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            animation: textGlow 2s ease-in-out infinite alternate;
        }

        @keyframes loadingBounce {
            0%, 80%, 100% {
                transform: scale(0.8);
                opacity: 0.5;
            }
            40% {
                transform: scale(1);
                opacity: 1;
            }
        }

        @keyframes textGlow {
            0% {
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            100% {
                text-shadow: 0 2px 8px rgba(255,255,255,0.5), 0 4px 12px rgba(0,255,255,0.3);
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
        <div class="loading-container">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
        <div class="loading-text">应用加载中，请稍后</div>
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
    height: 400,
    minWidth: 400,
    minHeight: 400,
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
