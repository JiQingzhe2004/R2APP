import React, { useState, useEffect } from 'react';
import { Minus, Square, PictureInPicture2, X, ZoomIn, ZoomOut, RotateCwSquare, Download, QrCode, Copy } from 'lucide-react';
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MorphingMenu } from "@/components/ui/morphing-menu";
import QRCode from 'qrcode';
import { toast } from 'sonner';
import BlackLogo from '@/assets/BlackLOGO.png';
import WhiteLogo from '@/assets/WhiteLOGO.png';
import { useTheme } from '@/components/theme-provider';

export function PreviewHeader({ fileName, isImage = false, onZoomIn, onZoomOut, onRotate, onDownload, publicUrl, shareUrl, onCopy, zoomLevel = 1 }) {
  const { theme } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const qrUrl = shareUrl || publicUrl;

  const handleDownloadQr = async () => {
    if (!qrUrl) return;
    try {
      const isDark = theme === 'dark';
      const bgColor = isDark ? '#09090b' : '#ffffff';
      const fgColor = isDark ? '#ffffff' : '#000000';
      const textColor = isDark ? '#ffffff' : '#000000';
      const subTextColor = isDark ? '#a1a1aa' : '#666666';
      const logoSrc = isDark ? BlackLogo : WhiteLogo;

      // 生成高分辨率二维码
      const highResQrUrl = await QRCode.toDataURL(qrUrl, { 
        width: 800, 
        margin: 1, 
        errorCorrectionLevel: 'H',
        color: {
          dark: fgColor,
          light: bgColor
        }
      });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = 600;
      const height = 800;
      canvas.width = width;
      canvas.height = height;

      // 绘制背景
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      
      // 加载 Logo
      const logoImg = new Image();
      logoImg.src = logoSrc;
      await new Promise((resolve) => {
           logoImg.onload = resolve;
           logoImg.onerror = resolve; 
      });
      
      // 绘制头部 (Logo + 标题)
      const headerY = 80;
      const logoSize = 60;
      const titleText = "CS-Explorer";
      ctx.font = 'bold 40px sans-serif';
      const titleWidth = ctx.measureText(titleText).width;
      
      // 居中计算
      const gap = 20;
      const totalHeaderWidth = logoSize + gap + titleWidth;
      const startX = (width - totalHeaderWidth) / 2;
      
      ctx.drawImage(logoImg, startX, headerY, logoSize, logoSize);
      
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(titleText, startX + logoSize + gap, headerY + logoSize/2);

      // 绘制二维码
      const qrImg = new Image();
      qrImg.src = highResQrUrl;
      await new Promise(r => qrImg.onload = r);
      
      const qrSize = 400;
      const qrX = (width - qrSize) / 2;
      const qrY = headerY + logoSize + 60;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // 绘制底部文字
      ctx.font = 'normal 24px sans-serif';
      ctx.fillStyle = subTextColor;
      ctx.textAlign = 'center';
      ctx.fillText('扫描二维码下载文件', width / 2, qrY + qrSize + 50);
      
      // 获取下载路径
      let downloadDir = '';
      try {
        const result = await window.api.getSetting('download-path');
        if (result && result.success && result.value) {
          downloadDir = result.value;
        } else {
          const defaultPath = await window.api.getDefaultDownloadPath();
          if (defaultPath && defaultPath.success) {
            downloadDir = defaultPath.path;
          }
        }
      } catch (e) {
        console.error('获取下载路径失败:', e);
      }

      const rawName = qrUrl.split('/').pop() || 'unknown';
      const fileName = `CS-Explorer-${rawName.replace(/\.[^.]+$/, '')}.png`;
      const dataUrl = canvas.toDataURL('image/png');

      if (downloadDir) {
        // 使用 IPC 保存文件
        const saveResult = await window.api.saveBase64Image(downloadDir, fileName, dataUrl);
        if (saveResult && saveResult.success) {
          toast.success(`二维码图片已下载到: ${saveResult.filePath || downloadDir}`);
        } else {
          throw new Error(saveResult.error || '保存失败');
        }
      } else {
        // 降级处理：使用浏览器下载
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
        toast.success('二维码图片已下载');
      }

    } catch (e) {
      console.error(e);
      toast.error('生成二维码图片失败');
    }
  };

  useEffect(() => {
    if (qrUrl) {
      QRCode.toDataURL(qrUrl, { width: 200, margin: 1 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
    }
  }, [qrUrl]);

  useEffect(() => {
    const init = async () => {
      try {
        const maxed = await window.api.isWindowMaximized();
        setIsMaximized(!!maxed);
      } catch {}
    };
    init();
    const remove = window.api.onWindowMaximizedStatusChanged((val) => setIsMaximized(!!val));
    return () => {
      if (typeof remove === 'function') remove();
    };
  }, []);
  const handleMinimize = () => {
    window.api.minimizeWindow();
  };

  const handleMaximize = () => {
    window.api.maximizeWindow();
  };

  const handleClose = () => {
    window.api.closeWindow();
  };

  return (
    <header className="flex items-center h-14 bg-background/80 backdrop-blur-sm border-b relative z-50 px-2" style={{ WebkitAppRegion: 'drag' }}>
      {/* 左侧：标题 - 限制宽度避免与功能按钮重叠 */}
      <div className="text-sm truncate min-w-0 max-w-[calc(50%-120px)]">{fileName}</div>

      {/* 中间：功能按钮（下载/复制/旋转）- 绝对居中 */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 z-10" style={{ WebkitAppRegion: 'no-drag' }}>
        <TooltipProvider delayDuration={0}>
          {onDownload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={onDownload}>
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载</TooltipContent>
            </Tooltip>
          )}
          {onCopy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={onCopy}>
                  <Copy className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制</TooltipContent>
            </Tooltip>
          )}
          {isImage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={onRotate}>
                  <RotateCwSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>旋转</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>

      {/* 右侧：分享和窗口控制按钮 */}
      <div className="flex items-center flex-shrink-0 ml-auto" style={{ WebkitAppRegion: 'no-drag' }}>
        {qrUrl && (
             <MorphingMenu
               className="w-8 h-8 z-50 mr-2"
               triggerClassName="w-8 h-8 rounded-full border-none hover:bg-accent hover:text-accent-foreground p-0 bg-transparent"
               contentClassName=""
               direction="bottom-end"
               collapsedRadius="50%"
               expandedRadius="24px"
               expandedWidth={260}
               trigger={
                 <div className="flex w-full h-full items-center justify-center">
                   <QrCode className="w-4 h-4" />
                 </div>
               }
             >
               <div className="flex flex-col items-center gap-4 p-4">
                  <div className="text-sm font-medium w-full text-center border-b pb-2">扫码分享文件</div>
                  <div className="bg-white p-2 rounded-lg">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40" />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-muted-foreground text-xs">生成中...</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-center px-2">
                    使用微信或浏览器扫描二维码<br/>链接有效期约 15 分钟
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="w-full rounded-full"
                    onClick={handleDownloadQr}
                  >
                    <Download className="w-3 h-3 mr-2" />
                    下载二维码
                  </Button>
               </div>
             </MorphingMenu>
          )}
        <div className="w-px h-4 bg-border mx-1 mr-2" />
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={handleMinimize}>
          <Minus className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={handleMaximize}>
          {isMaximized ? (
            <PictureInPicture2 className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-red-500" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
} 