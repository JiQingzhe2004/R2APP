import {
  Home,
  File,
  Upload,
  Download,
  Settings,
  Sun,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  PackageOpen,
  FolderUp,
  FolderDown
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from "./theme-provider"
import { cn } from "@/lib/utils"

export function Sidebar({ isCollapsed, onToggle }) {
  const { theme, setTheme } = useTheme()
  const location = useLocation();

  const navItems = [
    { id: 'dashboard', href: '/dashboard', icon: Home, label: '仪表盘' },
    { id: 'files', href: '/files', icon: PackageOpen, label: '文件管理' },
    { id: 'uploads', href: '/uploads', icon: FolderUp, label: '上传文件' },
    { id: 'downloads', href: '#', icon: FolderDown, label: '下载管理', disabled: true },
    { id: 'settings', href: '/settings', icon: Settings, label: '设置' },
  ]

  return (
    <aside className={cn(
      "flex-shrink-0 border-r bg-muted/40 flex flex-col transition-all duration-300 ease-in-out",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className={cn(
        "h-14 flex items-center border-b px-6",
        isCollapsed && "px-0 justify-center"
      )}>
        <h1 className={cn("text-lg font-bold", isCollapsed && "hidden")}>R2存储管理器</h1>
        <h1 className={cn("text-lg font-bold", !isCollapsed && "hidden")}>R2</h1>
      </div>
      <nav className="flex-1 py-4 px-4">
        <ul className="space-y-1 h-full flex flex-col">
          {navItems.map(({ id, href, icon: Icon, label, disabled }) => {
            const isActive = location.pathname === href;
            const isSettings = id === 'settings';
            const liClass = isSettings ? 'mt-auto' : '';

            const linkContent = (
              <>
                <Icon className={cn("h-5 w-5", isCollapsed && "h-6 w-6")} />
                <span className={cn(isCollapsed && "hidden")}>
                  {label}
                  {disabled && ' (待开发)'}
                </span>
              </>
            );

            return (
              <li key={id} className={liClass}>
                {disabled ? (
                  <span
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground opacity-50 cursor-not-allowed",
                      isCollapsed && "justify-center"
                    )}
                  >
                    {linkContent}
                  </span>
                ) : (
                  <Link
                    to={href}
                    title={isCollapsed ? label : ''}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                      isActive && 'bg-primary text-primary-foreground hover:text-primary-foreground',
                      isCollapsed && "justify-center"
                    )}
                  >
                    {linkContent}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t">
        <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground cursor-pointer hover:text-primary transition-all",
              isCollapsed && "justify-center"
            )}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span className={cn(isCollapsed && "hidden")}>{theme === 'dark' ? '深色模式' : '浅色模式'}</span>
        </div>
         <div
            className={cn(
              "mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground cursor-pointer hover:text-primary transition-all",
               isCollapsed && "justify-center"
            )}
            onClick={onToggle}
        >
            {isCollapsed ? <PanelRightClose className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            <span className={cn(isCollapsed && "hidden")}>{isCollapsed ? '展开' : '收起'}</span>
        </div>
      </div>
    </aside>
  )
} 