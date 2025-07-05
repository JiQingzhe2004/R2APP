import {
  Home,
  File,
  Upload,
  Download,
  Settings,
  Sun,
  Moon
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from "./theme-provider"

export function Sidebar() {
  const { theme, setTheme } = useTheme()
  const location = useLocation();

  const navItems = [
    { id: 'dashboard', href: '/dashboard', icon: Home, label: '仪表盘' },
    { id: 'files', href: '/files', icon: File, label: '文件管理' },
    { id: 'uploads', href: '/uploads', icon: Upload, label: '上传文件' },
    { id: 'downloads', href: '#', icon: Download, label: '下载管理', disabled: true },
    { id: 'settings', href: '/settings', icon: Settings, label: '设置' },
  ]

  return (
    <aside className="w-64 flex-shrink-0 border-r bg-muted/40 flex flex-col">
      <div className="h-14 flex items-center border-b px-6">
        <h1 className="text-lg font-bold">R2存储管理器</h1>
      </div>
      <nav className="flex-1 py-4 px-4">
        <ul className="space-y-1">
          {navItems.map(({ id, href, icon: Icon, label, disabled }) => {
            const isActive = location.pathname === href;
            // Find settings and add a margin-top to it to push it to the bottom.
            const isSettings = id === 'settings';
            const liClass = isSettings ? 'mt-auto' : '';

            const linkContent = (
              <>
                <Icon className="h-4 w-4" />
                <span>
                  {label}
                  {disabled && ' (待开发)'}
                </span>
              </>
            );

            return (
              <li key={id} className={liClass}>
                {disabled ? (
                  <span
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground opacity-50 cursor-not-allowed`}
                  >
                    {linkContent}
                  </span>
                ) : (
                  <Link
                    to={href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                      isActive ? 'bg-primary text-primary-foreground hover:text-primary-foreground' : ''
                    }`}
                  >
                    {linkContent}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4">
        <div 
            className="flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-muted-foreground cursor-pointer hover:text-primary transition-all"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{theme === 'dark' ? '深色模式' : '浅色模式'}</span>
        </div>
      </div>
    </aside>
  )
} 