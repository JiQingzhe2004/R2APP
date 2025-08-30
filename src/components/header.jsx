import { useState, useEffect, useRef } from 'react';
import { Bell, TextSearch, ShieldEllipsis, ShieldCheck, ShieldX, ChevronsUpDown, Minus, Square, X, CheckCircle, XCircle, Trash2, Info, PictureInPicture2 } from 'lucide-react'
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

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

  // 定义需要显示存储桶选择的页面
  const showProfileSelector = ['/dashboard', '/files', '/uploads', '/downloads'].includes(location.pathname);
  const [activeNotification, setActiveNotification] = useState(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isMaximized, setIsMaximized] = useState(false);
  const prevNotificationsRef = useRef();

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

  return (
    <header
      className="h-14 flex items-center justify-between border-b bg-muted/40 px-2"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* 只在指定页面显示存储配置选择器 */}
        {showProfileSelector && profiles && profiles.length > 0 && (
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
        )}

        {showSearch && (
          <Button variant="outline" onClick={onSearchClick}>
            <TextSearch className="h-4 w-4 mr-2" />
            搜索
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* 显示存储连接状态 */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger className="p-2">
              {getStatusIcon()}
            </TooltipTrigger>
            <TooltipContent>
              <p>{r2Status.message}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 通知按钮 */}
        <HoverCard openDelay={200} closeDelay={300}>
          <HoverCardTrigger asChild>
            <button
              className="relative rounded-full h-8 w-8 flex items-center justify-center border hover:bg-accent transition-colors"
              onMouseEnter={() => {
                onMarkAllRead();
                dismissPopup();
              }}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-full w-full items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{unreadCount}</span>
                </span>
              )}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80 p-0 shadow-lg dark:shadow-[0_10px_25px_-5px_rgba(255,255,255,0.15)] border-0" align="end" side="bottom" sideOffset={8}>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="font-medium">通知</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearNotifications();
                  }}
                  disabled={notifications.length === 0}
                  className="h-7 px-2 text-xs"
                >
                  全部清除
                </Button>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无通知</p>
                  <p className="text-xs mt-1">新的通知将在这里显示</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto pr-1">
                  {notifications.map((n, index) => (
                    <div key={n.id}>
                      <div
                        className={`group flex items-start gap-3 p-3 rounded-lg transition-all duration-200 ${!n.read ? 'bg-accent/50 border-l-2 border-l-primary' : 'hover:bg-accent/50'
                          }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <NotificationIcon type={n.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm text-left ${!n.read ? 'font-medium' : ''}`}>
                            {n.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {timeAgo(n.timestamp)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveNotification(n.id);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* 添加分隔线，最后一条不添加 */}
                      {index < notifications.length - 1 && (
                        <div className="mx-3 border-t border-border/50"></div>
                      )}
                    </div>
                  ))}
                </div>
              )}


            </div>
          </HoverCardContent>
        </HoverCard>

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
