import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"
import { Progress } from "@/components/ui/Progress"
import { useUpdate } from '@/contexts/UpdateContext';
import { Download, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2, BadgeInfo, HardDriveDownload, ScrollText, X, Info } from 'lucide-react'
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
    quitAndInstallUpdate,
    lastCheckedTime
  } = useUpdate();
  
  const renderStatus = () => {
    switch (status) {
      case 'checking':
        return <div className="flex items-center gap-2 text-blue-500"><Loader2 className="h-5 w-5 animate-spin" />正在检查更新...</div>;
      case 'downloading':
        return (
          <div className="w-full">
            <p className="text-sm text-muted-foreground mb-2">正在下载更新... ({progressInfo.percent.toFixed(1)}%)</p>
            <Progress value={progressInfo.percent} className="w-full" />
          </div>
        );
      case 'available':
        return (
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 text-orange-500">
              <HardDriveDownload className="h-5 w-5" />
              发现新版本 {updateInfo?.version}
            </div>
            {updateInfo?.releaseNotes && (
              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium mb-1">更新内容：</div>
                    <div className="text-xs leading-relaxed">{updateInfo.releaseNotes}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'downloaded':
        return (
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-5 w-5" />
              更新已下载完成
            </div>
            <div className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/20 p-3 rounded-md">
              新版本 {updateInfo?.version} 已准备就绪，点击下方按钮重启应用并安装更新。
            </div>
          </div>
        );
      case 'not-available':
        return (
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-5 w-5" />
              您已经是最新版本
            </div>
            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md">
              当前版本 v{versionData.version} 是最新版本，无需更新。
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              更新检查失败
            </div>
            <div className="text-sm text-muted-foreground bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
              错误信息：{errorInfo?.message || '未知错误'}
            </div>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              欢迎检查更新
            </div>
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
              点击下方按钮检查是否有可用的应用更新。
            </div>
          </div>
        );
    }
  };

  const renderAction = () => {
    switch (status) {
      case 'available':
        return (
          <div className="flex gap-2">
            <Button onClick={downloadUpdate} variant="default" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              下载更新
            </Button>
            <Button onClick={checkForUpdates} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              重新检查
            </Button>
          </div>
        );
      case 'not-available':
      case 'error':
      case 'idle':
        return (
          <Button onClick={checkForUpdates} variant="default" disabled={status === 'checking'} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            {status === 'checking' ? '检查中...' : '检查更新'}
          </Button>
        );
      case 'downloading':
        return (
          <div className="flex gap-2">
            <Button disabled variant="secondary" className="flex-1">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              下载中... ({progressInfo.percent.toFixed(1)}%)
            </Button>
            <Button onClick={checkForUpdates} variant="outline" disabled>
              <X className="mr-2 h-4 w-4" />
              等待完成
            </Button>
          </div>
        );
      case 'downloaded':
        return (
          <div className="flex gap-2">
            <Button onClick={quitAndInstallUpdate} variant="success" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              重启并安装
            </Button>
            <Button onClick={checkForUpdates} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              检查更新
            </Button>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <img
          src={theme === 'dark' ? BlackLogo : WhiteLogo}
          alt="App Logo"
          className="w-20 h-20 mb-2"
          draggable="false"
        />
        <div className="text-lg font-bold">R2 存储管理器</div>
        <div className="text-xs text-muted-foreground">当前版本：v{versionData.version}</div>
      </div>
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle>应用更新</CardTitle>
          <CardDescription>检查并安装应用的最新版本</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg min-h-[80px] flex items-center justify-center">
            {renderStatus()}
          </div>
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              <BadgeInfo className="inline-block mr-1 h-4 w-4" />
              上次检查：{lastCheckedTime ? lastCheckedTime : '未检查'}
            </div>
          </div>
          {renderAction()}
          <div className="flex justify-center">
            <Link to="/releasenotes" className="text-primary text-xs flex items-center gap-1 hover:underline">
              <ScrollText className="h-4 w-4" /> 查看更新日志
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 