import { BookOpenText, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { useBusiness } from '@/app/use-business'
import { useUIStore } from '@/app/store'
import { primaryNav, secondaryNav } from '@/config/navigation'
import { useVisibleNav } from '@/hooks/useVisibleNav'
import { useAuth } from '@/features/auth/AuthContext'
import { useNotifications, useRenewals } from '@/lib/business-queries'
import { unreadCount } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { Avatar } from '../ui/Avatar'
import { Tooltip } from '../ui/Overlays'
import { Separator } from '../ui/Separator'

function NavEntry({
  to,
  label,
  icon: Icon,
  badge,
  collapsed,
}: {
  to: string
  label: string
  icon: typeof BookOpenText
  badge?: string
  collapsed: boolean
}) {
  const link = (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'group flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-sidebar-active text-ink-inverse'
            : 'text-stone-400 hover:bg-sidebar-hover hover:text-ink-inverse',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-amber-200' : 'text-stone-500 group-hover:text-stone-300')} />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
          {!collapsed && badge ? (
            <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white">
              {badge}
            </span>
          ) : null}
          {collapsed && isActive ? (
            <span aria-hidden className="absolute left-0 h-5 w-0.5 rounded-full bg-amber-200" />
          ) : null}
        </>
      )}
    </NavLink>
  )
  if (collapsed) {
    return (
      <Tooltip
        trigger={<div className="relative">{link}</div>}
        content={badge ? `${label} (${badge})` : label}
        side="right"
      />
    )
  }
  return link
}

export function Sidebar() {
  const business = useBusiness()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const { user, activeRole } = useAuth()
  const primary = useVisibleNav(primaryNav)
  const secondary = useVisibleNav(secondaryNav)
  const displayName = user?.full_name ?? 'Staff'
  const roleLabel =
    activeRole === 'owner' ? 'Owner' : activeRole === 'admin' ? 'Admin' : 'Staff'
  // Live badges from real data — never hardcoded.
  const { data: renewals } = useRenewals()
  const { data: notifications } = useNotifications()
  const renewalsDue = (renewals ?? []).filter((r) => r.status !== 'overdue').length
  const unread = unreadCount(notifications)
  const badgeFor = (to: string): string | undefined => {
    if (to === '/renewals') return renewalsDue > 0 ? String(renewalsDue) : undefined
    if (to === '/notifications') return unread > 0 ? String(unread) : undefined
    return undefined
  }

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        'sidebar-scroll fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto bg-sidebar transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-2.5 px-4 pt-5 pb-4', collapsed && 'justify-center px-2')}>
        <Link
          to="/dashboard"
          aria-label={`${business.business_name} home`}
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <BookOpenText className="size-5" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold tracking-tight text-ink-inverse">
                {business.business_name}
              </span>
              <span className="block text-[11px] text-stone-500">Staff dashboard</span>
            </span>
          )}
        </Link>
      </div>

      {!collapsed && (
        <p className="px-4 pb-2 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
          Workspace
        </p>
      )}

      {/* Nav */}
      <nav className={cn('flex-1 space-y-0.5 px-3', collapsed && 'px-3')}>
        {primary.map((n) => (
          <NavEntry key={n.to} {...n} badge={badgeFor(n.to)} collapsed={collapsed} />
        ))}
        <div className="py-2">
          <Separator className="bg-white/10" />
        </div>
        {!collapsed && (
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
            Manage
          </p>
        )}
        {secondary.map((n) => (
          <NavEntry key={n.to} {...n} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-lg bg-white/[0.04] p-2.5',
            collapsed && 'justify-center p-2',
          )}
        >
          <Avatar name={displayName} className="size-8 bg-white/10 text-amber-100" />
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink-inverse">{displayName}</span>
              <span className="block text-[11px] text-stone-500">{roleLabel}</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="mt-2 flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-stone-500 hover:bg-sidebar-hover hover:text-stone-200"
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  )
}
