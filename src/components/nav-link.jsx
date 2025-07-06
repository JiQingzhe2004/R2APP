import { Link } from 'react-router-dom';
import { cn } from "@/lib/utils"

export function NavLink({ href, icon: Icon, label, isActive, isCollapsed }) {
  return (
    <li className="px-3">
      <Link
        to={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
          {
            "text-primary bg-muted": isActive,
            "justify-center": isCollapsed,
          }
        )}
      >
        <Icon className="h-5 w-5" />
        <span className={cn("truncate", { "hidden": isCollapsed })}>{label}</span>
      </Link>
    </li>
  );
} 