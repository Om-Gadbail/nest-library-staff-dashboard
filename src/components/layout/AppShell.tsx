import { motion } from 'motion/react'
import * as React from 'react'
import { Outlet, useLocation } from 'react-router'
import { useUIStore } from '@/app/store'
import { useBusiness } from '@/app/use-business'
import { allNav } from '@/config/navigation'
import { useRealtimeEvents } from '@/lib/business-queries'
import { cn } from '@/lib/utils'
import { AppErrorBoundary } from '../feedback/AppErrorBoundary'
import { NotificationDrawer } from '../notifications/NotificationCenter'
import { CommandMenu } from '../ui/CommandMenu'
import { QuickActionsDialog } from '../ui/QuickActions'
import { BottomNav } from './BottomNav'
import { MobileDrawer } from './MobileDrawer'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

export function AppShell() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const location = useLocation()
  const business = useBusiness()
  // Live updates via SSE; degrades gracefully to normal refetching offline.
  useRealtimeEvents(true)

  const routeLabel =
    allNav.find((n) => location.pathname === n.to || location.pathname.startsWith(`${n.to}/`))
      ?.label ?? 'Overview'
  React.useEffect(() => {
    document.title = `${routeLabel} · ${business.business_name} Staff Dashboard`
  }, [routeLabel, business.business_name])

  return (
    <div className="no-overflow flex min-h-dvh bg-app text-ink">
      <Sidebar />
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[padding] duration-200',
          'lg:pl-[264px]',
          collapsed && 'lg:pl-[76px]',
        )}
      >
        <TopHeader />
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 sm:pt-6 lg:pb-12"
        >
          <AppErrorBoundary>
            <Outlet />
          </AppErrorBoundary>
        </motion.main>
        <footer className="hidden border-t border-line-subtle px-6 py-4 lg:block">
          <p className="mx-auto max-w-6xl text-xs text-ink-muted">
            {business.business_name} staff dashboard — operations, CRM, calendar, tasks,
            notifications, analytics and settings. © {new Date().getFullYear()}{' '}
            {business.business_name}.
          </p>
        </footer>
      </div>
      <BottomNav />
      <MobileDrawer />
      <CommandMenu />
      <QuickActionsDialog />
      <NotificationDrawer />
    </div>
  )
}
