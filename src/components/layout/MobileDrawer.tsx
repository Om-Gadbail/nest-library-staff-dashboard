import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { NavLink } from 'react-router'
import { useBusiness } from '@/app/use-business'
import { useUIStore } from '@/app/store'
import { allNav } from '@/config/navigation'
import { useAuth } from '@/features/auth/AuthContext'
import { useVisibleNav } from '@/hooks/useVisibleNav'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/motion'
import { Avatar } from '../ui/Avatar'

export function MobileDrawer() {
  const business = useBusiness()
  const open = useUIStore((s) => s.mobileNavOpen)
  const setOpen = useUIStore((s) => s.setMobileNavOpen)
  const { user, activeRole } = useAuth()
  const nav = useVisibleNav(allNav)
  const displayName = user?.full_name ?? 'Staff'
  const roleLabel =
    activeRole === 'owner' ? 'Owner' : activeRole === 'admin' ? 'Administrator' : 'Staff'

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All navigation">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ x: prefersReducedMotion ? 0 : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="safe-bottom absolute inset-y-0 right-0 flex w-[86vw] max-w-sm flex-col bg-sidebar shadow-lg"
          >
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
              <Avatar name={business.business_name} className="size-9 bg-white/10 text-amber-100" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink-inverse">
                  {business.business_name}
                </span>
                <span className="block text-xs text-stone-500">All sections</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-stone-400 hover:bg-sidebar-hover hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav aria-label="All sections" className="sidebar-scroll flex-1 overflow-y-auto p-3">
              <div className="space-y-0.5">
                {nav.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                        isActive
                          ? 'bg-sidebar-active text-ink-inverse'
                          : 'text-stone-400 hover:bg-sidebar-hover hover:text-white',
                      )
                    }
                  >
                    <n.icon className="size-[18px] shrink-0" />
                    <span className="flex-1">{n.label}</span>
                    {n.badge ? (
                      <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {n.badge}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            </nav>
            <div className="border-t border-white/10 p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={displayName} className="size-9 bg-white/10 text-amber-100" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-inverse">{displayName}</span>
                  <span className="block text-xs text-stone-500">{roleLabel}</span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
