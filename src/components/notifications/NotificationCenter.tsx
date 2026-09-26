import { AnimatePresence, motion } from 'motion/react'
import { Bell, CheckCheck, X } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router'
import { useUIStore } from '@/app/store'
import {
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/lib/business-queries'
import { formatRelative } from '@/lib/format'
import { prefersReducedMotion } from '@/lib/motion'
import { unreadCount } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import type { NotificationItem } from '@/types/domain'

export function NotificationBell() {
  const { data } = useNotifications()
  const count = unreadCount(data)
  const setDrawer = useUIStore((s) => s.setNotificationsOpen)
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        if (window.innerWidth < 1024) navigate('/notifications')
        else setDrawer(true)
      }}
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      className="relative flex size-10 cursor-pointer items-center justify-center rounded-lg text-ink-secondary hover:bg-app hover:text-ink"
    >
      <Bell className="size-5" aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-4 font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  )
}

export function NotificationDrawer() {
  const open = useUIStore((s) => s.notificationsOpen)
  const setOpen = useUIStore((s) => s.setNotificationsOpen)
  const { data } = useNotifications()
  const markAll = useMarkAllNotificationsRead()
  const navigate = useNavigate()
  const items = (data ?? []).filter((n) => !n.dismissed).slice(0, 8)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {open ? (
        <DialogContent
          title="Notifications"
          description="Latest operational alerts"
          className="sm:max-w-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-ink-muted" aria-live="polite">
              {unreadCount(data)} unread
            </p>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-brand-ink hover:underline"
            >
              <CheckCheck className="size-4" /> Mark all read
            </button>
          </div>
          <ul className="max-h-[50dvh] space-y-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {items.map((n) => (
                <NotificationRow
                  key={n.notification_id}
                  item={n}
                  compact
                  onOpen={(link) => {
                    setOpen(false)
                    if (link) navigate(link)
                  }}
                />
              ))}
            </AnimatePresence>
          </ul>
          <div className="mt-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setOpen(false)
                navigate('/notifications')
              }}
            >
              View all notifications
            </Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

const KIND_DOT: Record<string, string> = {
  renewal: 'bg-warning',
  payment: 'bg-success',
  lead: 'bg-info',
  booking: 'bg-brand',
  task: 'bg-chart-2',
  admission: 'bg-success',
  whatsapp: 'bg-success',
  system: 'bg-ink-muted',
}

export function NotificationRow({
  item,
  onOpen,
  compact,
}: {
  item: NotificationItem
  onOpen?: (link?: string) => void
  compact?: boolean
}) {
  const markRead = useMarkNotificationRead()
  const dismiss = useDismissNotification()
  const [leaving, setLeaving] = React.useState(false)

  const open = () => {
    if (!item.read) markRead.mutate(item.notification_id)
    onOpen?.(item.link ?? (item.customer_id ? `/customers/${item.customer_id}` : undefined))
  }

  return (
    <motion.li
      layout={!prefersReducedMotion}
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
      animate={{ opacity: leaving ? 0 : 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className={cn(
        'flex gap-2.5 rounded-xl border p-3',
        item.read ? 'border-line-subtle bg-surface' : 'border-brand-softer bg-brand-soft/40',
      )}
    >
      <span
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', KIND_DOT[item.kind] ?? 'bg-ink-muted')}
        aria-hidden="true"
      />
      <button type="button" onClick={open} className="min-w-0 flex-1 cursor-pointer text-left">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-sm',
              item.read ? 'font-medium text-ink' : 'font-semibold text-ink',
            )}
          >
            {item.title}
          </span>
          {!item.read ? (
            <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />
          ) : null}
        </span>
        <span
          className={cn(
            'mt-0.5 line-clamp-2 text-[13px] text-ink-secondary',
            compact && 'line-clamp-1',
          )}
        >
          {item.body}
        </span>
        <span className="mt-1 block text-xs text-ink-muted">{formatRelative(item.created_at)}</span>
      </button>
      <button
        type="button"
        aria-label={`Dismiss notification: ${item.title}`}
        onClick={() => {
          setLeaving(true)
          dismiss.mutate(item.notification_id)
        }}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-app hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </motion.li>
  )
}
