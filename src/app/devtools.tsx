import * as React from 'react'
import { useIsDesktop } from '@/hooks/useMediaQuery'

const ReactQueryDevtools = React.lazy(() =>
  import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
)

/**
 * Developer-only Query Devtools.
 * - Never rendered in production builds (returns null before any import).
 * - Lazy-loaded so the devtools bundle is excluded from production output.
 * - Never overlaps mobile bottom nav / dialogs: rendered only on desktop widths.
 * - Enable explicitly on small screens with ?devtools=1 if needed.
 */
export function Devtools() {
  const isDesktop = useIsDesktop()
  if (!import.meta.env.DEV) return null
  if (import.meta.env.VITE_ENABLE_DEVTOOLS === 'false') return null
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.has('devtools')) {
      return (
        <React.Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        </React.Suspense>
      )
    }
  }
  if (!isDesktop) return null
  return (
    <React.Suspense fallback={null}>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </React.Suspense>
  )
}
