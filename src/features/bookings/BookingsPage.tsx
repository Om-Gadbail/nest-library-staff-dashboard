import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { AlertTriangle, CalendarPlus, Eye } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { useBookings, useCreateBooking, useUpdateBookingStatus } from '@/lib/business-queries'
import { useCustomers } from '@/lib/business-queries'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { findBookingConflicts } from '@/mock/business-service'
import { formatDate, formatTime } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { notify } from '@/lib/notify'
import type { Booking } from '@/types/domain'
import { CalendarView, type CalEvent } from '@/components/calendar/CalendarView'
import { useCalendarCursor } from '@/hooks/useCalendarCursor'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { FilterBar } from '@/components/ui/FilterBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { BookingStatusBadge } from '@/components/ui/StatusBadge'

const SERVICES = ['Reading Hall', 'Discussion Room', 'Silent Pod', 'Trial Session', 'Tour']
const STAFF = ['Priya Sharma', 'Rahul Verma']

const schema = z.object({
  title: z.string().min(2, 'Enter a booking title'),
  service: z.string().optional(),
  customer_name: z.string().min(2, 'Enter customer name'),
  customer_phone: z.string().optional(),
  staff: z.string().optional(),
  date: z.string().min(1, 'Pick a date'),
  start_time: z.string().min(1, 'Pick a start time'),
  end_time: z.string().min(1, 'Pick an end time'),
  notes: z.string().optional(),
})

type Form = z.infer<typeof schema>

export function BookingDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const create = useCreateBooking()
  const { data: customers } = useCustomers()
  const [conflict, setConflict] = React.useState<string | null>(null)
  const { register, handleSubmit, watch, reset, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: '2026-09-27',
      start_time: '10:00',
      end_time: '12:00',
      service: 'Reading Hall',
      staff: 'Priya Sharma',
    },
  })
  // RHF watch() is non-memoizable by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const staff = watch('staff')
  const date = watch('date')
  const start = watch('start_time')
  const end = watch('end_time')

  // Live conflict hint as staff/time changes
  const liveConflict = React.useMemo(() => {
    if (!staff || !date || !start || !end) return null
    try {
      const hits = findBookingConflicts({
        staff,
        starts_at: `${date}T${start}:00`,
        ends_at: `${date}T${end}:00`,
      })
      return hits[0] ?? null
    } catch {
      return null
    }
  }, [staff, date, start, end])

  const submit = (allowOverlap: boolean) =>
    handleSubmit((v) => {
      setConflict(null)
      const customer = customers?.find((c) => c.full_name === v.customer_name)
      create.mutate(
        {
          input: {
            title: v.title,
            service: v.service || undefined,
            customer_id: customer?.customer_id,
            customer_name: v.customer_name,
            customer_phone: v.customer_phone || customer?.phone,
            staff: v.staff || undefined,
            date: v.date,
            start_time: v.start_time,
            end_time: v.end_time,
            notes: v.notes || undefined,
          },
          allowOverlap,
        },
        {
          onSuccess: () => {
            notify.success('Booking created', `${v.title} — ${v.date} ${v.start_time}.`)
            reset()
            onOpenChange(false)
          },
          onError: (e) => {
            const conflicts = (e as Error & { conflicts?: { title: string }[] }).conflicts
            if (conflicts?.length && !allowOverlap) {
              setConflict(
                `Staff member is already booked during this time (${conflicts[0].title}). Adjust the time or confirm an override.`,
              )
            } else {
              notify.error('Could not create booking', e.message)
            }
          },
        },
      )
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent
          title="New booking"
          description="Rooms, pods and reading-hall slots"
          className="sm:max-w-md"
        >
          <form className="space-y-3" onSubmit={submit(false)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Title *</span>
                <input
                  {...register('title')}
                  placeholder="Discussion Room A"
                  className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                />
                {formState.errors.title ? (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.title.message}
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Service</span>
                <select
                  {...register('service')}
                  className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
                >
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Customer *</span>
                <input
                  {...register('customer_name')}
                  list="booking-customers"
                  placeholder="Member name"
                  className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                />
                <datalist id="booking-customers">
                  {(customers ?? []).map((c) => (
                    <option key={c.customer_id} value={c.full_name} />
                  ))}
                </datalist>
                {formState.errors.customer_name ? (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.customer_name.message}
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Staff</span>
                <select
                  {...register('staff')}
                  className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
                >
                  <option value="">Unassigned</option>
                  {STAFF.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Date *</span>
                <input
                  {...register('date')}
                  type="date"
                  className="h-10 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Start *</span>
                <input
                  {...register('start_time')}
                  type="time"
                  className="h-10 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">End *</span>
                <input
                  {...register('end_time')}
                  type="time"
                  className="h-10 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink"
                />
              </label>
            </div>
            {liveConflict || conflict ? (
              <div
                role="alert"
                className="flex gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] text-warning"
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                <p>
                  <strong>Booking conflict.</strong>{' '}
                  {conflict ??
                    `Staff member is already booked during this time (${liveConflict?.title}).`}
                </p>
              </div>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink">Notes (optional)</span>
              <textarea
                {...register('notes')}
                rows={2}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              {conflict ? (
                <Button
                  type="button"
                  fullWidth
                  disabled={create.isPending}
                  onClick={() => submit(true)()}
                >
                  Override & book anyway
                </Button>
              ) : (
                <Button type="submit" fullWidth disabled={create.isPending}>
                  {create.isPending ? 'Saving…' : 'Create booking'}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function BookingCard({ b }: { b: Booking }) {
  const update = useUpdateBookingStatus()
  const navigate = useNavigate()
  return (
    <article className="rounded-xl border border-line-subtle bg-surface p-3.5 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{b.title}</p>
          <p className="truncate text-xs text-ink-secondary">
            {b.customer_name}
            {b.service ? ` · ${b.service}` : ''}
          </p>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        {formatDate(b.starts_at)} · {formatTime(b.starts_at)} – {formatTime(b.ends_at)}
        {b.staff ? ` · ${b.staff}` : ''}
      </p>
      <div className="mt-2.5 flex gap-2">
        {b.customer_id ? (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/customers/${b.customer_id}`)}
          >
            <Eye className="size-4" />
            Customer
          </Button>
        ) : null}
        {b.status === 'scheduled' || b.status === 'pending' ? (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => update.mutate({ id: b.booking_id, status: 'confirmed' })}
          >
            Confirm
          </Button>
        ) : null}
        {b.status === 'scheduled' || b.status === 'confirmed' || b.status === 'pending' ? (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => update.mutate({ id: b.booking_id, status: 'completed' })}
          >
            Complete
          </Button>
        ) : null}
        {b.status !== 'cancelled' && b.status !== 'completed' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update.mutate({ id: b.booking_id, status: 'cancelled' })}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </article>
  )
}

export default function BookingsPage() {
  const { data, isLoading, isError, refetch } = useBookings()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [mode, setMode] = React.useState<'list' | 'calendar'>('list')
  const [params, setParams] = useSearchParams()
  // Quick action (?new=1) deep-links into the create workflow.
  const [createOpen, setCreateOpen] = React.useState(() => params.get('new') === '1')
  const handleCreateOpen = (v: boolean) => {
    setCreateOpen(v)
    if (!v) {
      const n = new URLSearchParams(params)
      if (n.has('new')) {
        n.delete('new')
        setParams(n, { replace: true })
      }
    }
  }
  const debounced = useDebouncedValue(search, 200)
  const { cursor, setCursor, view, setView } = useCalendarCursor()

  const rows = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return (data ?? [])
      .filter((b) => (status === 'all' ? true : b.status === status))
      .filter(
        (b) => !q || b.title.toLowerCase().includes(q) || b.customer_name.toLowerCase().includes(q),
      )
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
  }, [data, debounced, status])

  const events: CalEvent[] = React.useMemo(
    () =>
      (data ?? []).map((b) => ({
        id: b.booking_id,
        title: `${b.title} — ${b.customer_name}`,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        kind: 'booking' as const,
        status: b.status,
      })),
    [data],
  )

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-4 sm:space-y-5"
    >
      <motion.div variants={staggerChild}>
        <PageHeader
          title="Bookings"
          description="Rooms, pods and reading-hall schedule"
          actions={
            <div className="flex gap-2">
              <div
                role="tablist"
                aria-label="Bookings layout"
                className="flex rounded-lg border border-line bg-surface p-0.5"
              >
                {(['list', 'calendar'] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={
                      mode === m
                        ? 'h-9 cursor-pointer rounded-md bg-brand-soft px-3 text-[13px] font-medium text-brand-ink ring-1 ring-inset ring-brand/30 shadow-xs'
                        : 'h-9 cursor-pointer rounded-md px-3 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-brand-soft/60 hover:text-brand-ink'
                    }
                  >
                    {m === 'list' ? 'List' : 'Calendar'}
                  </button>
                ))}
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <CalendarPlus className="size-4" />
                New booking
              </Button>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search booking or customer…"
          resultCount={rows.length}
          onReset={() => {
            setSearch('')
            setStatus('all')
          }}
          selects={[
            {
              label: 'Status',
              value: status,
              onChange: setStatus,
              options: [
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'no-show', label: 'No-show' },
              ],
            },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent>
              <ErrorState onRetry={() => refetch()} />
            </CardContent>
          </Card>
        ) : mode === 'calendar' ? (
          <CalendarView
            events={events}
            view={view}
            onView={setView}
            cursor={cursor}
            onCursor={setCursor}
          />
        ) : rows.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                title="No bookings found"
                description="Create the first room or pod booking."
                action={<Button onClick={() => setCreateOpen(true)}>New booking</Button>}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <ul className="space-y-2.5 md:hidden">
              {rows.map((b) => (
                <li key={b.booking_id}>
                  <BookingCard b={b} />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl border border-line-subtle md:block">
              <table className="w-full min-w-[720px] border-collapse bg-surface text-left text-sm">
                <thead>
                  <tr className="border-b border-line-subtle bg-app/60">
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary"
                    >
                      Booking
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary"
                    >
                      When
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary"
                    >
                      Staff
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-secondary"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <BookingRow key={b.booking_id} b={b} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      <BookingDialog open={createOpen} onOpenChange={handleCreateOpen} />
    </motion.div>
  )
}

function BookingRow({ b }: { b: Booking }) {
  const update = useUpdateBookingStatus()
  const navigate = useNavigate()
  return (
    <tr className="border-b border-line-subtle last:border-0 hover:bg-app/50">
      <td className="px-3 py-2.5">
        <span className="block font-medium text-ink">{b.title}</span>
        <span className="block text-xs text-ink-secondary">
          {b.customer_name}
          {b.service ? ` · ${b.service}` : ''}
        </span>
      </td>
      <td className="px-3 py-2.5 text-ink-secondary">
        {formatDate(b.starts_at)}
        <span className="block text-xs text-ink-muted">
          {formatTime(b.starts_at)} – {formatTime(b.ends_at)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-ink-secondary">{b.staff ?? '—'}</td>
      <td className="px-3 py-2.5">
        <BookingStatusBadge status={b.status} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          {b.customer_id ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/customers/${b.customer_id}`)}
            >
              Customer
            </Button>
          ) : null}
          {b.status === 'scheduled' || b.status === 'pending' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => update.mutate({ id: b.booking_id, status: 'confirmed' })}
            >
              Confirm
            </Button>
          ) : null}
          {b.status === 'scheduled' || b.status === 'confirmed' || b.status === 'pending' ? (
            <Button
              size="sm"
              onClick={() => update.mutate({ id: b.booking_id, status: 'completed' })}
            >
              Complete
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
