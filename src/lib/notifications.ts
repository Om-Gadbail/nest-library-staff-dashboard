import type { NotificationItem } from '@/types/domain'

export function unreadCount(items: NotificationItem[] | undefined): number {
  return (items ?? []).filter((n) => !n.read && !n.dismissed).length
}
