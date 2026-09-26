import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
} from 'date-fns'

/**
 * Central date-range system for analytics + operations.
 * Ranges resolve against real current time in the business timezone;
 * the API resolves the same presets server-side.
 */

export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'last-7'
  | 'last-30'
  | 'last-90'
  | 'custom'

export interface DateRange {
  start: Date
  end: Date
}

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This week' },
  { value: 'last-week', label: 'Last week' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'last-quarter', label: 'Last quarter' },
  { value: 'last-7', label: 'Last 7 days' },
  { value: 'last-30', label: 'Last 30 days' },
  { value: 'last-90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
]

/** Resolve a preset against "now" (defaults to the real current time). */
export function resolveRange(
  preset: RangePreset,
  now = new Date(),
  custom?: { from?: string; to?: string },
): DateRange {
  const day = startOfDay(now)
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'yesterday': {
      const y = subDays(day, 1)
      return { start: y, end: endOfDay(y) }
    }
    case 'this-week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) }
    case 'last-week': {
      const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      return { start: s, end: endOfWeek(s, { weekStartsOn: 1 }) }
    }
    case 'this-month':
      return { start: startOfMonth(now), end: endOfDay(now) }
    case 'last-month': {
      const m = subMonths(now, 1)
      return { start: startOfMonth(m), end: endOfMonth(m) }
    }
    case 'this-quarter':
      return { start: startOfQuarter(now), end: endOfDay(now) }
    case 'last-quarter': {
      const q = subQuarters(now, 1)
      return { start: startOfQuarter(q), end: endOfQuarter(q) }
    }
    case 'last-7':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) }
    case 'last-30':
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) }
    case 'last-90':
      return { start: startOfDay(subDays(now, 89)), end: endOfDay(now) }
    case 'custom': {
      const from = custom?.from ? startOfDay(parseISO(custom.from)) : startOfDay(subDays(now, 29))
      const to = custom?.to ? endOfDay(parseISO(custom.to)) : endOfDay(now)
      return { start: from, end: to }
    }
  }
}

/** Previous equivalent period for comparison (same length, immediately before). */
export function previousRange(range: DateRange): DateRange {
  const days = rangeDays(range)
  const currentStart = startOfDay(range.start)
  return {
    start: startOfDay(subDays(currentStart, days)),
    end: endOfDay(subDays(currentStart, 1)),
  }
}

export function inRange(iso: string, range: DateRange): boolean {
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return false
  return isWithinInterval(d, { start: range.start, end: range.end })
}

export function rangeDays(range: DateRange): number {
  const days =
    Math.round((startOfDay(range.end).getTime() - startOfDay(range.start).getTime()) / 86_400_000) +
    1
  return Math.max(1, days)
}

/** Grouping for trend charts based on range length. */
export function granularityFor(range: DateRange): 'day' | 'week' | 'month' {
  const days = rangeDays(range)
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

export function bucketKey(date: Date, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'day') return format(date, 'yyyy-MM-dd')
  if (granularity === 'week') return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  return format(date, 'yyyy-MM')
}

export function bucketLabel(key: string, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'day') return format(parseISO(key), 'd MMM')
  if (granularity === 'week') return `w/c ${format(parseISO(key), 'd MMM')}`
  return format(parseISO(`${key}-01`), 'MMM yyyy')
}

export function eachBucket(range: DateRange, granularity: 'day' | 'week' | 'month'): string[] {
  const keys: string[] = []
  if (granularity === 'day') {
    for (let d = startOfDay(range.start); d <= range.end; d = addDays(d, 1))
      keys.push(bucketKey(d, 'day'))
    return keys
  }
  if (granularity === 'week') {
    let d = startOfWeek(range.start, { weekStartsOn: 1 })
    const end = range.end
    while (d <= end) {
      keys.push(bucketKey(d, 'week'))
      d = addDays(d, 7)
    }
    return keys
  }
  let d = startOfMonth(range.start)
  while (d <= range.end) {
    keys.push(bucketKey(d, 'month'))
    d = addMonths(d, 1)
  }
  return keys
}

export function formatRangeLabel(range: DateRange): string {
  return `${format(range.start, 'd MMM yyyy')} – ${format(range.end, 'd MMM yyyy')}`
}
