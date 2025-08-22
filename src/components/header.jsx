import { useState, useEffect, useRef } from 'react';
import { Bell, TextSearch, ShieldEllipsis, ShieldCheck, ShieldX, ChevronsUpDown, Minus, Square, X, CheckCircle, XCircle, Trash2, Info, PictureInPicture2, Bot } from 'lucide-react'
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from "@/components/ui/Card"
import { Progress } from "@/components/ui/Progress"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AIConfigManager } from '@/services/ai/aiConfigManager';
import AIIcon from '@/components/ai/AIIcon';

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " 年前";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " 个月前";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " 天前";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " 小时前";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " 分钟前";
  return "刚刚";
}

const NotificationIcon = ({ type }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

export function Header({ 
  onSearchClick, 
  r2Status, 
  profiles, 
  activeProfileId, 
  onProfileSwitch,
  notifications,
  unreadCount,
  onMarkAllRead,
  onClearNotifications,
  onRemoveNotification
}) {
  const location = useLocation();
  const showSearch = location.pathname === '/files';
  const isAIChatPage = location.pathname === '/ai-chat';
  const [activeNotification, setActiveNotification] = useState(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isMaximized, setIsMaximized] = useState(false);
  const prevNotificationsRef = useRef();
  
  // AI配置相关状态
  const [aiConfigs, setAiConfigs] = useState([]);
  const [selectedAIConfig, setSelectedAIConfig] = useState(null);

  // 加载AI配置
  useEffect(() => {
    if (isAIChatPage) {
      const configManager = new AIConfigManager();
      const allConfigs = configManager.getAllConfigs();
      setAiConfigs(allConfigs);
      
      // 自动选择默认配置
      const defaultConfig = allConfigs.find(config => config.isDefault && config.enabled);
      if (defaultConfig) {
        setSelectedAIConfig(defaultConfig);
      } else if (allConfigs.length > 0) {
        setSelectedAIConfig(allConfigs[0]);
      }
    }
  }, [isAIChatPage]);

  useEffect(() => {
    window.api.isWindowMaximized().then(setIsMaximized);
    const cleanup = window.api.onWindowMaximizedStatusChanged(setIsMaximized);
    return cleanup;
  }, []);

  useEffect(() => {
    if (notifications && (!prevNotificationsRef.current || notifications.length > prevNotificationsRef.current.length)) {
      const newest = notifications[0];
      if (newest && newest.id !== activeNotification?.id) {
        setActiveNotification(newest);
      }
    }
    prevNotificationsRef.current = notifications;
  }, [notifications, activeNotification]);

  useEffect(() => {
    if (activeNotification) {
      setIsPopupVisible(true);
      setProgress(100);
      
      const progressInterval = setInterval(() => setProgress(p => p > 0 ? p - 1 : 0), 100);
      const timeout = setTimeout(() => setIsPopupVisible(false), 10000);

      return () => {
          clearInterval(progressInterval);
          clearTimeout(timeout);
      };
    }
  }, [activeNotification]);

  useEffect(() => {
    let unmountTimer;
    if (!isPopupVisible && activeNotification) {
      unmountTimer = setTimeout(() => {
        setActiveNotification(null);
      }, 300);
    }
    return () => clearTimeout(unmountTimer);
  }, [isPopupVisible, activeNotification]);

  const dismissPopup = () => {
    setIsPopupVisible(false);
  };
  
  const handleRemoveAndDismiss = (id) => {
    onRemoveNotification(id);
    dismissPopup();
  };

  const getStatusIcon = () => {
    if (r2Status.loading) {
      return <ShieldEllipsis className="h-5 w-5 text-muted-foreground" />;
    }
    if (r2Status.success) {
      return <ShieldCheck className="h-5 w-5 text-green-500" />;
    }
    return <ShieldX className="h-5 w-5 text-red-500" />;
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  // 处理AI配置切换
  const handleAIConfigSwitch = (configId) => {
    const config = aiConfigs.find(c => c.id === configId);
    setSelectedAIConfig(config);
    
    // 这里可以触发全局状态更新，让AI对话页面知道配置已切换
    // 可以通过事件总线或全局状态管理来实现
    window.dispatchEvent(new CustomEvent('ai-config-changed', { detail: config }));
  };

  return (
    <header 
      className="h-14 flex items-center justify-between border-b bg-muted/40 px-2"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* 根据页面类型显示不同的选择器 */}
        {isAIChatPage ? (
          // AI对话页面：显示AI模型选择器和配置信息
          aiConfigs.length > 0 ? (
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-between">
                    <div className="flex items-center gap-2">
                      {selectedAIConfig && (
                        <AIIcon type={selectedAIConfig.type} className="h-4 w-4" />
                      )}
                      <span className="truncate">
                        {selectedAIConfig?.name || '选择AI模型'}
                      </span>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[180px]">
                  <DropdownMenuLabel>选择AI模型</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={selectedAIConfig?.id} onValueChange={handleAIConfigSwitch}>
                    {aiConfigs.filter(config => config.enabled).map(config => (
                      <DropdownMenuRadioItem key={config.id} value={config.id}>
                        <div className="flex items-center gap-2">
                          <AIIcon type={config.type} className="h-4 w-4" />
                          <span>{config.name}</span>
                          {config.isDefault && (
                            <span className="text-xs text-muted-foreground">(默认)</span>
                          )}
                        </div>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* 模型配置信息 - 放在选择框右边 */}
              {selectedAIConfig && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{selectedAIConfig.model}</span>
                  <span>•</span>
                  <span>温度: {selectedAIConfig.temperature}</span>
                  <span>•</span>
                  <span>最大Token: {selectedAIConfig.maxTokens}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">请先配置AI服务</span>
            </div>
          )
        ) : (
          // 其他页面：显示存储配置选择器
          profiles && profiles.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-between">
                  <span className="truncate">{activeProfile?.name || '选择配置'}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[180px]">
                <DropdownMenuLabel>选择配置</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={activeProfileId} onValueChange={onProfileSwitch}>
                  {profiles.map(profile => (
                    <DropdownMenuRadioItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
        
        {showSearch && (
          <Button variant="outline" onClick={onSearchClick}>
            <TextSearch className="h-4 w-4 mr-2" />
            搜索
          </Button>
        )}
      </div>
      
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* 只在非AI对话页面显示存储连接状态 */}
        {!isAIChatPage && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="p-2">
                {getStatusIcon()}
              </TooltipTrigger>
              <TooltipContent>
                <p>{r2Status.message}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* 通知按钮 */}
        <DropdownMenu onOpenChange={(open) => { if(open) { onMarkAllRead(); dismissPopup(); }}}>
          <DropdownMenuTrigger asChild>
            <button className="relative rounded-full h-8 w-8 flex items-center justify-center border hover:bg-accent">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                 <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex h-full w-full items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{unreadCount}</span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span>通知</span>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClearNotifications(); }} disabled={notifications.length === 0}>
                全部清除
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <DropdownMenuItem disabled>暂无通知</DropdownMenuItem>
            ) : (
              notifications.map(n => (
                <DropdownMenuItem key={n.id} className="flex items-start gap-2" onSelect={(e) => e.preventDefault()}>
                  <NotificationIcon type={n.type} />
                  <div className="flex-1">
                    <p className="text-sm">{n.message}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(n.timestamp)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveNotification(n.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClearNotifications} disabled={notifications.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>清除所有通知</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 通知弹窗 */}
        {activeNotification && (
          <div className={`fixed top-16 right-4 z-50 w-72 transform transition-all duration-300 ease-in-out ${isPopupVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}`}>
            <Card className="p-3 shadow-lg">
              <div className="flex items-start gap-3">
                <NotificationIcon type={activeNotification.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium break-words">{activeNotification.message}</p>
                </div>
                <button onClick={() => handleRemoveAndDismiss(activeNotification.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">
                    <X className="h-4 w-4" />
                </button>
              </div>
              <Progress value={progress} className="h-1 mt-2" />
            </Card>
          </div>
        )}

        {/* 窗口控制按钮 */}
        <div className="flex items-center gap-1 pl-2">
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.api.minimizeWindow()}>
              <Minus className="h-4 w-4" />
           </Button>
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.api.maximizeWindow()}>
              {isMaximized ? <PictureInPicture2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
           </Button>
           <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/90" onClick={() => window.api.closeWindow()}>
              <X className="h-4 w-4" />
           </Button>
        </div>
      </div>
    </header>
  )
} 