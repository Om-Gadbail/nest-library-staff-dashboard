import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

export function formatINR(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return '₹0'
  if (opts?.compact && Math.abs(value) >= 100000) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function toDate(input: string | Date | undefined): Date | null {
  if (!input) return null
  const d = typeof input === 'string' ? parseISO(input) : input
  if (!isValid(d)) {
    const fallback = new Date(input)
    return isValid(fallback) ? fallback : null
  }
  return d
}

export function formatDate(input: string | Date | undefined, pattern = 'd MMM yyyy'): string {
  const d = toDate(input)
  if (!d) return '—'
  return format(d, pattern)
}

export function formatDateTime(input: string | Date | undefined): string {
  const d = toDate(input)
  if (!d) return '—'
  return format(d, 'd MMM · h:mm a')
}

export function formatTime(input: string | Date | undefined): string {
  const d = toDate(input)
  if (!d) return '—'
  return format(d, 'h:mm a')
}

export function formatRelative(input: string | Date | undefined): string {
  const d = toDate(input)
  if (!d) return '—'
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatPhone(phone: string): string {
  return phone.trim()
}

export function formatPlan(plan: string): string {
  return plan.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatMethod(method: string): string {
  const map: Record<string, string> = {
    upi: 'UPI',
    cash: 'Cash',
    card: 'Card',
    netbanking: 'Bank Transfer',
    'bank-transfer': 'Bank Transfer',
    other: 'Other',
  }
  return map[method] ?? method.toUpperCase()
}

export function daysUntil(dateIso: string, now = new Date()): number {
  const d = toDate(dateIso)
  if (!d) return 0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

export function expiryLabel(dateIso: string): string {
  const n = daysUntil(dateIso)
  if (n < 0) return `${Math.abs(n)}d overdue`
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  return `${n}d left`
}
