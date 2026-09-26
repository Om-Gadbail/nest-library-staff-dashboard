import { parseISO } from 'date-fns'
import type { Lead, Membership, Payment } from '@/types/domain'
import { bucketKey, eachBucket, granularityFor, inRange, type DateRange } from './date-range'

/**
 * Central business calculations. All analytics derive from the same
 * mock records (payments / memberships / leads) so numbers stay
 * consistent — never hardcode analytics separately.
 * Keep logic outside JSX; covered by unit tests.
 */

export interface RevenueKpis {
  received: number
  due: number
  outstanding: number
  expected: number
  refunds: number
  net: number
  transactions: number
  average: number
}

export function calculateRevenue(payments: Payment[], range: DateRange): RevenueKpis {
  const inScope = payments.filter((p) => inRange(p.received_at, range))
  const received = inScope.filter((p) => p.status !== 'refunded').reduce((s, p) => s + p.paid, 0)
  const due = inScope.reduce((s, p) => s + Math.max(0, p.balance), 0)
  const expected = inScope.filter((p) => p.status !== 'refunded').reduce((s, p) => s + p.amount, 0)
  const refunds = inScope.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.paid, 0)
  const sales = inScope.filter((p) => p.status !== 'refunded')
  const transactions = sales.length
  return {
    received,
    due,
    outstanding: due,
    expected,
    refunds,
    net: received - refunds,
    transactions,
    average: transactions > 0 ? received / transactions : 0,
  }
}

export function calculateOutstanding(payments: Payment[]): number {
  return payments.reduce((s, p) => s + Math.max(0, p.balance), 0)
}

export function calculateExpectedRevenue(payments: Payment[], range: DateRange): number {
  return payments
    .filter((p) => inRange(p.received_at, range) && p.status !== 'refunded')
    .reduce((s, p) => s + p.amount, 0)
}

export function calculateNetRevenue(payments: Payment[], range: DateRange): number {
  const inScope = payments.filter((p) => inRange(p.received_at, range))
  return (
    inScope.filter((p) => p.status !== 'refunded').reduce((s, p) => s + p.paid, 0) -
    inScope.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.paid, 0)
  )
}

export function calculateAverageTransaction(payments: Payment[], range: DateRange): number {
  const inScope = payments.filter((p) => inRange(p.received_at, range) && p.status !== 'refunded')
  if (inScope.length === 0) return 0
  return inScope.reduce((s, p) => s + p.paid, 0) / inScope.length
}

export interface TrendPoint {
  key: string
  label: string
  revenue: number
  previous?: number
  date: string
}

export function revenueTrend(
  payments: Payment[],
  range: DateRange,
  prev?: DateRange,
  labelFor?: (key: string) => string,
): TrendPoint[] {
  const g = granularityFor(range)
  const keys = eachBucket(range, g)
  const sums = new Map<string, number>()
  const prevSums = new Map<string, number>()
  for (const p of payments) {
    if (p.status === 'refunded') continue
    const d = parseISO(p.received_at)
    if (Number.isNaN(d.getTime())) continue
    if (inRange(p.received_at, range)) {
      const k = bucketKey(d, g)
      sums.set(k, (sums.get(k) ?? 0) + p.paid)
    } else if (prev && inRange(p.received_at, prev)) {
      // Align previous-period buckets by index offset for comparison overlay
      prevSums.set(bucketKey(d, g), (prevSums.get(bucketKey(d, g)) ?? 0) + p.paid)
    }
  }
  const prevValues = prev ? keys.map((_, i) => [...prevSums.values()][i] ?? 0) : []
  return keys.map((k, i) => ({
    key: k,
    label: labelFor ? labelFor(k) : k,
    revenue: sums.get(k) ?? 0,
    previous: prev ? (prevValues[i] ?? 0) : undefined,
    date: k,
  }))
}

export interface Comparison {
  current: number
  previous: number
  absolute: number
  percent: number | null
  direction: 'up' | 'down' | 'flat'
  hasData: boolean
}

export function comparePeriods(
  current: number,
  previous: number,
  hasPreviousData: boolean,
): Comparison {
  const absolute = current - previous
  const percent = previous !== 0 ? (absolute / Math.abs(previous)) * 100 : null
  return {
    current,
    previous,
    absolute,
    percent,
    direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
    hasData: hasPreviousData,
  }
}

export function breakdownBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    map.set(k, (map.get(k) ?? 0) + value(r))
  }
  return [...map.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
}

export function revenueByMethod(payments: Payment[], range: DateRange) {
  return breakdownBy(
    payments.filter((p) => inRange(p.received_at, range) && p.status !== 'refunded'),
    (p) => p.method,
    (p) => p.paid,
  )
}

export function revenueByPlan(payments: Payment[], range: DateRange) {
  return breakdownBy(
    payments.filter((p) => inRange(p.received_at, range) && p.status !== 'refunded' && p.plan),
    (p) => String(p.plan),
    (p) => p.paid,
  )
}

export function revenueByStatus(payments: Payment[], range: DateRange) {
  return breakdownBy(
    payments.filter((p) => inRange(p.received_at, range)),
    (p) => p.status,
    (p) => p.paid,
  )
}

export function calculateRenewalRate(memberships: Membership[]): number {
  if (memberships.length === 0) return 0
  // Renewed ≈ memberships beyond the first per customer
  const byCustomer = new Map<string, number>()
  for (const m of memberships)
    byCustomer.set(m.customer_id, (byCustomer.get(m.customer_id) ?? 0) + 1)
  const renewed = [...byCustomer.values()].filter((n) => n > 1).length
  return (renewed / byCustomer.size) * 100
}

export function calculateLeadConversionRate(leads: Lead[]): number {
  if (leads.length === 0) return 0
  return (leads.filter((l) => l.stage === 'converted').length / leads.length) * 100
}

export function calculateMembershipDistribution(memberships: Membership[]) {
  return breakdownBy(
    memberships,
    (m) => m.plan,
    () => 1,
  ).map((d) => ({ name: d.name, value: d.total, amount: d.total }))
}

export function leadFunnel(leads: Lead[]) {
  const stages = ['new', 'contacted', 'interested', 'follow-up', 'converted', 'lost'] as const
  return stages.map((s) => ({ stage: s, count: leads.filter((l) => l.stage === s).length }))
}

export function leadSourceSplit(leads: Lead[]) {
  return breakdownBy(
    leads,
    (l) => l.source || 'Other',
    () => 1,
  )
}
