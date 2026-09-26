import { BookOpenText, Command, Plus } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useBusiness } from '@/app/use-business'
import { useUIStore } from '@/app/store'
import { useAuth } from '@/features/auth/AuthContext'
import { allNav } from '@/config/navigation'
import { Avatar } from '../ui/Avatar'
import { Dropdown, DropdownItem } from '../ui/Overlays'
import { NotificationBell } from '../notifications/NotificationCenter'

function titleFor(pathname: string): string {
  const found = allNav.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`))
  return found?.label ?? 'Overview'
}

export function TopHeader() {
  const business = useBusiness()
  const location = useLocation()
  const navigate = useNavigate()
  const setCommand = useUIStore((s) => s.setCommandOpen)
  const setQuick = useUIStore((s) => s.setQuickActionsOpen)
  const { user, activeRole, logout } = useAuth()
  const title = titleFor(location.pathname)
  const displayName = user?.full_name ?? 'Staff'
  const roleLabel =
    activeRole === 'owner' ? 'Owner' : activeRole === 'admin' ? 'Administrator' : 'Staff'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line-subtle bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        {/* Mobile brand */}
        <Link
          to="/dashboard"
          className="flex min-w-0 items-center gap-2 lg:hidden"
          aria-label="Nest Library home"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar text-ink-inverse">
            <BookOpenText className="size-4.5" />
          </span>
          <span className="truncate text-[15px] font-semibold text-ink">
            {business.business_name}
          </span>
        </Link>

        {/* Desktop title */}
        <div className="hidden min-w-0 lg:block">
          <p className="text-xs text-ink-muted">{business.business_name}</p>
          <h1 className="truncate text-lg leading-tight font-semibold text-ink">{title}</h1>
        </div>

        {/* Mobile title */}
        <p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-ink lg:hidden">
          {title}
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Search / command */}
          <button
            type="button"
            onClick={() => setCommand(true)}
            aria-label="Search or jump to a page (Ctrl K)"
            className="hidden h-10 cursor-pointer items-center gap-2 rounded-md border border-line bg-app/60 px-3 text-sm text-ink-secondary hover:border-line-strong hover:text-ink sm:flex sm:w-56 lg:w-64"
          >
            <Command className="size-4" />
            <span className="flex-1 truncate text-left">Search or jump…</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink-muted">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setCommand(true)}
            aria-label="Search"
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-ink-secondary hover:bg-app hover:text-ink sm:hidden"
          >
            <Command className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => setQuick(true)}
            aria-label="Quick actions"
            className="hidden h-10 cursor-pointer items-center gap-1.5 rounded-md bg-sidebar px-3.5 text-sm font-medium text-ink-inverse hover:bg-sidebar-hover sm:flex"
          >
            <Plus className="size-4" />
            New
          </button>

          <NotificationBell />

          <Dropdown
            label="Profile menu"
            trigger={
              <button
                type="button"
                aria-label="Open profile menu"
                className="cursor-pointer rounded-full"
              >
                <Avatar name={displayName} className="size-9" />
              </button>
            }
          >
            <div className="px-2.5 py-2">
              <p className="text-sm font-semibold text-ink">{displayName}</p>
              <p className="text-xs text-ink-secondary">
                {roleLabel} · {business.business_name}
              </p>
              {user?.email ? (
                <p className="truncate text-xs text-ink-muted">{user.email}</p>
              ) : null}
            </div>
            <DropdownItem onSelect={() => navigate('/settings')}>Settings</DropdownItem>
            <DropdownItem onSelect={() => navigate('/staff')}>Staff</DropdownItem>
            <DropdownItem onSelect={() => void handleLogout()}>Sign out</DropdownItem>
          </Dropdown>
        </div>
      </div>
    </header>
  )
}
