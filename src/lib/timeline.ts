import type { Activity, ActivityKind } from '@/types/domain'

export interface TimelineEvent {
  id: string
  kind?: ActivityKind | string
  title: string
  description?: string
  actor?: string
  at: string
  linkLabel?: string
  onOpen?: () => void
}

export function toTimelineEvents(activities: Activity[]): TimelineEvent[] {
  return activities.map((a) => ({
    id: a.activity_id,
    kind: a.kind,
    title: `${a.actor} ${a.action}`,
    description: a.detail,
    actor: a.actor,
    at: a.created_at,
  }))
}
