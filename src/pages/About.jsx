import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card"
import WhiteLogo from '@/assets/WhiteLOGO.png'
import BlackLogo from '@/assets/BlackLOGO.png'
import { Github, GitCommit, UserCircle, Award, ArrowRight } from 'lucide-react'
import { Button } from "@/components/ui/Button"

export default function AboutPage() {
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
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={BlackLogo} alt="Logo" className="h-20 w-20 hidden dark:block" />
            <img src={WhiteLogo} alt="Logo" className="h-20 w-20 dark:hidden" />
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
      <p className="text-xs text-muted-foreground">
        Copyright © {new Date().getFullYear()} {appInfo.author}. All Rights Reserved.
      </p>
    </div>
  )
} 