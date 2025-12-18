import { useState, useEffect, useRef } from 'react';
import { Bell, TextSearch, ShieldEllipsis, ShieldCheck, ShieldX, ChevronsUpDown, Minus, Square, X, CheckCircle, XCircle, Trash2, Info, PictureInPicture2, Sun, Moon, Monitor, Palette, Leaf, Cloud, CloudUpload } from 'lucide-react'
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from "@/components/ui/Input"
import { useTheme } from "@/components/theme-provider"
import { useUpdate } from '@/contexts/UpdateContext';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MorphingMenu } from "@/components/ui/morphing-menu"
import { cn } from '@/lib/utils';

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
  isSearchOpen,
  onSearchOpenChange,
  searchTerm,
  onSearch,
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
  const { theme, setTheme } = useTheme();
  const { status } = useUpdate();
  const location = useLocation();
  const showSearch = location.pathname === '/files';
  const [inputValue, setInputValue] = useState(searchTerm || '');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isSearchOpen) {
      setInputValue(searchTerm || '');
    }
  }, [isSearchOpen, searchTerm]);

  useEffect(() => {
    if (isSearchOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
      if (searchInputRef.current.select) {
        searchInputRef.current.select();
      }
    }
  }, [isSearchOpen, showSearch]);

  const handleSearchSubmit = () => {
    onSearch(inputValue);
    // onSearchOpenChange(false); // 不需要收回搜索框
  };

  // 定义需要显示存储桶选择的页面
  const showProfileSelector = ['/dashboard', '/files', '/uploads', '/downloads'].includes(location.pathname);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.api.isWindowMaximized().then(setIsMaximized);
    const cleanup = window.api.onWindowMaximizedStatusChanged(setIsMaximized);
    return cleanup;
  }, []);

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
      className="h-14 flex items-center justify-between border-b bg-muted/40 backdrop-blur-sm px-2 sticky top-0 z-50"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* 只在指定页面显示存储配置选择器 */}
        {showProfileSelector && profiles && profiles.length > 0 && (
          <MorphingMenu
            className="w-[180px] h-9 z-50"
            triggerClassName="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground"
            direction="top-left"
            collapsedRadius="18px"
            expandedRadius="24px"
            expandedWidth={240}
            trigger={
              <div className="flex w-full items-center justify-between px-3 text-sm font-medium">
                <span className="truncate">{activeProfile?.name || '选择配置'}</span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
              </div>
            }
          >
            <div className="flex flex-col p-2 gap-1">
              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                选择配置
              </div>
              <div className="h-px bg-border mx-2 my-1" />
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  onClick={() => onProfileSwitch(profile.id)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                    activeProfileId === profile.id && "bg-accent"
                  )}
                >
                  {activeProfileId === profile.id && (
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                  )}
                  <span className={cn("ml-6", activeProfileId !== profile.id && "ml-6")}>
                    {profile.name}
                  </span>
                </div>
              ))}
            </div>
          </MorphingMenu>
        )}

        {showSearch && (
          <MorphingMenu
            className="w-[100px] h-9 z-40"
            triggerClassName="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground"
            direction="top-left"
            collapsedRadius="18px"
            expandedRadius="24px"
            expandedWidth={320}
            isOpen={isSearchOpen}
            onOpenChange={onSearchOpenChange}
            trigger={
              <div className="flex w-full items-center justify-center px-3 text-sm font-medium">
                <TextSearch className="h-4 w-4 mr-2" />
                <span>搜索</span>
              </div>
            }
          >
            <div className="flex items-center p-0.5 h-full w-full gap-1">
              <Input 
                 ref={searchInputRef}
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                 className="border-none shadow-none focus-visible:ring-0 flex-1 h-full bg-transparent"
                 placeholder="输入文件名或前缀..."
              />
              <Button size="icon" variant="ghost" onClick={handleSearchSubmit} className="rounded-full h-8 w-8 shrink-0">
                <TextSearch className="h-4 w-4" />
              </Button>
            </div>
          </MorphingMenu>
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

        {/* 主题切换 */}
        <MorphingMenu
          className="w-8 h-8 z-50"
          triggerClassName="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
          direction="top-right"
          collapsedRadius="16px"
          expandedRadius="20px"
          expandedWidth={200}
          trigger={
            <>
              {theme === 'light' && <Sun className="h-4 w-4" />}
              {theme === 'dark' && <Moon className="h-4 w-4" />}
              {theme === 'system' && <Monitor className="h-4 w-4" />}
              {theme === 'violet' && <Palette className="h-4 w-4" />}
              {theme === 'green' && <Leaf className="h-4 w-4" />}
              {theme === 'cloud-dancer' && <Cloud className="h-4 w-4" />}
            </>
          }
        >
          <div className="flex flex-col p-2 gap-1">
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              选择主题
            </div>
            <div className="h-px bg-border mx-2 my-1" />
            {[
              { value: 'light', label: '浅色', icon: Sun },
              { value: 'dark', label: '深色', icon: Moon },
              { value: 'violet', label: '紫罗兰', icon: Palette },
              { value: 'green', label: '森林绿', icon: Leaf },
              { value: 'cloud-dancer', label: '云上舞白', icon: Cloud },
              { value: 'system', label: '跟随系统', icon: Monitor }
            ].map(item => (
              <div
                key={item.value}
                onClick={() => setTheme(item.value)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-full px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                  theme === item.value && "bg-accent"
                )}
              >
                {theme === item.value && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                )}
                <item.icon className={cn("ml-6 h-4 w-4 mr-2", theme !== item.value && "ml-6")} />
                <span>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </MorphingMenu>

        {/* 通知按钮 */}
        <MorphingMenu
          className="h-8 w-8 z-50"
          triggerClassName="rounded-full border hover:bg-accent bg-background"
          direction="top-right"
          onOpenChange={(open) => {
            if (open) {
              onMarkAllRead();
            }
          }}
          trigger={
            <>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-full w-full items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{unreadCount}</span>
                </span>
              )}
            </>
          }
        >
          <div className="p-4 h-full flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
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
                className="h-7 px-2 text-xs rounded-full"
              >
                全部清除
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 -mr-2 pr-2 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无通知</p>
                  <p className="text-xs mt-1">新的通知将在这里显示</p>
                </div>
              ) : (
                <div className="space-y-1">
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
          </div>
        </MorphingMenu>


        {/* 更新按钮 */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full border bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8 relative"
          onClick={() => window.api.openUpdateWindow()}
        >
          <CloudUpload className="h-4 w-4" />
          {status === 'available' && (
            <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
          )}
        </Button>

        {/* 窗口控制按钮 */}
        <div className="flex items-center gap-1 pl-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.api.minimizeWindow()}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.api.maximizeWindow()}>
            {isMaximized ? <PictureInPicture2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/90 rounded-full" onClick={() => window.api.closeWindow()}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
