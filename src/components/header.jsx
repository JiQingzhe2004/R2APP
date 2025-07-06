import { useState, useEffect, useRef } from 'react';
import { Bell, TextSearch, ShieldEllipsis, ShieldCheck, ShieldX, ChevronsUpDown, Minus, Square, X, CheckCircle, XCircle, Trash2, Info } from 'lucide-react'
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from "@/components/ui/Card"
import { Progress } from "@/components/ui/Progress"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  const [activeNotification, setActiveNotification] = useState(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const prevNotificationsRef = useRef();

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
        {profiles && profiles.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-between">
                <span className="truncate">{activeProfile?.name || '选择配置'}</span>
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[180px]">
              {profiles.map(profile => (
                <DropdownMenuItem key={profile.id} onSelect={() => onProfileSwitch(profile.id)} disabled={profile.id === activeProfileId}>
                  {profile.name}
                </DropdownMenuItem>
              ))}
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

        <div className="flex items-center gap-1 pl-2">
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.api.minimizeWindow()}>
              <Minus className="h-4 w-4" />
           </Button>
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.api.maximizeWindow()}>
              <Square className="h-4 w-4" />
           </Button>
           <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/90" onClick={() => window.api.closeWindow()}>
              <X className="h-4 w-4" />
           </Button>
        </div>
      </div>
    </header>
  )
} 