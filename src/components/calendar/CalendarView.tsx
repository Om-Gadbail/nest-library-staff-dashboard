import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { formatTime } from '@/lib/format'

/**
 * Reusable calendar infrastructure — Day / Week / Month / Agenda.
 * Restrained semantic treatment (no rainbow): bookings = bronze,
 * renewals/follow-ups = neutral, tasks = muted. Heavy views are
 * code-split by route; this component itself stays light.
 */

export interface CalEvent {
  id: string
  title: string
  subtitle?: string
  starts_at: string
  ends_at: string
  kind: 'booking' | 'renewal' | 'task' | 'follow-up' | 'admission'
  status?: string
  onOpen?: () => void
}

export type CalView = 'day' | 'week' | 'month' | 'agenda'

const KIND_STYLE: Record<CalEvent['kind'], string> = {
  booking: 'border-brand bg-brand-soft text-brand-ink',
  renewal: 'border-line-strong bg-app text-ink',
  task: 'border-line bg-surface text-ink-secondary',
  'follow-up': 'border-warning-border bg-warning-soft text-warning',
  admission: 'border-success-border bg-success-soft text-success',
}

function eventsOn(events: CalEvent[], day: Date): CalEvent[] {
  return events
    .filter((e) => {
      const d = parseISO(e.starts_at)
      return !Number.isNaN(d.getTime()) && isSameDay(d, day)
    })
    .sort((a, b) => +parseISO(a.starts_at) - +parseISO(b.starts_at))
}

export function CalendarView({
  events,
  view,
  onView,
  cursor,
  onCursor,
  onEventOpen,
}: {
  events: CalEvent[]
  view: CalView
  onView: (v: CalView) => void
  cursor: Date
  onCursor: (d: Date) => void
  onEventOpen?: (e: CalEvent) => void
}) {
  const views: { v: CalView; label: string }[] = [
    { v: 'day', label: 'Day' },
    { v: 'week', label: 'Week' },
    { v: 'month', label: 'Month' },
    { v: 'agenda', label: 'Agenda' },
  ]

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous period"
            onClick={() =>
              onCursor(
                view === 'month'
                  ? addMonths(cursor, -1)
                  : addDays(cursor, view === 'day' ? -1 : -7),
              )
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCursor(startOfDay(new Date('2026-09-26T12:00:00')))}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next period"
            onClick={() =>
              onCursor(
                view === 'month' ? addMonths(cursor, 1) : addDays(cursor, view === 'day' ? 1 : 7),
              )
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink" aria-live="polite">
          {view === 'month'
            ? format(cursor, 'MMMM yyyy')
            : view === 'day'
              ? format(cursor, 'EEEE, d MMM yyyy')
              : format(cursor, "'Week of' d MMM yyyy")}
        </p>
        <div
          role="tablist"
          aria-label="Calendar view"
          className="flex rounded-lg border border-line bg-surface p-0.5"
        >
          {views.map((x) => (
            <button
              key={x.v}
              role="tab"
              aria-selected={view === x.v}
              type="button"
              onClick={() => onView(x.v)}
              className={cn(
                'h-8 cursor-pointer rounded-md px-2.5 text-[13px] font-medium transition-colors sm:px-3',
                view === x.v
                  ? 'bg-brand-soft text-brand-ink ring-1 ring-inset ring-brand/30 shadow-xs'
                  : 'text-ink-secondary hover:bg-brand-soft/60 hover:text-brand-ink',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={`${view}-${cursor.toISOString()}`}
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="mt-3"
      >
        {view === 'day' ? (
          <DayView day={cursor} events={eventsOn(events, cursor)} onEventOpen={onEventOpen} />
        ) : null}
        {view === 'week' ? (
          <WeekView anchor={cursor} events={events} onEventOpen={onEventOpen} />
        ) : null}
        {view === 'month' ? (
          <MonthView
            anchor={cursor}
            events={events}
            onCursor={onCursor}
            onView={onView}
            onEventOpen={onEventOpen}
          />
        ) : null}
        {view === 'agenda' ? (
          <AgendaView anchor={cursor} events={events} onEventOpen={onEventOpen} />
        ) : null}
      </motion.div>
    </div>
  )
}

function EventPill({ e, onEventOpen }: { e: CalEvent; onEventOpen?: (e: CalEvent) => void }) {
  return (
    <button
      type="button"
      onClick={() => (onEventOpen ?? e.onOpen)?.(e)}
      aria-label={`${e.title}, ${formatTime(e.starts_at)} to ${formatTime(e.ends_at)}`}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] transition-shadow hover:shadow-sm',
        KIND_STYLE[e.kind],
      )}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
      <span className="shrink-0 text-xs opacity-80">{formatTime(e.starts_at)}</span>
    </button>
  )
}

function DayView({
  day,
  events,
  onEventOpen,
}: {
  day: Date
  events: CalEvent[]
  onEventOpen?: (e: CalEvent) => void
}) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 7am–8pm
  return (
    <div className="overflow-hidden rounded-xl border border-line-subtle bg-surface">
      <div className="border-b border-line-subtle bg-app/60 px-4 py-2.5">
        <p className="text-sm font-semibold text-ink">{format(day, 'EEEE, d MMMM')}</p>
        <p className="text-xs text-ink-muted">
          {events.length} event{events.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="divide-y divide-line-subtle">
        {hours.map((h) => {
          const slot = events.filter((e) => parseISO(e.starts_at).getHours() === h)
          return (
            <div key={h} className="flex min-h-12 gap-3 px-3 py-1.5 sm:px-4">
              <span className="w-14 shrink-0 pt-1 text-xs text-ink-muted">
                {format(new Date().setHours(h, 0, 0, 0), 'h a')}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
                {slot.map((e) => (
                  <EventPill key={e.id} e={e} onEventOpen={onEventOpen} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  anchor,
  events,
  onEventOpen,
}: {
  anchor: Date
  events: CalEvent[]
  onEventOpen?: (e: CalEvent) => void
}) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <div className="overflow-x-auto rounded-xl border border-line-subtle bg-surface">
      <div className="grid min-w-[720px] grid-cols-7 divide-x divide-line-subtle">
        {days.map((d) => {
          const list = eventsOn(events, d)
          const today = isSameDay(d, new Date('2026-09-26T12:00:00'))
          return (
            <div key={d.toISOString()} className={cn('min-h-48 p-2', today && 'bg-brand-soft/40')}>
              <p
                className={cn(
                  'text-xs font-semibold',
                  today ? 'text-brand-ink' : 'text-ink-secondary',
                )}
              >
                {format(d, 'EEE d')}
              </p>
              <div className="mt-1.5 space-y-1.5">
                {list.map((e) => (
                  <EventPill key={e.id} e={e} onEventOpen={onEventOpen} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({
  anchor,
  events,
  onCursor,
  onView,
  onEventOpen,
}: {
  anchor: Date
  events: CalEvent[]
  onCursor: (d: Date) => void
  onView: (v: CalView) => void
  onEventOpen?: (e: CalEvent) => void
}) {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  const days: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return (
    <div className="overflow-hidden rounded-xl border border-line-subtle bg-surface">
      <div className="grid grid-cols-7 border-b border-line-subtle bg-app/60">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <p
            key={d}
            className="px-1 py-2 text-center text-xs font-semibold text-ink-secondary uppercase"
          >
            {d}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = eventsOn(events, d)
          const inMonth = d.getMonth() === anchor.getMonth()
          const today = isSameDay(d, new Date('2026-09-26T12:00:00'))
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => {
                onCursor(d)
                onView('day')
              }}
              aria-label={`${format(d, 'd MMMM')}, ${list.length} events`}
              className={cn(
                'min-h-16 cursor-pointer border-b border-line-subtle p-1 text-left align-top odd:border-r sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0',
                !inMonth && 'bg-app/40',
                today && 'bg-brand-soft/50',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                  today ? 'bg-sidebar text-ink-inverse' : inMonth ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {format(d, 'd')}
              </span>
              <span className="mt-1 hidden flex-col gap-1 sm:flex">
                {list.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className={cn(
                      'truncate rounded border px-1.5 py-0.5 text-[11px]',
                      KIND_STYLE[e.kind],
                    )}
                  >
                    {e.title}
                  </span>
                ))}
                {list.length > 2 ? (
                  <span className="text-[11px] text-ink-muted">+{list.length - 2} more</span>
                ) : null}
              </span>
              {list.length > 0 ? (
                <span className="mt-1 flex gap-1 sm:hidden" aria-hidden="true">
                  {list.slice(0, 3).map((e) => (
                    <span key={e.id} className="size-1.5 rounded-full bg-brand" />
                  ))}
                </span>
              ) : null}
              <span className="sr-only">{list.map((e) => e.title).join(', ')}</span>
            </button>
          )
        })}
      </div>
      <span className="sr-only">{onEventOpen ? 'Events open on selection' : ''}</span>
    </div>
  )
}

function AgendaView({
  anchor,
  events,
  onEventOpen,
}: {
  anchor: Date
  events: CalEvent[]
  onEventOpen?: (e: CalEvent) => void
}) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(anchor), i))
  return (
    <ol className="space-y-3">
      {days.map((d) => {
        const list = eventsOn(events, d)
        if (list.length === 0) return null
        return (
          <li
            key={d.toISOString()}
            className="overflow-hidden rounded-xl border border-line-subtle bg-surface"
          >
            <p className="border-b border-line-subtle bg-app/60 px-4 py-2 text-[13px] font-semibold text-ink">
              {format(d, 'EEEE, d MMM')}
            </p>
            <ul className="space-y-1.5 p-3">
              {list.map((e) => (
                <li key={e.id}>
                  <EventPill e={e} onEventOpen={onEventOpen} />
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
