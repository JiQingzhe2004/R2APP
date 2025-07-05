import { Bell, TextSearch, ServerCog, ServerCrash, ServerOff, ChevronsUpDown } from 'lucide-react'
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function Header({ onSearchClick, r2Status, profiles, activeProfileId, onProfileSwitch }) {
  const location = useLocation();
  const showSearch = location.pathname === '/files';

  const getStatusIcon = () => {
    if (r2Status.loading) {
      return <ServerCog className="h-5 w-5 text-muted-foreground" />;
    }
    if (r2Status.success) {
      return <ServerCrash className="h-5 w-5 text-green-500" />;
    }
    return <ServerOff className="h-5 w-5 text-red-500" />;
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <header className="h-14 flex items-center justify-between border-b bg-muted/40 px-6">
      <div className="flex items-center gap-4">
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
      
      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              {getStatusIcon()}
            </TooltipTrigger>
            <TooltipContent>
              <p>{r2Status.message}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <button className="relative rounded-full h-8 w-8 flex items-center justify-center border hover:bg-accent">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </button>
      </div>
    </header>
  )
} 