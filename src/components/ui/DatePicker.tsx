import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import * as React from 'react'
import { DayPicker, type DateRange } from '@daypicker/react'
import '@daypicker/react/style.css'
import { cn } from '@/lib/utils'
import { presetFns, datePresets } from './date-presets'
import { Button } from './Button'
import { Dialog, DialogContent } from './Dialog'

function fmt(d?: Date) {
  return d ? format(d, 'd MMM yyyy') : '—'
}

/** Single date picker — bottom-sheet dialog on mobile, centered on desktop. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  label,
}: {
  value?: Date
  onChange: (d?: Date) => void
  placeholder?: string
  label?: string
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ?? placeholder}
        className="flex h-10 min-h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-ink shadow-xs hover:border-line-strong"
      >
        <CalendarDays className="size-4 shrink-0 text-ink-muted" />
        <span className={cn('truncate', !value && 'text-ink-muted')}>
          {value ? fmt(value) : placeholder}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent title={label ?? 'Select date'} className="sm:max-w-sm">
            <div className="flex justify-center">
              <DayPicker
                mode="single"
                selected={value}
                onSelect={(d) => {
                  onChange(d)
                  setOpen(false)
                }}
              />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}

/** Date-range picker with presets for analytics / renewals / payments. */
export function DateRangePicker({
  value,
  onChange,
  label = 'Date range',
}: {
  value: DateRange | undefined
  onChange: (r: DateRange | undefined) => void
  label?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DateRange | undefined>(value)

  const openPicker = () => {
    setDraft(value)
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label={label}
        className="flex h-10 min-h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm whitespace-nowrap text-ink shadow-xs hover:border-line-strong sm:w-auto"
      >
        <CalendarDays className="size-4 shrink-0 text-ink-muted" />
        <span className="truncate">
          {value?.from ? fmt(value.from) : 'Start'} — {value?.to ? fmt(value.to) : 'End'}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent title={label} description="Choose a preset or a custom range" className="sm:max-w-xl">
            <div className="flex flex-wrap gap-1.5">
              {datePresets.map((p) => (
                <Button
                  key={p.key}
                  variant="secondary"
                  size="sm"
                  onClick={() => setDraft(presetFns[p.key]())}
                >
                  {p.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setDraft(undefined)}>
                Custom range
              </Button>
            </div>
            <div className="mt-3 flex justify-center overflow-x-auto">
              <DayPicker mode="range" selected={draft} onSelect={setDraft} numberOfMonths={1} />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onChange(draft)
                  setOpen(false)
                }}
              >
                Apply range
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}
