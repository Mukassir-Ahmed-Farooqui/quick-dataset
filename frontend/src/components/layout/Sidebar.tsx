import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FolderOpen,
  Plug,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/animations'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Projects', icon: FolderOpen, to: '/projects' },
  { label: 'Providers', icon: Plug, to: '/providers' },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const content = (
    <aside className="w-60 flex-shrink-0 border-r border-hairline bg-canvas flex flex-col h-full">
      {/* Logo area */}
      <div className="h-16 border-b border-hairline px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-deep-green flex items-center justify-center">
            <span className="text-white text-xs font-mono font-medium">QD</span>
          </div>
          <span className="text-sm font-medium text-ink tracking-tight">Quick Dataset</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-muted hover:text-ink p-1">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item, i) => (
          <motion.div key={item.to} variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: i * 0.05 }}>
            <NavLink
              to={item.to}
              onClick={onClose}
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
          </motion.div>
        ))}
      </nav>

      {/* Version label */}
      <div className="p-4 border-t border-hairline">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Quick Dataset v0.1
        </span>
      </div>
    </aside>
  )

  // Mobile overlay
  if (open !== undefined) {
    return (
      <>
        {open && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {content}
        </div>
        {/* Desktop version */}
        <div className="hidden lg:block">{content}</div>
      </>
    )
  }

  return content
}
