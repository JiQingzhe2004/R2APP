import { useMemo } from 'react';
import { Button } from "@/components/ui/Button"
import { Progress } from "@/components/ui/Progress"
import { useUpdate } from '@/contexts/UpdateContext';
import { Download, RefreshCw, CheckCircle, XCircle, Loader2, HardDriveDownload, Info, X, Sparkles, Minus } from 'lucide-react'
import versionData from '@/version.json';

export default function UpdatePage() {
  // Check if we are in a standalone update window
  const isUpdateWindow = window.location.hash.includes('/update-window') || window.location.hash.includes('/update');
  
  const handleClose = () => {
    if (window.api && window.api.closeUpdateWindow) {
      window.api.closeUpdateWindow();
    }
  };

  const handleMinimize = () => {
    if (window.api && window.api.minimizeUpdateWindow) {
      window.api.minimizeUpdateWindow();
    }
  };

  const {
    status,
    updateInfo,
    progressInfo,
    errorInfo,
    checkForUpdates,
    downloadUpdate,
    quitAndInstallUpdate
  } = useUpdate();
  
  const downloadPercent = typeof progressInfo?.percent === 'number' ? progressInfo.percent : 0;

  const formatBytes = (bytes, fractionDigits = 2) => {
    if (typeof bytes !== 'number' || !isFinite(bytes) || bytes <= 0) return null;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    const digits = unitIndex === 0 ? 0 : fractionDigits;
    return `${value.toFixed(digits)} ${units[unitIndex]}`;
  };

  const formatSpeed = (bytesPerSecond) => {
    const formatted = formatBytes(bytesPerSecond, 1);
    return formatted ? `${formatted}/s` : null;
  };

  const formatEta = (seconds) => {
    if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return null;
    if (seconds < 60) {
      return `${Math.ceil(seconds)} 秒`;
    }
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} 分钟`;
  };

  const downloadMetrics = useMemo(() => {
    const totalFromProgress = progressInfo?.total && progressInfo.total > 0 ? progressInfo.total : null;

    let totalFromInfo = null;
    if (Array.isArray(updateInfo?.files)) {
      const fileWithSize = updateInfo.files.find(file => typeof file?.size === 'number' && file.size > 0);
      if (fileWithSize?.size) {
        totalFromInfo = fileWithSize.size;
      }
    }
    if (!totalFromInfo && typeof updateInfo?.size === 'number' && updateInfo.size > 0) {
      totalFromInfo = updateInfo.size;
    }

    const totalBytes = totalFromProgress || totalFromInfo || null;
    const transferredBytes = progressInfo?.transferred && progressInfo.transferred > 0
      ? progressInfo.transferred
      : (status === 'downloaded' ? totalBytes : null);
    const bytesPerSecond = progressInfo?.bytesPerSecond && progressInfo.bytesPerSecond > 0
      ? progressInfo.bytesPerSecond
      : null;
    const remainingBytes = totalBytes && transferredBytes ? Math.max(totalBytes - transferredBytes, 0) : null;
    const etaSeconds = remainingBytes && bytesPerSecond ? remainingBytes / bytesPerSecond : null;

    return {
      totalBytes,
      transferredBytes,
      bytesPerSecond,
      etaSeconds,
    };
  }, [progressInfo, updateInfo, status]);

  const formattedTotalSize = formatBytes(downloadMetrics.totalBytes);
  const formattedTransferredSize = formatBytes(downloadMetrics.transferredBytes);
  const formattedSpeed = formatSpeed(downloadMetrics.bytesPerSecond);
  const formattedEta = formatEta(downloadMetrics.etaSeconds);

  const showProgressPanel = status === 'downloading' || status === 'downloaded';

  const tonePalette = {
    info: {
      container: 'border-blue-200/60 dark:border-blue-900/60 bg-blue-500/5',
      iconWrapper: 'bg-blue-500/10 text-blue-500',
      title: 'text-blue-600 dark:text-blue-300'
    },
    success: {
      container: 'border-emerald-200/60 dark:border-emerald-900/60 bg-emerald-500/5',
      iconWrapper: 'bg-emerald-500/10 text-emerald-500',
      title: 'text-emerald-600 dark:text-emerald-300'
    },
    warning: {
      container: 'border-amber-200/60 dark:border-amber-900/60 bg-amber-500/5',
      iconWrapper: 'bg-amber-500/10 text-amber-500',
      title: 'text-amber-600 dark:text-amber-300'
    },
    danger: {
      container: 'border-red-200/60 dark:border-red-900/60 bg-red-500/5',
      iconWrapper: 'bg-red-500/10 text-red-500',
      title: 'text-red-600 dark:text-red-300'
    },
    neutral: {
      container: 'border-border bg-muted/50',
      iconWrapper: 'bg-muted text-muted-foreground',
      title: 'text-foreground'
    }
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'checking':
        return {
          tone: 'info',
          icon: Loader2,
          iconAnimation: 'animate-spin',
          title: '正在检查更新',
          description: '请稍候，系统正在与更新服务同步。'
        };
      case 'downloading':
        return {
          tone: 'info',
          icon: Download,
          title: '正在下载更新',
          description: formattedTotalSize
            ? `更新包正在下载（总大小 ${formattedTotalSize}），当前进度 ${downloadPercent.toFixed(1)}%。`
            : `更新包正在下载，当前进度 ${downloadPercent.toFixed(1)}%。`,
          extra: null
        };
      case 'available':
        return {
          tone: 'warning',
          icon: HardDriveDownload,
          title: `发现新版本 v${updateInfo?.version || ''}`,
          description: '立即下载体验最新功能和优化。',
          extra: updateInfo?.releaseNotes && (
            <div className="rounded-2xl border border-amber-200/40 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground dark:border-amber-900/40">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-500" />
                <div>
                  <div className="font-medium text-foreground">更新内容</div>
                  <div className="mt-1 whitespace-pre-line">{updateInfo.releaseNotes}</div>
                </div>
              </div>
            </div>
          )
        };
      case 'downloaded':
        return {
          tone: 'success',
          icon: CheckCircle,
          title: '更新就绪',
          description: `新版本 v${updateInfo?.version || versionData.version} 已下载完成${formattedTotalSize ? `（${formattedTotalSize}）` : ''}。`,
          extra: (
            <div className="rounded-2xl border border-emerald-200/40 bg-emerald-500/5 p-3 text-xs text-muted-foreground dark:border-emerald-900/40">
              点击“重启并安装”立刻完成升级。
            </div>
          )
        };
      case 'not-available':
        return {
          tone: 'success',
          icon: CheckCircle,
          title: '已是最新版本',
          description: `当前版本 v${versionData.version} 已包含最新功能和修复。`
        };
      case 'error':
        return {
          tone: 'danger',
          icon: XCircle,
          title: '更新检查失败',
          description: '更新服务暂时不可用或网络异常。',
          extra: (
            <div className="rounded-2xl border border-red-200/40 bg-red-500/5 p-3 text-xs text-muted-foreground dark:border-red-900/40">
              错误信息：{errorInfo?.message || '未知错误'}
            </div>
          )
        };
      case 'idle':
      default:
        return {
          tone: 'neutral',
          icon: Sparkles,
          title: '准备好迎接新版本了吗？',
          description: '点击“检查更新”即可获取最新功能、性能优化与安全补丁。'
        };
    }
  };

  const renderAction = () => {
    switch (status) {
      case 'available':
        return (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={downloadUpdate} className="w-full sm:flex-1 rounded-full">
              <Download className="mr-2 h-4 w-4" />
              下载更新
            </Button>
            <Button onClick={checkForUpdates} variant="outline" className="w-full sm:w-auto rounded-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              重新检查
            </Button>
          </div>
        );
      case 'downloading':
        return (
          <Button disabled variant="secondary" className="w-full justify-center rounded-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            下载中... ({downloadPercent.toFixed(1)}%)
          </Button>
        );
      case 'downloaded':
        return (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={quitAndInstallUpdate} className="w-full sm:flex-1 rounded-full" variant="success">
              <Download className="mr-2 h-4 w-4" />
              重启并安装
            </Button>
            <Button onClick={checkForUpdates} variant="outline" className="w-full sm:w-auto rounded-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              再次检查
            </Button>
          </div>
        );
      default:
        return (
          <Button
            onClick={checkForUpdates}
            disabled={status === 'checking'}
            className="w-full justify-center rounded-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${status === 'checking' ? 'animate-spin' : ''}`} />
            {status === 'checking' ? '检查中…' : '检查更新'}
          </Button>
        );
    }
  };

  const statusDisplay = getStatusDisplay();
  const tone = tonePalette[statusDisplay.tone] || tonePalette.neutral;
  const StatusIcon = statusDisplay.icon;

  if (isUpdateWindow) {
    return (
      <div className="h-screen w-screen bg-background relative flex flex-col overflow-hidden" style={{ WebkitAppRegion: 'drag' }}>
        {/* Window Controls */}
        <div className="absolute top-3 right-3 z-50 flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMinimize}
            className="rounded-full hover:bg-muted transition-colors h-8 w-8"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main Content Centered */}
        <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ WebkitAppRegion: 'no-drag' }}>
          <div className="w-full max-w-md space-y-6">
            {/* Status Icon & Title */}
            <div className="flex flex-col items-center text-center gap-4">
               <div className={`flex h-16 w-16 items-center justify-center rounded-full ${tone.iconWrapper} bg-opacity-20`}>
                  <StatusIcon className={`h-8 w-8 ${statusDisplay.iconAnimation || ''}`} />
               </div>
               <div className="space-y-2">
                 <h2 className={`text-xl font-semibold ${tone.title}`}>{statusDisplay.title}</h2>
                 {statusDisplay.description && (
                   <p className="text-sm text-muted-foreground px-4">
                     {statusDisplay.description}
                   </p>
                 )}
               </div>
            </div>

            {/* Release Notes (Simplified) */}
            {status === 'available' && updateInfo?.releaseNotes && (
               <div className="max-h-24 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground custom-scrollbar">
                 <div className="whitespace-pre-line">{updateInfo.releaseNotes}</div>
               </div>
            )}
            
            {/* Progress Bar */}
            {showProgressPanel && (
              <div className="space-y-2">
                 <Progress
                    value={status === 'downloaded' ? 100 : downloadPercent}
                    className="h-2 w-full"
                    indicatorClassName={status === 'downloaded' ? 'bg-emerald-500 animate-none' : 'bg-primary/80'}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{status === 'downloaded' ? '100%' : `${downloadPercent.toFixed(1)}%`}</span>
                    <span>{status === 'downloading' && formattedSpeed ? formattedSpeed : ''}</span>
                  </div>
              </div>
            )}

            {/* Error Message */}
            {status === 'error' && errorInfo && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                 {errorInfo.message || '未知错误'}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2">
              {renderAction()}
            </div>
          </div>
        </div>

        {/* Copyright Footer */}
        <div className="text-center text-[10px] text-muted-foreground/30 pb-3 select-none" style={{ WebkitAppRegion: 'no-drag' }}>
          Copyright © 2025 CS-Explorer
        </div>
      </div>
    );
  }

  return null;
} 