import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card"
import WhiteLogo from '@/assets/WhiteLOGO.png'
import BlackLogo from '@/assets/BlackLOGO.png'
import { Github, GitCommit, UserCircle, Award, ArrowRight, Download, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/Button"
import { useTheme } from '@/components/theme-provider';
import { Progress } from "@/components/ui/Progress"
import { useUpdate } from '@/contexts/UpdateContext';
import versionData from '@/version.json';

function UpdateManager() {
  const {
    status,
    updateInfo,
    progressInfo,
    errorInfo,
    checkForUpdates,
    downloadUpdate,
    quitAndInstallUpdate
  } = useUpdate();
  
  const renderStatus = () => {
    switch (status) {
      case 'checking':
        return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />正在检查更新...</div>;
      case 'downloading':
        return (
          <div className="w-full">
            <p className="text-sm text-muted-foreground mb-2">正在下载更新... ({progressInfo.percent.toFixed(1)}%)</p>
            <Progress value={progressInfo.percent} className="w-full" />
          </div>
        );
      case 'available':
        return <div className="flex items-center gap-2 text-blue-500"><Download className="h-4 w-4" />发现新版本 {updateInfo?.version}，可以开始下载。</div>;
      case 'downloaded':
        return <div className="flex items-center gap-2 text-green-500"><CheckCircle className="h-4 w-4" />更新已下载，可以重启安装。</div>;
      case 'not-available':
        return <div className="flex items-center gap-2 text-muted-foreground"><CheckCircle className="h-4 w-4" />您已经是最新版本。</div>;
      case 'error':
        return <div className="flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" />更新出错: {errorInfo?.message}</div>;
      case 'idle':
      default:
        return <div className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4" />欢迎检查更新。</div>;
    }
  };

  const renderAction = () => {
    switch (status) {
      case 'available':
        return (
          <div className="flex gap-2">
            <Button onClick={checkForUpdates} variant="outline" disabled={status === 'checking'}><RefreshCw className="mr-2 h-4 w-4" />重新检查</Button>
            <Button onClick={downloadUpdate}><Download className="mr-2 h-4 w-4" />下载更新</Button>
          </div>
        );
      case 'not-available':
      case 'error':
      case 'idle':
        return <Button onClick={checkForUpdates} disabled={status === 'checking'}><RefreshCw className="mr-2 h-4 w-4" />检查更新</Button>;
      case 'downloading':
        return <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" />下载中...</Button>;
      case 'downloaded':
        return <Button onClick={quitAndInstallUpdate}><Download className="mr-2 h-4 w-4" />重启并安装</Button>;
      default:
        return null;
    }
  }

  return (
    <Card className="w-full max-w-2xl mt-4">
      <CardHeader>
        <CardTitle>应用更新</CardTitle>
        <CardDescription>检查并安装应用的最新版本。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg min-h-[60px] flex items-center justify-center">
          {renderStatus()}
        </div>
        <div className="flex justify-end">
          {renderAction()}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AboutPage() {
  const { theme } = useTheme();
  const [appInfo, setAppInfo] = useState({
    name: 'R2 存储管理器',
    version: '...',
    author: '...',
    description: '正在加载描述信息...',
    license: '...',
    githubUrl: 'https://github.com/JiQingzhe2004/R2APP' // 替换为您的仓库地址
  });

  useEffect(() => {
    window.api.getAppInfo().then(info => {
      setAppInfo(prev => ({ ...prev, ...info }));
    });
  }, []);

  return (
    <div className="p-4 sm:p-6 flex flex-col items-center gap-4">
      <UpdateManager />
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={BlackLogo} alt="App Logo" className="w-32 h-32 hidden dark:block" />
            <img src={WhiteLogo} alt="App Logo" className="w-32 h-32 dark:hidden" />
          </div>
          <CardTitle className="text-3xl font-bold">{appInfo.name}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 px-8 pb-8 text-sm">
           <p className="text-center mb-8 text-muted-foreground">
            {appInfo.description}
          </p>
          <div className="space-y-5">
            <div className="flex items-center">
              <GitCommit className="h-5 w-5 mr-4 text-muted-foreground" />
              <span className="w-20 text-muted-foreground">版本</span>
              <span className="font-semibold tracking-wider">v {appInfo.version}</span>
            </div>
            <div className="flex items-center">
              <UserCircle className="h-5 w-5 mr-4 text-muted-foreground" />
              <span className="w-20 text-muted-foreground">作者</span>
              <span className="font-semibold">{appInfo.author}</span>
            </div>
            <div className="flex items-center">
              <Award className="h-5 w-5 mr-4 text-muted-foreground" />
              <span className="w-20 text-muted-foreground">许可证</span>
              <span className="font-semibold">{appInfo.license}</span>
            </div>
            {appInfo.githubUrl && (
               <div className="flex items-center">
                <Github className="h-5 w-5 mr-4 text-muted-foreground" />
                <span className="w-20 text-muted-foreground">源码</span>
                <a href={appInfo.githubUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                  R2APP
                </a>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <div className="w-full bg-muted/40 p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-3">还没有 Cloudflare R2 存储桶？</p>
            <Button 
              className="w-full" 
              onClick={() => window.open('https://www.cloudflare.com/zh-cn/developer-platform/r2/', '_blank')}
            >
              免费获取 Cloudflare R2 存储
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
      <div className="text-center mt-6 text-xs text-muted-foreground space-y-2">
         <div className="flex items-center justify-center gap-x-4">
            <span>版本: {versionData.version}</span>
            <div className="h-3 w-px bg-border" />
            <a 
              href={appInfo.githubUrl ? `${appInfo.githubUrl}/issues` : "#"}
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Github size={12} />
              <span>提交 Issue</span>
            </a>
        </div>
        <p>
          Copyright © {new Date().getFullYear()} {appInfo.author}. All Rights Reserved.
        </p>
      </div>
    </div>
  )
} 