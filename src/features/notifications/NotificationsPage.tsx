import { motion } from 'motion/react'
import { CheckCheck } from 'lucide-react'
import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMarkAllNotificationsRead, useNotifications } from '@/lib/business-queries'
import { staggerChild, staggerParent } from '@/lib/motion'
import { NotificationRow } from '@/components/notifications/NotificationCenter'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'unread' | 'renewal' | 'payment' | 'lead' | 'booking' | 'task' | 'system'

const FILTERS: { v: Filter; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'unread', label: 'Unread' },
  { v: 'renewal', label: 'Renewals' },
  { v: 'payment', label: 'Payments' },
  { v: 'lead', label: 'Leads' },
  { v: 'booking', label: 'Bookings' },
  { v: 'task', label: 'Tasks' },
  { v: 'system', label: 'System' },
]

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications()
  const markAll = useMarkAllNotificationsRead()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = ((params.get('filter') as Filter | null) ?? 'all') as Filter

  const rows = React.useMemo(() => {
    const list = (data ?? []).filter((n) => !n.dismissed)
    if (filter === 'all') return list
    if (filter === 'unread') return list.filter((n) => !n.read)
    return list.filter((n) => n.kind === filter)
  }, [data, filter])

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-4 sm:space-y-5"
    >
      <motion.div variants={staggerChild}>
        <PageHeader
          title="Notifications"
          description="Renewals, payments, leads, bookings and tasks"
          actions={
            <Button
              variant="secondary"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          }
        />
      </motion.div>
      <motion.div variants={staggerChild}>
        <div
          role="tablist"
          aria-label="Notification filters"
          className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {FILTERS.map((f) => (
            <button
              key={f.v}
              role="tab"
              aria-selected={filter === f.v}
              type="button"
              onClick={() => {
                const n = new URLSearchParams(params)
                n.set('filter', f.v)
                setParams(n, { replace: true })
              }}
              className={cn(
                'h-9 shrink-0 cursor-pointer rounded-full border px-3 text-[13px] font-medium whitespace-nowrap',
                filter === f.v
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-ink-secondary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>
      <motion.div variants={staggerChild}>
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                title="You're all caught up"
                description="No notifications in this view."
              />
            </CardContent>
          </Card>
        ) : (
          <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-2">
            {rows.map((n) => (
              <NotificationRow
                key={n.notification_id}
                item={n}
                onOpen={(link) => {
                  if (link) navigate(link)
                  else if (n.customer_id) navigate(`/customers/${n.customer_id}`)
                }}
              />
            ))}
          </ul>
        )}
      </motion.div>
    </motion.div>
  )
}
