import * as React from 'react'
import type { CalView } from '@/components/calendar/CalendarView'

export function useCalendarCursor(initial?: Date) {
  const [cursor, setCursor] = React.useState(() => initial ?? new Date('2026-09-26T12:00:00'))
  const [view, setView] = React.useState<CalView>('week')
  return { cursor, setCursor, view, setView }
}
