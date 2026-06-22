import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

interface NavbarProps {
  title?: string
  onMenuToggle?: () => void
}

export default function Navbar({ title, onMenuToggle }: NavbarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [open, setOpen] = useState(false)

  const initials = user?.username?.charAt(0).toUpperCase() || 'U'

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setOpen(false)
    await logout()
    setIsSigningOut(false)
    toast({ title: 'Signed out', description: "You've been signed out successfully." })
    navigate('/login', { replace: true })
  }

  return (
    <header className="h-16 border-b border-hairline bg-canvas/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden text-muted hover:text-ink p-1.5 -ml-1.5 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h2 className="text-sm font-medium text-ink truncate">{title || 'Dashboard'}</h2>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              className="w-8 h-8 rounded-full bg-stone border border-hairline flex items-center justify-center
                hover:bg-stone/80 transition-colors focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2
                text-sm font-medium text-ink"
              aria-label="User menu"
            >
              {initials}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="bg-white rounded-lg border border-hairline shadow-lg p-1.5 min-w-[200px]
                data-[side=bottom]:animate-in data-[side=bottom]:slide-in-from-top-2 z-50"
            >
              <DropdownMenu.Label className="px-2.5 py-1.5 text-xs text-muted">
                {user?.username}
              </DropdownMenu.Label>
              <DropdownMenu.Label className="px-2.5 pb-1.5 text-xs text-muted truncate">
                {user?.email}
              </DropdownMenu.Label>

              <DropdownMenu.Separator className="h-px bg-hairline my-1" />

              <DropdownMenu.Item
                onSelect={() => navigate('/dashboard')}
                className="px-2.5 py-2 text-sm text-ink rounded-md cursor-pointer
                  data-[highlighted]:bg-stone data-[highlighted]:outline-none"
              >
                Dashboard
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  toast({ title: 'Coming soon', description: 'Settings page is under development.' })
                }}
                className="px-2.5 py-2 text-sm text-ink rounded-md cursor-pointer
                  data-[highlighted]:bg-stone data-[highlighted]:outline-none"
              >
                Settings
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-hairline my-1" />

              <DropdownMenu.Item
                onSelect={handleSignOut}
                disabled={isSigningOut}
                className="px-2.5 py-2 text-sm text-error rounded-md cursor-pointer
                  data-[highlighted]:bg-stone data-[highlighted]:outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningOut ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Signing out\u2026
                  </span>
                ) : (
                  'Sign out'
                )}
              </DropdownMenu.Item>

              <DropdownMenu.Arrow className="fill-white" />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
