import * as React from 'react'
import { useSearchParams } from 'react-router'
import { RANGE_PRESETS, resolveRange, type DateRange, type RangePreset } from '@/lib/date-range'

const DEMO_NOW = new Date('2026-09-26T12:00:00')

/**
 * Range state lives in URL query (?range=&from=&to=) so analytics
 * views are shareable, refresh-safe and back/forward friendly.
 */
export function useRangeFromUrl(): {
  preset: RangePreset
  range: DateRange
  from?: string
  to?: string
} {
  const [params] = useSearchParams()
  const raw = params.get('range') as RangePreset | null
  const preset: RangePreset = raw && RANGE_PRESETS.some((p) => p.value === raw) ? raw : 'last-30'
  const from = params.get('from') ?? undefined
  const to = params.get('to') ?? undefined
  const range = React.useMemo(
    () => resolveRange(preset, DEMO_NOW, { from, to }),
    [preset, from, to],
  )
  return { preset, range, from, to }
}

export { DEMO_NOW }
