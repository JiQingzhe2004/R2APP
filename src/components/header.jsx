import { Bell } from 'lucide-react'

export function Header() {
  return (
    <header className="h-14 flex items-center justify-end gap-4 border-b bg-muted/40 px-6">
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