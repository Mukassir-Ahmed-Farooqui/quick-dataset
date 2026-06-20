import { Badge } from '@/components/ui/badge'

interface NavbarProps {
  title?: string
}

export default function Navbar({ title }: NavbarProps) {
  return (
    <header className="h-16 border-b border-hairline bg-canvas px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center">
        <h2 className="text-sm font-medium text-ink">{title || 'Dashboard'}</h2>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
          Dataset Factory
        </Badge>
        <div className="w-8 h-8 rounded-full bg-stone flex items-center justify-center">
          <span className="text-xs font-medium text-body-muted">U</span>
        </div>
      </div>
    </header>
  )
}
