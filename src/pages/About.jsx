import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card"
import WhiteLogo from '@/assets/WhiteLOGO.png'
import BlackLogo from '@/assets/BlackLOGO.png'
import WechatQR from '@/assets/wxzf.png'
import AlipayQR from '@/assets/zfb.png'
import { Github, GitCommit, UserCircle, Award, BadgeCheck, Atom, ExternalLink, Heart, Coffee, X, Calendar, Database } from 'lucide-react'
import { Tiktok, MaillOne} from '@icon-park/react'
import { useTheme } from '@/components/theme-provider';
import versionData from '@/version.json';
import CloudflareIcon from '@/assets/cloudico/Cloudflare.svg';
import AliyunIcon from '@/assets/cloudico/阿里云.svg';
import TencentIcon from '@/assets/cloudico/腾讯云.svg';
import JDCloudIcon from '@/assets/cloudico/京东云.svg';
import HuaweiIcon from '@/assets/cloudico/华为云.svg';
import QiniuIcon from '@/assets/cloudico/七牛云.svg';
import GiteeIcon from '@/assets/cloudico/GITEE.svg';
import GoogleCloudIcon from '@/assets/cloudico/谷歌云.svg';
import SmmsIcon from '@/assets/cloudico/smms.app.png';
import LskyIcon from '@/assets/cloudico/lsky.ico';

export default function AboutPage() {
  const { theme } = useTheme();
  const [lightbox, setLightbox] = useState({ isOpen: false, image: null, title: '' });
  const [appInfo, setAppInfo] = useState({
    name: 'CS-Explorer',
    version: '...',
    author: '...',
    description: '正在加载描述信息...',
    license: '...',
    githubUrl: 'https://github.com/JiQingzhe2004/R2APP' // 替换为您的仓库地址
  });
  const [machineInfo, setMachineInfo] = useState({
    machineId: '...',
    installReported: null,
    currentVersion: '...'
  });

  const openLightbox = (image, title) => {
    setLightbox({ isOpen: true, image, title });
  };

  const closeLightbox = () => {
    setLightbox({ isOpen: false, image: null, title: '' });
  };

  useEffect(() => {
    window.api.getAppInfo().then(info => {
      setAppInfo(prev => ({ ...prev, ...info }));
    });
    
    window.api.getMachineId().then(info => {
      setMachineInfo(info);
    });
  }, []);

  // 存储服务配置
  const storageServices = [
    {
      name: 'Cloudflare R2',
      description: '免费 10GB 存储，全球 CDN 加速',
      icon: CloudflareIcon,
      url: 'https://www.cloudflare.com/zh-cn/developer-platform/r2/',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40'
    },
    {
      name: '京东云对象存储',
      description: '兼容 S3 的企业级对象存储服务',
      icon: JDCloudIcon,
      url: 'https://www.jdcloud.com/cn/products/object-storage',
      bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'
    },
    {
      name: '阿里云 OSS',
      description: '稳定可靠的企业级对象存储',
      icon: AliyunIcon,
      url: 'https://www.aliyun.com/product/oss',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40'
    },
    {
      name: '腾讯云 COS',
      description: '高性价比的云端对象存储方案',
      icon: TencentIcon,
      url: 'https://cloud.tencent.com/product/cos',
      bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40'
    },
    {
      name: '华为云 OBS',
      description: '多活架构的企业级云存储',
      icon: HuaweiIcon,
      url: 'https://www.huaweicloud.com/product/obs.html',
      bgColor: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40'
    },
    {
      name: '七牛云 Kodo',
      description: '支持海量数据存储与分发的对象存储',
      icon: QiniuIcon,
      url: 'https://www.qiniu.com/products/kodo',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800/40'
    },
    {
      name: 'Google Cloud Storage',
      description: '谷歌全球分布式对象存储服务',
      icon: GoogleCloudIcon,
      url: 'https://cloud.google.com/storage',
      bgColor: 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800/40'
    },
    {
      name: 'Gitee 仓库存储',
      description: '国内 Git 仓库，轻量对象管理与加速',
      icon: GiteeIcon,
      url: 'https://gitee.com/',
      bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'
    },
    {
      name: 'SM.MS 图床',
      description: '轻量级图片托管服务，支持直链访问',
      icon: SmmsIcon,
      url: 'https://sm.ms/',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40'
    },
    {
      name: '兰空图床',
      description: '多策略支持的自建图床解决方案',
      icon: LskyIcon,
      url: 'https://github.com/lsky-org/lsky-pro',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40'
    }
  ];

  return (
    <div className="p-4 sm:p-6 flex flex-col items-center gap-6 max-w-6xl mx-auto">
    
      {/* 应用信息卡片 */}
      <Card className="w-full rounded-3xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={BlackLogo} alt="App Logo" className="w-32 h-32 hidden dark:block" draggable="false" />
            <img src={WhiteLogo} alt="App Logo" className="w-32 h-32 dark:hidden" draggable="false" />
          </div>
          <CardTitle className="text-3xl font-bold">{appInfo.name}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 px-8 pb-8 text-sm">
           <p className="text-center mb-8 text-muted-foreground">
            {appInfo.description}
          </p>
          <div className="space-y-5">
            {/* 第一行：版本、作者、许可证 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center">
                <GitCommit className="h-5 w-5 mr-4 text-muted-foreground" />
                <span className="w-16 text-muted-foreground">版本</span>
                <span className="font-semibold tracking-wider">v {appInfo.version}</span>
              </div>
              <div className="flex items-center">
                <UserCircle className="h-5 w-5 mr-4 text-muted-foreground" />
                <span className="w-16 text-muted-foreground">作者</span>
                <span className="font-semibold">{appInfo.author}</span>
              </div>
              <div className="flex items-center">
                <Award className="h-5 w-5 mr-4 text-muted-foreground" />
                <span className="w-16 text-muted-foreground">许可证</span>
                <span className="font-semibold">{appInfo.license}</span>
              </div>
            </div>
            
            {/* 第二行：源码、机器码、构建时间 */}
            <div className="grid grid-cols-3 gap-4">
              {appInfo.githubUrl && (
                <div className="flex items-center">
                  <Github className="h-5 w-5 mr-4 text-muted-foreground" />
                  <span className="w-16 text-muted-foreground">源码</span>
                  <a href={appInfo.githubUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                    R2APP
                  </a>
                </div>
              )}
              <div className="flex items-center">
                <Database className="h-5 w-5 mr-4 text-muted-foreground" />
                <span className="w-16 text-muted-foreground">机器码</span>
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded-lg">
                  {machineInfo.machineId}
                </span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-4 text-muted-foreground" />
                <span className="w-16 text-muted-foreground">发布时间</span>
                <span className="font-semibold text-xs">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <hr className="my-4" />
          {/* 社交媒体链接 */}
          <div className="text-center space-y-3 mt-6">
            <p className="text-sm text-muted-foreground">
              关注我的社交媒体
            </p>
            <div className="flex justify-center gap-4">
              {/* 抖音 */}
              <a 
                href="https://v.douyin.com/WZoKGvJil18/ 9@1.com :1pm" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full transition-all duration-300 hover:scale-110 hover:bg-muted"
                title="抖音"
              >
                <Tiktok theme="filled" size="20" fill="currentColor" strokeWidth={1}/>
              </a>

              {/* Github */}
              <a 
                href="https://github.com/JiQingzhe2004" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full transition-all duration-300 hover:scale-110 hover:bg-muted"
                title="Github"
              >
                <Github size="20" fill="currentColor"/>
              </a>

              {/* 邮箱 */}
              <a 
                href="mailto:jqz1215@qq.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-full transition-all duration-300 hover:scale-110 hover:bg-muted"
                title="邮箱"
              >
                <MaillOne theme="outline" size="20" fill="currentColor"/>
              </a>
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              下方有各服务商的快捷通道！
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 打赏支持 */}
      <Card className="w-full rounded-3xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <BadgeCheck className="h-6 w-6 text-red-500" />
            支持开发
          </CardTitle>
          <CardDescription>
            如果这个应用对你有帮助，请考虑支持开发者继续改进
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              开发不易，您的支持是我持续更新的动力！
              任何金额都是对开发者的鼓励和支持 ❤️
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 微信打赏 */}
            <div className="text-center space-y-3">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-3xl">
                <div 
                  className="max-w-32 mx-auto rounded-2xl overflow-hidden border-2 border-green-200 dark:border-green-800 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => openLightbox(WechatQR, '微信打赏二维码')}
                >
                  <img 
                    src={WechatQR} 
                    alt="微信打赏二维码" 
                    className="w-full h-auto object-contain"
                    draggable="false"
                  />
                </div>
              </div>
              <div className="text-sm font-medium text-green-600 dark:text-green-400">微信打赏</div>
            </div>

            {/* 支付宝打赏 */}
            <div className="text-center space-y-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-3xl">
                <div 
                  className="max-w-32 mx-auto rounded-2xl overflow-hidden border-2 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => openLightbox(AlipayQR, '支付宝打赏二维码')}
                >
                  <img 
                    src={AlipayQR} 
                    alt="支付宝打赏二维码" 
                    className="w-full h-auto object-contain"
                    draggable="false"
                  />
                </div>
              </div>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">支付宝打赏</div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              扫描上方二维码即可快速打赏支持，点击查看大图！
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 存储服务快捷通道 */}
      <Card className="w-full rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Atom className="h-6 w-6" />
            存储服务快捷通道
          </CardTitle>
          <CardDescription>
            快速访问各大存储服务提供商，创建和管理您的存储配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storageServices.map((service, index) => (
              <div
                key={index}
                className={`p-4 rounded-2xl border transition-all hover:shadow-md cursor-pointer ${service.bgColor || ''}`}
                onClick={() => window.open(service.url, '_blank')}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white dark:bg-gray-900/70 shadow-sm">
                    {typeof service.icon === 'string' ? (
                      <img src={service.icon} alt={service.name} className="h-6 w-6 object-contain" draggable="false" />
                    ) : (
                      <service.icon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">{service.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{service.description}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 底部信息 */}
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

      {/* 灯箱组件 */}
      {lightbox.isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={closeLightbox}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2 bg-white/10 hover:bg-white/20 rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-2xl">
              <h3 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-gray-100">
                {lightbox.title}
              </h3>
              <div className="flex justify-center">
                <img 
                  src={lightbox.image} 
                  alt={lightbox.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-2xl"
                  draggable="false"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 