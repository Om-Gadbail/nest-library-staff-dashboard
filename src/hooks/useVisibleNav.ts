import * as React from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import type { NavItem } from '@/config/navigation'

/** Hide navigation the current role cannot use (UX only — API enforces). */
export function useVisibleNav(items: NavItem[]): NavItem[] {
  const { can, isAuthenticated } = useAuth()
  return React.useMemo(() => {
    if (!isAuthenticated) return items
    return items.filter((n) => !n.permission || can(n.permission))
  }, [items, can, isAuthenticated])
}
