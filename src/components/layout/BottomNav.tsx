import { Home, LayoutGrid, Plus, Users, UsersRound } from 'lucide-react'
import { NavLink } from 'react-router'
import { useUIStore } from '@/app/store'
import { cn } from '@/lib/utils'

function Tab({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof Home
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors',
          isActive ? 'text-brand-ink' : 'text-ink-muted hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-5', isActive && 'text-brand')} />
          {label}
        </>
      )}
    </NavLink>
  )
}

export function BottomNav() {
  const setQuick = useUIStore((s) => s.setQuickActionsOpen)
  const setMore = useUIStore((s) => s.setMobileNavOpen)

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-surface/95 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch gap-1 px-3 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <Tab to="/dashboard" label="Home" icon={Home} />
        <Tab to="/customers" label="Members" icon={Users} />
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => setQuick(true)}
            aria-label="Create — quick actions"
            className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-sidebar text-ink-inverse shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        </div>
        <Tab to="/leads" label="CRM" icon={UsersRound} />
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-label="More navigation"
          className="flex min-h-14 min-w-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-ink-muted hover:text-ink"
        >
          <LayoutGrid className="size-5" />
          More
        </button>
      </div>
    </nav>
  )
}
