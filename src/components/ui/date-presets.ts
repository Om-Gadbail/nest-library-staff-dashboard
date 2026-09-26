import { subDays } from 'date-fns'
import type { DateRange } from '@daypicker/react'

export type PresetKey = 'today' | 'yesterday' | 'week' | 'last7' | 'last30' | 'month'

export const presetFns: Record<PresetKey, () => DateRange> = {
  today: () => ({ from: new Date(), to: new Date() }),
  yesterday: () => {
    const y = subDays(new Date(), 1)
    return { from: y, to: y }
  },
  week: () => ({ from: subDays(new Date(), new Date().getDay()), to: new Date() }),
  last7: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  last30: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  month: () => {
    const n = new Date()
    return { from: new Date(n.getFullYear(), n.getMonth(), 1), to: n }
  },
}

export const datePresets: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
]
