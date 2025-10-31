import { useMemo } from 'react';
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Progress } from "@/components/ui/Progress"
import { useUpdate } from '@/contexts/UpdateContext';
import { Download, RefreshCw, CheckCircle, XCircle, Loader2, HardDriveDownload, ScrollText, Info, Sparkles, ShieldCheck, Globe } from 'lucide-react'
import WhiteLogo from '@/assets/WhiteLOGO.png';
import BlackLogo from '@/assets/BlackLOGO.png';
import versionData from '@/version.json';
import { Link } from 'react-router-dom';
import { useTheme } from '@/components/theme-provider';

export default function UpdatePage() {
  const { theme } = useTheme();
  const {
    status,
    updateInfo,
    progressInfo,
    errorInfo,
    checkForUpdates,
    downloadUpdate,
    quitAndInstallUpdate
  } = useUpdate();
  
  const logoSrc = theme === 'dark' ? BlackLogo : WhiteLogo;

  const downloadPercent = typeof progressInfo?.percent === 'number' ? progressInfo.percent : 0;

  const formatBytesToMB = (bytes) => {
    if (!bytes || Number.isNaN(bytes)) return null;
    return (bytes / 1024 / 1024).toFixed(2);
  };

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
          description: `更新包正在下载，当前进度 ${downloadPercent.toFixed(1)}%。`,
          extra: (
            <div className="space-y-2">
              <Progress value={downloadPercent} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {formatBytesToMB(progressInfo?.transferred) && formatBytesToMB(progressInfo?.total) && (
                  <span>
                    {formatBytesToMB(progressInfo?.transferred)} MB / {formatBytesToMB(progressInfo?.total)} MB
                  </span>
                )}
              </div>
            </div>
          )
        };
      case 'available':
        return {
          tone: 'warning',
          icon: HardDriveDownload,
          title: `发现新版本 v${updateInfo?.version || ''}`,
          description: '立即下载体验最新功能和优化。',
          extra: updateInfo?.releaseNotes && (
            <div className="rounded-lg border border-amber-200/40 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground dark:border-amber-900/40">
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
          description: `新版本 v${updateInfo?.version || versionData.version} 已下载完成。`,
          extra: (
            <div className="rounded-lg border border-emerald-200/40 bg-emerald-500/5 p-3 text-xs text-muted-foreground dark:border-emerald-900/40">
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
            <div className="rounded-lg border border-red-200/40 bg-red-500/5 p-3 text-xs text-muted-foreground dark:border-red-900/40">
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
            <Button onClick={downloadUpdate} className="w-full sm:flex-1">
              <Download className="mr-2 h-4 w-4" />
              下载更新
            </Button>
            <Button onClick={checkForUpdates} variant="outline" className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              重新检查
            </Button>
          </div>
        );
      case 'downloading':
        return (
          <Button disabled variant="secondary" className="w-full justify-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            下载中... ({downloadPercent.toFixed(1)}%)
          </Button>
        );
      case 'downloaded':
        return (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={quitAndInstallUpdate} className="w-full sm:flex-1" variant="success">
              <Download className="mr-2 h-4 w-4" />
              重启并安装
            </Button>
            <Button onClick={checkForUpdates} variant="outline" className="w-full sm:w-auto">
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
            className="w-full justify-center"
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

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-background/80 shadow-lg ring-1 ring-border">
                <img src={logoSrc} alt="App Logo" className="h-12 w-12" draggable="false" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">更新中心</p>
                <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">保持 CS-Explorer 随时保持最佳状态</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                获取最新的云存储支持、性能优化与安全修复。
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs sm:text-sm">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                    当前版本 v{versionData.version}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-muted-foreground">
                    支持多云存储与网络代理
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardContent className="space-y-6 pt-6">
              <div className={`flex flex-col gap-4 rounded-xl border p-5 transition-colors sm:flex-row sm:items-start ${tone.container}`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${tone.iconWrapper}`}>
                  <StatusIcon className={`h-6 w-6 ${statusDisplay.iconAnimation || ''}`} />
                </div>
                <div className="space-y-3">
                  <div className={`text-lg font-semibold ${tone.title}`}>{statusDisplay.title}</div>
                  {statusDisplay.description && (
                    <p className="text-sm text-muted-foreground">
                      {statusDisplay.description}
                    </p>
                  )}
                  {statusDisplay.extra}
                </div>
              </div>

              {renderAction()}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  更新提示
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary"></span>
                    <span>检查更新后若发现新版本，系统将展示版本号。</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary"></span>
                    <span>如需回顾历史版本变化，可点击菜单内“更新日志”查看。</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  升级小贴士
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Download className="mt-0.5 h-4 w-4 text-primary" />
                    <span>下载期间请保持应用运行，避免中断或切断网络连接。</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
                    <span>更新完成后，重启应用即可体验最新功能与优化。</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 