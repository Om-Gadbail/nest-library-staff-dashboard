import { CalendarDays, ChevronDown } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { RANGE_PRESETS, formatRangeLabel, resolveRange, type RangePreset } from '@/lib/date-range'
import { DEMO_NOW } from '@/hooks/useRangeFromUrl'

/**
 * Global analytics date selector. Range lives in URL query state
 * (?range=...&from=...&to=...) so views are shareable + refresh-safe.
 */

export function DateRangeSelector({ compact }: { compact?: boolean }) {
  const [params, setParams] = useSearchParams()
  const preset = (params.get('range') as RangePreset | null) ?? 'last-30'
  const range = resolveRange(preset, DEMO_NOW, {
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  })

  const set = (p: RangePreset, extra?: { from?: string; to?: string }) => {
    const next = new URLSearchParams(params)
    next.set('range', p)
    if (extra?.from) next.set('from', extra.from)
    else next.delete('from')
    if (extra?.to) next.set('to', extra.to)
    else next.delete('to')
    setParams(next, { replace: true })
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <CalendarDays className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <label className="relative min-w-0 flex-1 sm:max-w-56">
          <span className="sr-only">Select date range</span>
          <select
            value={preset}
            onChange={(e) => set(e.target.value as RangePreset)}
            className="h-10 w-full cursor-pointer appearance-none rounded-md border border-line bg-surface pr-8 pl-3 text-sm font-medium text-ink shadow-xs hover:border-line-strong"
          >
            {RANGE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
        </label>
      </div>
      {!compact ? (
        <p className="text-xs text-ink-muted" aria-live="polite">
          {formatRangeLabel(range)}
        </p>
      ) : null}
      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-secondary">
            From
            <input
              type="date"
              value={params.get('from') ?? '2026-08-28'}
              max={params.get('to') ?? '2026-09-26'}
              onChange={(e) =>
                set('custom', { from: e.target.value, to: params.get('to') ?? '2026-09-26' })
              }
              className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-secondary">
            To
            <input
              type="date"
              value={params.get('to') ?? '2026-09-26'}
              min={params.get('from') ?? '2026-08-28'}
              max="2026-09-26"
              onChange={(e) =>
                set('custom', { from: params.get('from') ?? '2026-08-28', to: e.target.value })
              }
              className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
