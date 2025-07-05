import { Bell, TextSearch } from 'lucide-react'
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function Header({ onSearchClick }) {
  const location = useLocation();
  const showSearch = location.pathname === '/files';

  return (
    <header className="h-14 flex items-center justify-between border-b bg-muted/40 px-6">
      <div>
        {showSearch && (
          <Button variant="outline" onClick={onSearchClick}>
            <TextSearch className="h-4 w-4 mr-2" />
            搜索
          </Button>
        )}
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