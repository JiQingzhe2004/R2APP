import { Search, Bell } from 'lucide-react'

export function Header() {
  return (
    <header className="h-14 flex items-center gap-4 border-b bg-muted/40 px-6">
      <div className="flex-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="搜索文件..."
            className="w-full bg-background shadow-none appearance-none pl-8 md:w-2/3 lg:w-1/3 h-9 rounded-lg border"
          />
        </div>
      </div>
      <button className="relative rounded-full h-8 w-8 flex items-center justify-center border hover:bg-accent">
        <Bell className="h-4 w-4" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      </button>
    </header>
  )
} 