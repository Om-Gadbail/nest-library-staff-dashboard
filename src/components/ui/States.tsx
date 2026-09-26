import { AlertTriangle, Inbox, RotateCcw } from 'lucide-react'
import { Button } from './Button'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-app text-ink-secondary">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-ink-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again. If the problem continues, contact support.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-secondary">{description}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} className="mt-5">
          <RotateCcw className="size-4" />
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown
  resetErrorBoundary: () => void
}) {
  const isDev = import.meta.env.DEV
  const message = error instanceof Error ? error.message : 'Unknown error'
  return (
    <div className="flex min-h-dvh items-center justify-center bg-app px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          The dashboard hit an unexpected error. Your data is safe — try reloading this view.
        </p>
        {isDev ? (
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-app p-3 text-left text-xs text-ink-secondary">
            {message}
          </pre>
        ) : null}
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload app
          </Button>
          <Button onClick={resetErrorBoundary}>Try again</Button>
        </div>
      </div>
    </div>
  )
}
