import { Outlet, useLocation } from 'react-router-dom'
import AppShell from './AppShell'
import Navbar from './Navbar'

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/projects/new': 'New Project',
  '/providers': 'Providers',
  '/documents': 'Documents',
  '/chunks': 'Chunks',
}

export default function DashboardLayout() {
  const location = useLocation()
  const basePath = '/' + location.pathname.split('/').filter(Boolean).slice(0, 2).join('/')

  // Try exact match first, then fall back to base path
  const title = routeTitles[location.pathname] || routeTitles[basePath] || ''

  return (
    <AppShell>
      <Navbar title={title} />
      <div className="p-8">
        <Outlet />
      </div>
    </AppShell>
  )
}
