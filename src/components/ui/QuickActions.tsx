import { useNavigate } from 'react-router'
import { useUIStore } from '@/app/store'
import { QUICK_ACTIONS, runQuickAction } from '@/config/quick-actions'
import { Dialog, DialogContent } from './Dialog'
import { Button } from './Button'

export function QuickActionsDialog() {
  const open = useUIStore((s) => s.quickActionsOpen)
  const setOpen = useUIStore((s) => s.setQuickActionsOpen)
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {open ? (
        <DialogContent
          title="Quick actions"
          description="Start the most common front-desk workflows"
          className="sm:max-w-md"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => runQuickAction(navigate, setOpen, a.to)}
                className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-line-subtle bg-app/40 px-3 py-3 text-left transition-colors hover:border-line-strong hover:bg-app"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-ink-inverse">
                  <a.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{a.label}</span>
                  <span className="block truncate text-xs text-ink-secondary">{a.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

export function QuickActionsGrid({ compact }: { compact?: boolean }) {
  const setOpen = useUIStore((s) => s.setQuickActionsOpen)
  const navigate = useNavigate()
  const items = compact ? QUICK_ACTIONS.slice(0, 4) : QUICK_ACTIONS
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={() => runQuickAction(navigate, setOpen, a.to)}
          aria-label={a.label}
          className="flex min-h-20 cursor-pointer flex-col items-start justify-between gap-2 rounded-xl border border-line-subtle bg-surface p-3 text-left shadow-xs transition-all hover:border-line-strong hover:shadow-sm active:scale-[0.98]"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
            <a.icon className="size-4.5" />
          </span>
          <span className="text-[13px] leading-tight font-semibold text-ink">{a.label}</span>
        </button>
      ))}
    </div>
  )
}
