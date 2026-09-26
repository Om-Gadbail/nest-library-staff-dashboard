import { describe, expect, it } from 'vitest'
import { endOfDay, startOfDay } from 'date-fns'
import type { Lead, Membership, Payment } from '@/types/domain'
import {
  breakdownBy,
  calculateAverageTransaction,
  calculateExpectedRevenue,
  calculateLeadConversionRate,
  calculateMembershipDistribution,
  calculateNetRevenue,
  calculateOutstanding,
  calculateRenewalRate,
  calculateRevenue,
  comparePeriods,
  leadFunnel,
  revenueByMethod,
  revenueByPlan,
  revenueByStatus,
  revenueTrend,
} from '@/lib/analytics'
import {
  eachBucket,
  granularityFor,
  inRange,
  previousRange,
  rangeDays,
  resolveRange,
} from '@/lib/date-range'

const NOW = new Date('2026-09-26T12:00:00')

const payments: Payment[] = [
  {
    payment_id: 'p-1',
    business_id: 'b',
    customer_id: 'c-1',
    customer_name: 'Asha',
    amount: 2000,
    paid: 2000,
    balance: 0,
    method: 'upi',
    status: 'paid',
    received_at: '2026-09-25T10:00:00',
    receipt_no: 'R-1',
  },
  {
    payment_id: 'p-2',
    business_id: 'b',
    customer_id: 'c-2',
    customer_name: 'Dev',
    amount: 5500,
    paid: 3000,
    balance: 2500,
    method: 'cash',
    status: 'partial',
    received_at: '2026-09-24T10:00:00',
    receipt_no: 'R-2',
  },
  {
    payment_id: 'p-3',
    business_id: 'b',
    customer_id: 'c-3',
    customer_name: 'Mira',
    amount: 2000,
    paid: 0,
    balance: 2000,
    method: 'card',
    status: 'pending',
    received_at: '2026-09-10T10:00:00',
    receipt_no: 'R-3',
  },
  {
    payment_id: 'p-4',
    business_id: 'b',
    customer_id: 'c-4',
    customer_name: 'Ravi',
    amount: 2000,
    paid: 2000,
    balance: 0,
    method: 'upi',
    status: 'refunded',
    received_at: '2026-09-25T11:00:00',
    receipt_no: 'R-4',
  },
]

describe('date-range system', () => {
  it('resolves presets around the anchor day', () => {
    expect(resolveRange('today', NOW).start).toEqual(startOfDay(NOW))
    expect(resolveRange('today', NOW).end).toEqual(endOfDay(NOW))
    const week = resolveRange('this-week', NOW)
    expect(week.start.getDay()).toBe(1) // Monday start
    const last7 = resolveRange('last-7', NOW)
    expect(rangeDays(last7)).toBe(7)
    expect(rangeDays(resolveRange('last-30', NOW))).toBe(30)
  })

  it('builds a previous equivalent period immediately before', () => {
    const cur = resolveRange('last-7', NOW)
    const prev = previousRange(cur)
    expect(rangeDays(prev)).toBe(7)
    expect(prev.end.getTime()).toBeLessThan(cur.start.getTime())
  })

  it('picks granularity by range length', () => {
    expect(granularityFor(resolveRange('last-7', NOW))).toBe('day')
    expect(granularityFor(resolveRange('last-90', NOW))).toBe('week')
    expect(granularityFor({ start: new Date('2025-01-01'), end: new Date('2026-09-26') })).toBe(
      'month',
    )
  })

  it('enumerates buckets without gaps', () => {
    const range = resolveRange('last-7', NOW)
    expect(eachBucket(range, 'day')).toHaveLength(7)
  })

  it('matches ISO timestamps within a range', () => {
    const range = resolveRange('last-30', NOW)
    expect(inRange('2026-09-25T10:00:00', range)).toBe(true)
    expect(inRange('2026-01-01T10:00:00', range)).toBe(false)
  })
})

describe('revenue calculations (derived from transactions)', () => {
  const range = resolveRange('last-30', NOW)

  it('keeps received / due / expected / refunds separate', () => {
    const k = calculateRevenue(payments, range)
    // paid rows only (refunded excluded from received)
    expect(k.received).toBe(5000)
    // all balances incl. refunded row? refunded row has 0 balance
    expect(k.due).toBe(4500)
    expect(k.outstanding).toBe(k.due)
    expect(k.expected).toBe(9500)
    expect(k.refunds).toBe(2000)
    expect(k.net).toBe(3000)
    expect(k.transactions).toBe(3)
    expect(k.average).toBeCloseTo(1666.67, 1)
  })

  it('scopes to the selected range', () => {
    const day = resolveRange('today', NOW)
    const k = calculateRevenue(payments, day)
    expect(k.transactions).toBe(0)
    expect(k.received).toBe(0)
    expect(k.average).toBe(0)
  })

  it('derives outstanding / expected / net / average helpers consistently', () => {
    expect(calculateOutstanding(payments)).toBe(4500)
    expect(calculateExpectedRevenue(payments, range)).toBe(9500)
    expect(calculateNetRevenue(payments, range)).toBe(3000)
    expect(calculateAverageTransaction(payments, range)).toBeCloseTo(1666.67, 1)
  })

  it('builds daily / weekly / monthly trends from the same records', () => {
    const trend = revenueTrend(payments, resolveRange('last-7', NOW), undefined, (k) => k)
    const total = trend.reduce((s, t) => s + t.revenue, 0)
    // 25th (2000, refunded excluded) + 24th (3000)
    expect(total).toBe(5000)
  })

  it('breaks down by method / plan / status without inventing values', () => {
    expect(revenueByMethod(payments, range)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'upi' }),
        expect.objectContaining({ name: 'cash' }),
      ]),
    )
    // Status breakdown shows exact values incl. refunded rows (kept visible,
    // while `received` excludes them) — nothing hidden, nothing invented.
    expect(revenueByStatus(payments, range).find((s) => s.name === 'refunded')).toEqual({
      name: 'refunded',
      total: 2000,
    })
    const withPlan: Payment[] = payments.map((p, i) => ({
      ...p,
      plan: (i % 2 === 0 ? 'quarterly' : 'monthly') as Payment['plan'],
    }))
    expect(revenueByPlan(withPlan, range)).toHaveLength(2)
  })

  it('compares periods with direction and handles zero baselines', () => {
    const c = comparePeriods(5000, 4000, true)
    expect(c.absolute).toBe(1000)
    expect(c.percent).toBeCloseTo(25)
    expect(c.direction).toBe('up')
    expect(comparePeriods(0, 0, false).hasData).toBe(false)
    expect(comparePeriods(100, 0, false).percent).toBeNull()
  })
})

describe('membership + lead calculations', () => {
  it('computes renewal rate from repeat memberships', () => {
    const ms = [
      { membership_id: 'm-1', customer_id: 'c-1' },
      { membership_id: 'm-2', customer_id: 'c-1' },
      { membership_id: 'm-3', customer_id: 'c-2' },
    ] as Membership[]
    expect(calculateRenewalRate(ms)).toBeCloseTo(50)
    expect(calculateRenewalRate([])).toBe(0)
  })

  it('distributes memberships by plan', () => {
    const ms = [{ plan: 'monthly' }, { plan: 'monthly' }, { plan: 'yearly' }] as Membership[]
    expect(calculateMembershipDistribution(ms)).toEqual(
      expect.arrayContaining([{ name: 'monthly', value: 2, amount: 2 }]),
    )
  })

  it('computes lead conversion and funnel integrity', () => {
    const leads = [
      { stage: 'new' },
      { stage: 'contacted' },
      { stage: 'converted' },
      { stage: 'converted' },
    ] as Lead[]
    expect(calculateLeadConversionRate(leads)).toBe(50)
    expect(calculateLeadConversionRate([])).toBe(0)
    const funnel = leadFunnel(leads)
    expect(funnel.reduce((s, f) => s + f.count, 0)).toBe(leads.length)
  })

  it('breaks down generically', () => {
    expect(
      breakdownBy(
        [
          { k: 'a', v: 2 },
          { k: 'a', v: 3 },
        ],
        (r) => r.k,
        (r) => r.v,
      ),
    ).toEqual([{ name: 'a', total: 5 }])
  })
})
