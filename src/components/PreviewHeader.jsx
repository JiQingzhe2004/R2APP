import React, { useState, useEffect } from 'react';
import { Minus, Square, PictureInPicture2, X, ZoomIn, ZoomOut, RotateCwSquare, Download, QrCode, Copy } from 'lucide-react';
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MorphingMenu } from "@/components/ui/morphing-menu";
import QRCode from 'qrcode';
import { toast } from 'sonner';

export function PreviewHeader({ fileName, isImage = false, onZoomIn, onZoomOut, onRotate, onDownload, publicUrl, onCopy, zoomLevel = 1 }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (publicUrl) {
      QRCode.toDataURL(publicUrl, { width: 200, margin: 1 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
    }
  }, [publicUrl]);

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
        {publicUrl && (
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
                    onClick={() => {
                      navigator.clipboard.writeText(publicUrl)
                        .then(() => toast.success('链接已复制'))
                        .catch(() => toast.error('复制失败'));
                    }}
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    复制链接
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