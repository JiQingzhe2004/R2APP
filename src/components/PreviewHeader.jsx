import React, { useState, useEffect } from 'react';
import { Minus, Square, PictureInPicture2, X, ZoomIn, ZoomOut, RotateCwSquare, Download, Share2, Copy } from 'lucide-react';
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function PreviewHeader({ fileName, isImage = false, onZoomIn, onZoomOut, onRotate, onDownload, onShare, onCopy }) {
  const [isMaximized, setIsMaximized] = useState(false);

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
    <header className="flex items-center h-10 bg-background border-b relative z-50" style={{ WebkitAppRegion: 'drag' }}>
      {/* 左侧：标题 */}
      <div className="px-2 text-sm truncate flex-1 min-w-0">{fileName}</div>

      {/* 中间：功能按钮（分享/下载/图片工具）- 绝对居中 */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 z-10" style={{ WebkitAppRegion: 'no-drag' }}>
        <TooltipProvider delayDuration={0}>
          {onShare && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md" onClick={onShare}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>分享</TooltipContent>
            </Tooltip>
          )}
          {onDownload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md" onClick={onDownload}>
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载</TooltipContent>
            </Tooltip>
          )}
          {onCopy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md" onClick={onCopy}>
                  <Copy className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制</TooltipContent>
            </Tooltip>
          )}
          {isImage && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md" onClick={onZoomOut}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>缩小</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md" onClick={onZoomIn}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>放大</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md" onClick={onRotate}>
                    <RotateCwSquare className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>旋转</TooltipContent>
              </Tooltip>
            </>
          )}
        </TooltipProvider>
      </div>

      {/* 右侧：窗口控制按钮 */}
      <div className="flex items-center flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <Button variant="ghost" size="icon" className="w-8 h-10 rounded-none" onClick={handleMinimize}>
          <Minus className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-10 rounded-none" onClick={handleMaximize}>
          {isMaximized ? (
            <PictureInPicture2 className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-10 rounded-none hover:bg-red-500" onClick={handleClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
} 