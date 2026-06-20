import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FolderOpen,
  Plug,
  FileText,
  Layers,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Projects', icon: FolderOpen, to: '/projects' },
  { label: 'Providers', icon: Plug, to: '/providers' },
  { label: 'Documents', icon: FileText, to: '/projects' },
  { label: 'Chunks', icon: Layers, to: '/projects' },
]

export default function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 border-r border-hairline bg-canvas flex flex-col h-full">
      {/* Logo area */}
      <div className="h-16 border-b border-hairline px-6 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-deep flex items-center justify-center">
            <span className="text-white text-xs font-mono font-medium">DF</span>
          </div>
          <span className="text-sm font-medium text-ink tracking-tight">Dataset Factory</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-pale-blue text-action font-medium'
                  : 'text-body-muted hover:text-ink hover:bg-stone',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Version label */}
      <div className="p-4 border-t border-hairline">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Dataset Factory v0.1
        </span>
      </div>
    </aside>
  )
}
