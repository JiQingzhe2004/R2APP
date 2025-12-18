import {
  File,
  Settings,
  PanelLeftClose,
  PanelRightClose,
  LayoutDashboard,
  UploadCloud,
  BadgeInfo,
  CloudDownload,
  Bell
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from "@/lib/utils"
import WhiteLogo from '@/assets/WhiteLOGO.png'
import BlackLogo from '@/assets/BlackLOGO.png'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState, useEffect } from 'react'

export function Sidebar({ isCollapsed, onToggle }) {
  const location = useLocation();
  const isActive = (path) => location.pathname.startsWith(path);


  const navItems = [
    { id: 'dashboard', href: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
    { id: 'files', href: '/files', icon: File, label: '文件管理' },
    { id: 'uploads', href: '/uploads', icon: UploadCloud, label: '文件上传' },
    { id: 'downloads', href: '/downloads', icon: CloudDownload, label: '文件下载' },
    { id: 'announcements', href: '/announcements', icon: Bell, label: '系统公告' },
    { id: 'settings', href: '/settings', icon: Settings, label: '系统设置' },

    { id: 'about', href: '/about', icon: BadgeInfo, label: '关于应用' },
  ]

  return (
    <TooltipProvider delayDuration={0}>
    <aside className={cn(
      "flex-shrink-0 border-r bg-muted/40 flex flex-col transition-all duration-300 ease-in-out",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className={cn(
        "h-14 flex items-center border-b transition-all duration-300 ease-in-out gap-2 overflow-hidden",
        isCollapsed ? "pl-7" : "pl-4"
      )}>
          <img src={BlackLogo} alt="Logo" className="h-6 w-6 hidden dark:block" draggable="false" />
          <img src={WhiteLogo} alt="Logo" className="h-6 w-6 dark:hidden" draggable="false" />
          <h1 className={cn(
            "text-lg font-bold select-none whitespace-nowrap overflow-hidden transition-all duration-300",
            isCollapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"
          )}>CS-Explorer</h1>
      </div>
      <nav className="flex-1 py-4 px-4">
        <ul className="space-y-1 h-full flex flex-col">
          {navItems.map(({ id, href, icon: Icon, label, disabled, isWindowOpen, onClick }) => {
            const isActive = href ? location.pathname === href : false;
            
            let liClass = '';
            // Push settings to the bottom, which will pull 'about' with it.
            if (id === 'settings') {
              liClass = 'mt-auto';
            }

            const linkContent = (
              <>
                <Icon className={cn("h-5 w-5 flex-shrink-0 transition-all duration-300 ease-in-out", isCollapsed ? "mr-0" : "mr-3")} />
                <span className={cn(
                  "whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
                  isCollapsed ? "max-w-0 opacity-0 translate-x-[-10px]" : "max-w-[200px] opacity-100 translate-x-0"
                )}>
                  {label}
                  {disabled && ' (待开发)'}
                  {isWindowOpen && (
                    <span className="ml-1 text-xs text-green-500">●</span>
                  )}
                </span>
              </>
            );

            const commonClasses = cn(
              "flex items-center rounded-full transition-all duration-300 ease-in-out select-none h-12 w-full justify-start pl-3.5",
              !isActive && "text-muted-foreground hover:text-primary",
              isActive && 'bg-primary text-primary-foreground hover:text-primary-foreground',
            );

            const linkElement = disabled ? (
                <span
                draggable="false"
                  className={cn(commonClasses, "opacity-50 cursor-not-allowed text-muted-foreground")}
                >
                  {linkContent}
                </span>
              ) : onClick ? (
                <button
                  draggable="false"
                  onClick={onClick}
                  className={commonClasses}
                >
                  {linkContent}
                </button>
              ) : (
                <Link
                  to={href}
                draggable="false"
                  className={commonClasses}
                >
                  {linkContent}
                </Link>
            );

              return (
                <li key={id} className={liClass}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {linkElement}
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">
                        <p>{label}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </li>
              );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
         <div
                  draggable="false"
            className={cn(
              "flex items-center rounded-full transition-all duration-300 ease-in-out select-none h-12 w-full text-muted-foreground cursor-pointer hover:text-primary justify-start pl-3.5"
            )}
            onClick={onToggle}
        >
            {isCollapsed ? 
              <PanelRightClose className={cn("h-5 w-5 flex-shrink-0 transition-all duration-300 ease-in-out", isCollapsed ? "mr-0" : "mr-3")} /> : 
              <PanelLeftClose className={cn("h-5 w-5 flex-shrink-0 transition-all duration-300 ease-in-out", isCollapsed ? "mr-0" : "mr-3")} />
            }
            <span className={cn(
              "whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
              isCollapsed ? "max-w-0 opacity-0 translate-x-[-10px]" : "max-w-[200px] opacity-100 translate-x-0"
            )}>{isCollapsed ? '展开' : '收起'}</span>
        </div>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <p>{isCollapsed ? '展开侧边栏' : '收起侧边栏'}</p>
              </TooltipContent>
            )}
          </Tooltip>
      </div>
    </aside>
    </TooltipProvider>
  )
} 