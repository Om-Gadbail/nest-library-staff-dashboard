import * as React from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './AuthContext'
import { Skeleton } from '@/components/ui/Skeleton'

export function ProtectedRoute({
  children,
  permission,
}: {
  children: React.ReactNode
  permission?: string
}) {
  const { isAuthenticated, isLoading, can } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (permission && !can(permission)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
