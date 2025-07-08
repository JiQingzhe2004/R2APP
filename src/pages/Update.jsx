import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"
import { Progress } from "@/components/ui/Progress"
import { useUpdate } from '@/contexts/UpdateContext';
import { Download, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2, BadgeInfo, HardDriveDownload, ScrollText } from 'lucide-react'
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
        return <div className="flex items-center gap-2 text-orange-500"><HardDriveDownload className="h-5 w-5" />发现新版本 {updateInfo?.version}，可以下载。</div>;
      case 'downloaded':
        return <div className="flex items-center gap-2 text-green-500"><CheckCircle className="h-5 w-5" />更新已下载，可以重启安装。</div>;
      case 'not-available':
        return <div className="flex items-center gap-2 text-green-500"><CheckCircle className="h-5 w-5" />您已经是最新版本。</div>;
      case 'error':
        return <div className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" />更新出错: {errorInfo?.message}</div>;
      case 'idle':
      default:
        return <div className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-5 w-5" />欢迎检查更新。</div>;
    }
  };

  const renderAction = () => {
    switch (status) {
      case 'available':
        return (
          <div className="flex gap-2">
            <Button onClick={checkForUpdates} variant="outline" disabled={status === 'checking'}><RefreshCw className="mr-2 h-4 w-4" />重新检查</Button>
            <Button onClick={downloadUpdate} variant="default"><Download className="mr-2 h-4 w-4" />下载更新</Button>
          </div>
        );
      case 'not-available':
      case 'error':
      case 'idle':
        return <Button onClick={checkForUpdates} variant="default" disabled={status === 'checking'}><RefreshCw className="mr-2 h-4 w-4" />检查更新</Button>;
      case 'downloading':
        return <Button disabled variant="secondary"><Loader2 className="mr-2 h-4 w-4 animate-spin" />下载中...</Button>;
      case 'downloaded':
        return <Button onClick={quitAndInstallUpdate} variant="success"><Download className="mr-2 h-4 w-4" />重启并安装</Button>;
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
          <CardDescription>检查并安装应用的最新版本。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg min-h-[60px] flex items-center justify-center">
            {renderStatus()}
          </div>
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              <BadgeInfo className="inline-block mr-1 h-4 w-4" />
              上次检查：{lastCheckedTime ? lastCheckedTime : '未检查'}
            </div>
            {renderAction()}
          </div>
          <div className="flex justify-end">
            <Link to="/releasenotes" className="text-primary text-xs flex items-center gap-1 hover:underline">
              <ScrollText className="h-4 w-4" /> 查看更新日志
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 