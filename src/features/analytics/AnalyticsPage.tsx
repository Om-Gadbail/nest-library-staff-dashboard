import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { parseISO } from 'date-fns'
import {
  useBookings,
  useCustomers,
  useLeads,
  useMemberships,
  usePayments,
  useRenewals,
  useTasks,
} from '@/lib/business-queries'
import {
  bucketKey,
  bucketLabel,
  eachBucket,
  granularityFor,
  inRange,
  previousRange,
  rangeDays,
} from '@/lib/date-range'
import {
  calculateLeadConversionRate,
  calculateMembershipDistribution,
  calculateRenewalRate,
  calculateRevenue,
  comparePeriods,
  leadFunnel,
  leadSourceSplit,
  revenueByMethod,
  revenueByPlan,
  revenueByStatus,
} from '@/lib/analytics'
import { formatDate, formatINR, formatMethod, formatNumber, formatPlan } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { DateRangeSelector } from '@/components/analytics/DateRangeSelector'
import { useRangeFromUrl } from '@/hooks/useRangeFromUrl'
import {
  LazyBreakdownChart,
  LazyComparisonChart,
  LazyDonutChart,
  LazyRevenueChart,
} from '@/components/ui/charts-lazy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FilterBar } from '@/components/ui/FilterBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { cn } from '@/lib/utils'

function Delta({ percent }: { percent: number | null }) {
  if (percent === null)
    return <span className="text-xs text-ink-muted">Not enough data for comparison</span>
  const Icon = percent > 0 ? ArrowUpRight : percent < 0 ? ArrowDownRight : Minus
  const cls = percent > 0 ? 'text-success' : percent < 0 ? 'text-danger' : 'text-ink-muted'
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-semibold', cls)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {Math.abs(percent).toFixed(1)}% vs previous
    </span>
  )
}

export default function AnalyticsPage() {
  const { range } = useRangeFromUrl()
  const [params, setParams] = useSearchParams()
  const drillDay = params.get('day')
  const compareOn = params.get('compare') !== 'off'

  const paymentsQ = usePayments()
  const customersQ = useCustomers()
  const membershipsQ = useMemberships()
  const leadsQ = useLeads()
  const bookingsQ = useBookings()
  const tasksQ = useTasks()
  const renewalsQ = useRenewals()

  const payments = React.useMemo(() => paymentsQ.data ?? [], [paymentsQ.data])
  const customers = React.useMemo(() => customersQ.data ?? [], [customersQ.data])
  const memberships = React.useMemo(() => membershipsQ.data ?? [], [membershipsQ.data])
  const leads = React.useMemo(() => leadsQ.data ?? [], [leadsQ.data])
  const bookings = React.useMemo(() => bookingsQ.data ?? [], [bookingsQ.data])
  const tasks = React.useMemo(() => tasksQ.data ?? [], [tasksQ.data])
  const renewals = React.useMemo(() => renewalsQ.data ?? [], [renewalsQ.data])

  const loading = paymentsQ.isLoading || customersQ.isLoading || membershipsQ.isLoading

  const prev = React.useMemo(() => previousRange(range), [range])
  const g = granularityFor(range)

  const kpis = React.useMemo(() => calculateRevenue(payments, range), [payments, range])
  const prevKpis = React.useMemo(() => calculateRevenue(payments, prev), [payments, prev])
  const prevHasData = React.useMemo(
    () => payments.some((p) => inRange(p.received_at, prev)),
    [payments, prev],
  )
  const cmp = React.useMemo(
    () => comparePeriods(kpis.received, prevKpis.received, prevHasData),
    [kpis, prevKpis, prevHasData],
  )

  // Trend buckets derived from mock payments
  const trend = React.useMemo(() => {
    const keys = eachBucket(range, g)
    const sums = new Map<string, number>()
    for (const p of payments) {
      if (p.status === 'refunded' || !inRange(p.received_at, range)) continue
      const k = bucketKey(parseISO(p.received_at), g)
      sums.set(k, (sums.get(k) ?? 0) + p.paid)
    }
    return keys.map((k) => ({ day: bucketLabel(k, g), revenue: sums.get(k) ?? 0, date: k }))
  }, [payments, range, g])

  // Comparison overlay: align previous-period totals by index
  const comparison = React.useMemo(() => {
    const keys = eachBucket(range, g)
    const prevKeys = eachBucket(prev, granularityFor(prev))
    const cur = new Map<string, number>()
    const prv = new Map<string, number>()
    for (const p of payments) {
      if (p.status === 'refunded') continue
      const d = parseISO(p.received_at)
      if (inRange(p.received_at, range)) {
        const k = bucketKey(d, g)
        cur.set(k, (cur.get(k) ?? 0) + p.paid)
      } else if (inRange(p.received_at, prev)) {
        const k = bucketKey(d, granularityFor(prev))
        prv.set(k, (prv.get(k) ?? 0) + p.paid)
      }
    }
    const prevVals = prevKeys.map((k) => prv.get(k) ?? 0)
    return keys.map((k, i) => ({
      label: bucketLabel(k, g),
      current: cur.get(k) ?? 0,
      previous: prevVals[i] ?? 0,
    }))
  }, [payments, range, prev, g])

  const byMethod = React.useMemo(
    () =>
      revenueByMethod(payments, range).map((d) => ({ name: formatMethod(d.name), total: d.total })),
    [payments, range],
  )
  const byPlan = React.useMemo(
    () => revenueByPlan(payments, range).map((d) => ({ name: formatPlan(d.name), total: d.total })),
    [payments, range],
  )
  const byStatus = React.useMemo(() => revenueByStatus(payments, range), [payments, range])

  // Drill-down transactions
  const [q, setQ] = React.useState('')
  const [method, setMethod] = React.useState('all')
  const [page, setPage] = React.useState(0)
  const PAGE = 8
  const txns = React.useMemo(() => {
    const query = q.trim().toLowerCase()
    return payments
      .filter((p) => inRange(p.received_at, range))
      .filter((p) =>
        drillDay
          ? p.received_at.slice(0, 10) === drillDay ||
            bucketKey(parseISO(p.received_at), g) === drillDay
          : true,
      )
      .filter((p) => (method === 'all' ? true : p.method === method))
      .filter(
        (p) =>
          !query ||
          p.customer_name.toLowerCase().includes(query) ||
          p.receipt_no.toLowerCase().includes(query),
      )
      .sort((a, b) => +new Date(b.received_at) - +new Date(a.received_at))
  }, [payments, range, drillDay, method, q, g])
  const pages = Math.max(1, Math.ceil(txns.length / PAGE))
  const pageRows = txns.slice(page * PAGE, page * PAGE + PAGE)

  const updateQ = (v: string) => {
    setPage(0)
    setQ(v)
  }
  const updateMethod = (v: string) => {
    setPage(0)
    setMethod(v)
  }

  // Customer / membership / lead / ops summaries
  const newCustomers = customers.filter((c) => inRange(c.joined_at, range)).length
  const active = customers.filter((c) => c.status === 'active').length
  const expired = customers.filter((c) => c.status === 'expired').length
  const expiring = customers.filter((c) => c.status === 'expiring').length
  const renewalRate = calculateRenewalRate(memberships)
  const planMix = calculateMembershipDistribution(memberships)
  const funnel = leadFunnel(leads)
  const sources = leadSourceSplit(leads)
  const convRate = calculateLeadConversionRate(leads)
  const activeTasks = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'completed' && t.status !== 'archived',
  ).length
  const upcomingBookings = bookings.filter(
    (b) => b.status === 'scheduled' || b.status === 'confirmed' || b.status === 'pending',
  ).length
  const dueRenewals = renewals.filter((r) => r.status !== 'overdue').length

  const setDay = (day: string | null) => {
    setPage(0)
    const n = new URLSearchParams(params)
    if (day) n.set('day', day)
    else n.delete('day')
    setParams(n, { replace: true })
  }

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-4 sm:space-y-6"
    >
      <motion.div variants={staggerChild}>
        <PageHeader
          title="Analytics"
          description="What is happening in the business — derived live from transactions"
          actions={<DateRangeSelector />}
        />
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <motion.section
            variants={staggerChild}
            aria-label="Revenue summary"
            className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
          >
            <StatCard
              label="Revenue received"
              value={formatINR(kpis.received)}
              hint={<Delta percent={cmp.percent} />}
            />
            <StatCard
              label="Outstanding / due"
              value={formatINR(kpis.outstanding)}
              hint={`${formatNumber(txns.filter((t) => t.balance > 0).length)} open balances`}
            />
            <StatCard
              label="Expected (contracted)"
              value={formatINR(kpis.expected)}
              hint="Received + outstanding"
            />
            <StatCard
              label="Net received"
              value={formatINR(kpis.net)}
              hint={
                kpis.refunds > 0
                  ? `After ${formatINR(kpis.refunds)} refunds`
                  : 'No refunds in period'
              }
            />
            <StatCard
              label="Transactions"
              value={formatNumber(kpis.transactions)}
              hint={`${rangeDays(range)}-day window`}
            />
            <StatCard
              label="Average transaction"
              value={formatINR(Math.round(kpis.average))}
              hint="Received ÷ transactions"
            />
            <StatCard
              label="Active members"
              value={formatNumber(active)}
              hint={`${formatNumber(newCustomers)} new in period`}
            />
            <StatCard
              label="Renewal rate"
              value={`${renewalRate.toFixed(0)}%`}
              hint={`${formatNumber(dueRenewals)} upcoming renewals`}
            />
          </motion.section>

          {/* Primary revenue chart */}
          <motion.section variants={staggerChild}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Revenue trend · grouped by {g}</CardTitle>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const n = new URLSearchParams(params)
                        if (compareOn) n.set('compare', 'off')
                        else n.delete('compare')
                        setParams(n, { replace: true })
                      }}
                      aria-pressed={compareOn}
                      className={cn(
                        'h-8 cursor-pointer rounded-full border px-3 text-[13px] font-medium',
                        compareOn
                          ? 'border-brand bg-brand-soft text-brand-ink'
                          : 'border-line text-ink-secondary',
                      )}
                    >
                      Compare with previous
                    </button>
                  </div>
                </div>
                {!prevHasData && compareOn ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    Not enough data for comparison in the previous period.
                  </p>
                ) : null}
              </CardHeader>
              <CardContent>
                {trend.every((t) => t.revenue === 0) ? (
                  <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-secondary">
                    No revenue in this period yet.
                  </p>
                ) : compareOn && prevHasData ? (
                  <>
                    <div
                      className="mb-2 flex items-center gap-4 text-xs text-ink-secondary"
                      aria-hidden="true"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-5 bg-brand" />
                        Current period
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-0 w-5 border-t-2 border-dashed border-ink-muted" />
                        Previous period
                      </span>
                    </div>
                    <LazyComparisonChart data={comparison} height={240} />
                  </>
                ) : (
                  <LazyRevenueChart data={trend} height={240} />
                )}
                {/* Bucket drill-down */}
                <div
                  className="mt-3 flex flex-wrap gap-1.5"
                  aria-label="Drill into a day or period"
                >
                  {trend
                    .filter((t) => t.revenue > 0)
                    .slice(0, 12)
                    .map((t) => (
                      <button
                        key={t.date}
                        type="button"
                        onClick={() => setDay(drillDay === t.date ? null : t.date)}
                        aria-pressed={drillDay === t.date}
                        className={cn(
                          'h-8 cursor-pointer rounded-full border px-2.5 text-xs font-medium',
                          drillDay === t.date
                            ? 'border-brand bg-brand-soft text-brand-ink'
                            : 'border-line text-ink-secondary hover:text-ink',
                        )}
                      >
                        {t.day} · {formatINR(t.revenue)}
                      </button>
                    ))}
                  {drillDay ? (
                    <button
                      type="button"
                      onClick={() => setDay(null)}
                      className="h-8 cursor-pointer rounded-full border border-line px-2.5 text-xs font-medium text-ink-secondary"
                    >
                      Clear selection
                    </button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Breakdowns */}
          <motion.section variants={staggerChild} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by payment method</CardTitle>
              </CardHeader>
              <CardContent>
                {byMethod.length === 0 ? (
                  <p className="text-sm text-ink-secondary">No data in this period.</p>
                ) : (
                  <LazyBreakdownChart data={byMethod} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Revenue by membership plan</CardTitle>
              </CardHeader>
              <CardContent>
                {byPlan.length === 0 ? (
                  <p className="text-sm text-ink-secondary">No data in this period.</p>
                ) : (
                  <LazyBreakdownChart data={byPlan} />
                )}
              </CardContent>
            </Card>
          </motion.section>

          <motion.section variants={staggerChild} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>By transaction status</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-line-subtle">
                  {byStatus.length === 0 ? (
                    <li className="py-3 text-sm text-ink-secondary">No data.</li>
                  ) : (
                    byStatus.map((s) => (
                      <li key={s.name} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium text-ink capitalize">{s.name}</span>
                        <span className="text-ink-secondary">{formatINR(s.total)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Plan mix (members)</CardTitle>
              </CardHeader>
              <CardContent>
                <LazyDonutChart data={planMix} height={200} />
                <ul className="mt-2 space-y-1">
                  {planMix.map((p) => (
                    <li
                      key={p.name}
                      className="flex justify-between text-[13px] text-ink-secondary"
                    >
                      <span className="capitalize">{formatPlan(p.name)}</span>
                      <span className="font-semibold text-ink">{p.value}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Lead funnel · {convRate.toFixed(0)}% convert</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1.5">
                  {funnel.map((f) => (
                    <li key={f.stage} className="flex items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 font-medium text-ink capitalize">
                        {f.stage === 'follow-up' ? 'Follow-up' : f.stage}
                      </span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-app">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${leads.length ? (f.count / leads.length) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right font-semibold text-ink">
                        {f.count}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-ink-muted">
                  Top source: {sources[0]?.name ?? '—'} ({sources[0]?.total ?? 0})
                </p>
              </CardContent>
            </Card>
          </motion.section>

          {/* Transactions */}
          <motion.section variants={staggerChild}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>
                    Transactions
                    {drillDay ? ` · ${formatDate(drillDay)}` : ''}
                  </CardTitle>
                  <span className="text-xs text-ink-muted">
                    {txns.length} result{txns.length === 1 ? '' : 's'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <FilterBar
                  search={q}
                  onSearch={updateQ}
                  searchPlaceholder="Search customer or receipt…"
                  selects={[
                    {
                      label: 'Method',
                      value: method,
                      onChange: updateMethod,
                      options: [
                        { value: 'upi', label: 'UPI' },
                        { value: 'cash', label: 'Cash' },
                        { value: 'card', label: 'Card' },
                        { value: 'netbanking', label: 'Bank Transfer' },
                        { value: 'bank-transfer', label: 'Bank Transfer' },
                      ],
                    },
                  ]}
                  onReset={() => {
                    setQ('')
                    setMethod('all')
                    setDay(null)
                  }}
                />
                {pageRows.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-secondary">
                    No transactions match.
                  </p>
                ) : (
                  <>
                    <ul className="mt-3 space-y-2 md:hidden">
                      {pageRows.map((p) => (
                        <li key={p.payment_id} className="rounded-xl border border-line-subtle p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              to={`/customers/${p.customer_id}`}
                              className="truncate text-sm font-semibold text-ink hover:underline"
                            >
                              {p.customer_name}
                            </Link>
                            <span className="text-sm font-bold text-ink">{formatINR(p.paid)}</span>
                          </div>
                          <p className="mt-1 text-xs text-ink-secondary">
                            {formatDate(p.received_at)} · {p.plan ? formatPlan(p.plan) : 'Other'} ·{' '}
                            {formatMethod(p.method)} ·{' '}
                            <span className="capitalize">{p.status}</span>
                          </p>
                          {p.balance > 0 ? (
                            <p className="mt-0.5 text-xs font-medium text-warning">
                              {formatINR(p.balance)} still due
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 hidden overflow-x-auto rounded-xl border border-line-subtle md:block">
                      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-line-subtle bg-app/60">
                            {[
                              'Date',
                              'Customer',
                              'Plan',
                              'Type',
                              'Amount',
                              'Paid',
                              'Balance',
                              'Method',
                              'Status',
                            ].map((h) => (
                              <th
                                key={h}
                                scope="col"
                                className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pageRows.map((p) => (
                            <tr
                              key={p.payment_id}
                              className="border-b border-line-subtle last:border-0 hover:bg-app/50"
                            >
                              <td className="px-3 py-2.5 text-ink-secondary">
                                {formatDate(p.received_at)}
                              </td>
                              <td className="px-3 py-2.5">
                                <Link
                                  to={`/customers/${p.customer_id}`}
                                  className="font-medium text-ink hover:underline"
                                >
                                  {p.customer_name}
                                </Link>
                              </td>
                              <td className="px-3 py-2.5 text-ink-secondary">
                                {p.plan ? formatPlan(p.plan) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-ink-secondary">
                                {p.membership_id ? 'Admission/Renewal' : 'Other'}
                              </td>
                              <td className="px-3 py-2.5 text-ink">{formatINR(p.amount)}</td>
                              <td className="px-3 py-2.5 font-semibold text-ink">
                                {formatINR(p.paid)}
                              </td>
                              <td className="px-3 py-2.5 text-ink-secondary">
                                {formatINR(p.balance)}
                              </td>
                              <td className="px-3 py-2.5 text-ink-secondary">
                                {formatMethod(p.method)}
                              </td>
                              <td className="px-3 py-2.5 capitalize text-ink-secondary">
                                {p.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {pages > 1 ? (
                      <div className="mt-3 flex items-center justify-between">
                        <button
                          type="button"
                          disabled={page === 0}
                          onClick={() => setPage((x) => x - 1)}
                          className="h-9 cursor-pointer rounded-md border border-line px-3 text-sm font-medium text-ink disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <p className="text-xs text-ink-muted" aria-live="polite">
                          Page {page + 1} of {pages}
                        </p>
                        <button
                          type="button"
                          disabled={page + 1 >= pages}
                          onClick={() => setPage((x) => x + 1)}
                          className="h-9 cursor-pointer rounded-md border border-line px-3 text-sm font-medium text-ink disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.section>

          {/* Customers / memberships / ops */}
          <motion.section
            variants={staggerChild}
            className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
          >
            <StatCard
              label="New customers"
              value={formatNumber(newCustomers)}
              hint="Joined in period"
            />
            <StatCard
              label="Active / expiring / expired"
              value={`${active} / ${expiring} / ${expired}`}
              hint="Current snapshot"
            />
            <StatCard
              label="Bookings upcoming"
              value={formatNumber(upcomingBookings)}
              hint="Scheduled + confirmed"
            />
            <StatCard
              label="Open tasks"
              value={formatNumber(activeTasks)}
              hint="Across all staff"
            />
          </motion.section>
        </>
      )}
    </motion.div>
  )
}
