import { motion } from 'motion/react'
import {
  CalendarCheck,
  CreditCard,
  MessageCircle,
  NotebookPen,
  Phone,
  RefreshCcw,
  UserPlus,
  Bell,
  ArrowLeftRight,
  CheckCircle2,
  CircleDot,
} from 'lucide-react'
import { formatDateTime, formatRelative } from '@/lib/format'
import { prefersReducedMotion, staggerChild, staggerParent } from '@/lib/motion'
import type { TimelineEvent } from '@/lib/timeline'

/**
 * Reusable activity timeline — works for customer, lead, booking,
 * payment, membership and task contexts. Single implementation.
 */

const ICONS: Record<string, typeof Phone> = {
  admission: UserPlus,
  payment: CreditCard,
  renewal: RefreshCcw,
  lead: UserPlus,
  booking: CalendarCheck,
  note: NotebookPen,
  notification: Bell,
  contact: Phone,
  call: Phone,
  whatsapp: MessageCircle,
  task: CheckCircle2,
  membership: ArrowLeftRight,
  'follow-up': Phone,
  conversion: UserPlus,
  system: CircleDot,
}

export function ActivityTimeline({
  events,
  emptyLabel = 'No activity yet',
}: {
  events: TimelineEvent[]
  emptyLabel?: string
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-app/40 px-4 py-6 text-center text-sm text-ink-secondary">
        {emptyLabel}
      </p>
    )
  }
  return (
    <motion.ol
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
      className="relative space-y-0"
      aria-label="Activity timeline"
    >
      {events.map((e, i) => {
        const Icon = ICONS[e.kind ?? 'system'] ?? CircleDot
        const last = i === events.length - 1
        return (
          <motion.li
            key={e.id}
            variants={prefersReducedMotion ? undefined : staggerChild}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last ? (
              <span
                aria-hidden="true"
                className="absolute top-9 left-[15px] h-[calc(100%-2rem)] w-px bg-line"
              />
            ) : null}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-brand-ink shadow-xs">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-ink">{e.title}</p>
              {e.description ? (
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">
                  {e.description}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-ink-muted">
                <time dateTime={e.at}>{formatDateTime(e.at)}</time>
                <span aria-hidden="true"> · </span>
                <span>{formatRelative(e.at)}</span>
              </p>
              {e.linkLabel && e.onOpen ? (
                <button
                  type="button"
                  onClick={e.onOpen}
                  className="mt-1 cursor-pointer text-[13px] font-medium text-brand-ink hover:underline"
                >
                  {e.linkLabel}
                </button>
              ) : null}
            </div>
          </motion.li>
        )
      })}
    </motion.ol>
  )
}
