import { format } from 'date-fns'
import { motion } from 'motion/react'
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarCheck,
  IndianRupee,
  Phone,
  Timer,
  UserRoundPlus,
  Users,
  Wallet,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { useBusiness } from '@/app/use-business'
import { useUIStore } from '@/app/store'
import { useGreeting } from '@/hooks/useGreeting'
import {
  useActivities,
  useDashboard,
  useConfirmRenewal,
  useMemberships,
  useOps,
  usePayments,
  useRenewals,
  useRevenue,
} from '@/lib/business-queries'
import { expiryLabel, formatDate, formatINR, formatNumber } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { useAuth } from '@/features/auth/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader'
import { QuickActionsGrid } from '@/components/ui/QuickActions'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/States'
import { LazyBarChart, LazyDonutChart, LazyRevenueChart } from '@/components/ui/charts-lazy'
import { MembershipBadge, PaymentBadge } from '@/components/ui/StatusBadge'
import { RenewDialog } from '@/components/business/RenewDialog'
import { whatsappCustomer } from '@/components/business/customer-contact'

const RANGE_TABS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
] as const

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const business = useBusiness()
  const greeting = useGreeting()
  const navigate = useNavigate()
  const setQuick = useUIStore((s) => s.setQuickActionsOpen)
  const [range, setRange] = React.useState<'today' | '7d' | '30d'>('7d')
  const [renewFor, setRenewFor] = React.useState<{ customer_id: string; full_name: string } | null>(null)

  const dash = useDashboard()
  const ops = useOps()
  const revenue = useRevenue(range)
  const renewals = useRenewals()
  const memberships = useMemberships()
  const payments = usePayments()
  const activities = useActivities()
  const confirmRenewal = useConfirmRenewal()
  const { user } = useAuth()
  const firstName = user?.full_name?.split(' ')?.[0] ?? 'there'

  const today = format(new Date(), 'EEEE, d MMM yyyy')

  const planMix = React.useMemo(() => {
    const counts: Record<string, number> = {}
    const list = memberships.data ?? []
    list.forEach((m) => {
      if (m.status === 'expired') return
      counts[m.plan] = (counts[m.plan] ?? 0) + 1
    })
    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
      pct: Math.round((value / total) * 100),
    }))
  }, [memberships.data])

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="min-w-0 space-y-5 sm:space-y-6">
      {/* Greeting */}
      <motion.div variants={staggerChild}>
        <PageHeader
          title={`${greeting}, ${firstName}`}
          description={`${business.business_name} · ${today}`}
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate('/customers')}>
                View members
              </Button>
              <Link to="/admissions">
                <Button>
                  <UserRoundPlus className="size-4" />
                  New admission
                </Button>
              </Link>
            </>
          }
        />
      </motion.div>

      {/* KPI strip */}
      <motion.section variants={staggerChild} aria-label="Key metrics">
        {dash.isLoading ? (
          <KpiSkeleton />
        ) : dash.isError ? (
          <Card>
            <CardContent>
              <EmptyState title="Could not load metrics" description="Check your connection and retry." action={<Button variant="secondary" onClick={() => dash.refetch()}>Retry</Button>} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <KpiCard icon={IndianRupee} label="Today's revenue" value={formatINR(18450)} sub="+12.4% vs yesterday · demo" tone="text-success" />
            <KpiCard icon={Users} label="Total members" value={formatNumber(dash.data?.totalMembers ?? 196)} sub="+6 this week · demo" tone="text-success" />
            <KpiCard icon={UserRoundPlus} label="New leads" value={String(dash.data?.newLeads ?? 14)} sub="+3 today · demo" tone="text-success" />
            <KpiCard icon={Timer} label="Expiring soon" value={String(ops.data?.renewalsToday ?? 0 + 10)} sub="Next 7 days need follow-up" tone="text-warning" />
          </div>
        )}
      </motion.section>

      {/* Quick actions */}
      <motion.section variants={staggerChild} aria-label="Quick actions">
        <SectionHeader title="Quick actions" description="Start a front-desk workflow in one tap" className="mb-2.5" action={<Button variant="ghost" size="sm" onClick={() => setQuick(true)}>All actions</Button>} />
        <QuickActionsGrid compact />
      </motion.section>

      {/* Today's operations */}
      <motion.section variants={staggerChild} aria-label="Today's operations">
        <SectionHeader title="Today's operations" description="What needs attention right now" className="mb-2.5" />
        {ops.isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-6">
            <OpsCard label="Admissions" value={ops.data?.admissionsToday ?? 0} hint="today" onClick={() => navigate('/admissions')} />
            <OpsCard label="Renewals due" value={(ops.data?.renewalsToday ?? 0) + 4} hint="follow up first" urgent onClick={() => navigate('/renewals')} />
            <OpsCard label="Expired" value={(ops.data?.expired ?? 0) + 2} hint="win back" urgent onClick={() => navigate('/renewals?tab=expired')} />
            <OpsCard label="Pending payments" value={ops.data?.pendingPayments ?? 0} hint="collect" onClick={() => navigate('/payments')} />
            <OpsCard label="Bookings" value={ops.data?.bookingsToday ?? 0} hint="today" onClick={() => navigate('/dashboard')} />
            <OpsCard label="Follow-ups" value={ops.data?.followUps ?? 0} hint="leads" onClick={() => navigate('/dashboard')} />
          </div>
        )}
      </motion.section>

      {/* Revenue + mix */}
      <motion.section variants={staggerChild} className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Revenue overview</CardTitle>
              <CardDescription>
                {revenue.data ? `${formatINR(revenue.data.received)} received · ${formatINR(revenue.data.due)} due · ${formatINR(revenue.data.expected)} expected` : 'Received vs due vs expected'}
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-1 rounded-lg border border-line-subtle bg-app/60 p-1" role="tablist" aria-label="Revenue range">
              {RANGE_TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={range === t.key}
                  onClick={() => setRange(t.key)}
                  className={`h-8 cursor-pointer rounded-md px-3 text-[13px] font-medium transition-colors ${range === t.key ? 'bg-surface text-ink shadow-xs' : 'text-ink-secondary hover:text-ink'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {revenue.isLoading ? (
              <Skeleton className="h-[230px] w-full rounded-lg" />
            ) : revenue.data ? (
              <LazyRevenueChart data={revenue.data.points} height={230} />
            ) : (
              <EmptyState title="No revenue yet" description="Record a payment to see the trend." />
            )}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Mini label="Received" value={formatINR(revenue.data?.received ?? 0)} icon={BadgeIndianRupee} />
              <Mini label="Due" value={formatINR(revenue.data?.due ?? 0)} icon={Wallet} />
              <Mini label="Expected" value={formatINR(revenue.data?.expected ?? 0)} icon={CalendarCheck} />
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Membership mix</CardTitle>
              <CardDescription>Active plans by duration · demo</CardDescription>
            </div>
            <Link to="/memberships">
              <Button variant="ghost" size="sm">View all<ArrowRight className="size-4" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            <LazyDonutChart data={planMix.map((p) => ({ name: p.name, value: p.value }))} height={180} />
            <ul className="mt-3 space-y-1.5">
              {planMix.map((p, i) => (
                <li key={p.name} className="flex items-center gap-2 text-[13px]">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: ['#8a5a2b', '#a8a29e', '#57534e', '#b45309', '#15803d'][i % 5] }} />
                  <span className="truncate text-ink-secondary">{p.name}</span>
                  <span className="ml-auto font-semibold text-ink">{p.value} · {p.pct}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </motion.section>

      {/* Renewals preview */}
      <motion.section variants={staggerChild}>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Renewals needing attention</CardTitle>
              <CardDescription>Expiring today, tomorrow and overdue — act first</CardDescription>
            </div>
            <Link to="/renewals">
              <Button variant="ghost" size="sm">View all<ArrowRight className="size-4" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {renewals.isLoading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : (
              <>
                <ul className="space-y-2.5 md:hidden">
                  {(renewals.data ?? []).slice(0, 4).map((r) => (
                    <li key={r.renewal_id} className="rounded-xl border border-line-subtle bg-surface p-3.5 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.customer_name} className="size-9" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{r.customer_name}</p>
                          <p className="text-xs text-ink-secondary capitalize">{r.plan.replace('-', ' ')} · {expiryLabel(r.due_at)}</p>
                        </div>
                        <span className="text-sm font-semibold text-ink">{formatINR(r.amount)}</span>
                      </div>
                      <div className="mt-2.5 flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1" onClick={() => whatsappCustomer(r.customer_phone ?? '', r.customer_name)}>WhatsApp</Button>
                        <Button size="sm" className="flex-1" onClick={() => setRenewFor({ customer_id: r.customer_id, full_name: r.customer_name })}>Renew</Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto rounded-xl border border-line-subtle md:block">
                  <table className="w-full min-w-[640px] border-collapse bg-surface text-left text-sm">
                    <thead>
                      <tr className="border-b border-line-subtle bg-app/60">
                        <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Member</th>
                        <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Plan</th>
                        <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Expiry</th>
                        <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Status</th>
                        <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(renewals.data ?? []).slice(0, 5).map((r) => (
                        <tr key={r.renewal_id} className="border-b border-line-subtle last:border-0 hover:bg-app/50">
                          <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Avatar name={r.customer_name} className="size-7 text-xs" /><span className="font-medium text-ink">{r.customer_name}</span></div></td>
                          <td className="px-3 py-2.5"><MembershipBadge status={r.status === 'overdue' ? 'expired' : r.status === 'due-today' ? 'expiring' : 'active'} /></td>
                          <td className="px-3 py-2.5 text-ink-secondary">{formatDate(r.due_at)} · {expiryLabel(r.due_at)}</td>
                          <td className="px-3 py-2.5"><PaymentBadge status={r.status === 'overdue' ? 'failed' : 'pending'} /></td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-1.5">
                              <Button variant="secondary" size="sm" aria-label={`Call ${r.customer_name}`} onClick={() => { window.location.href = `tel:${(r.customer_phone ?? '').replace(/\s/g, '')}` }}><Phone className="size-4" /></Button>
                              <Button variant="secondary" size="sm" onClick={() => confirmRenewal.mutate({ id: r.renewal_id, status: 'confirmed' })}>Confirm</Button>
                              <Button size="sm" onClick={() => setRenewFor({ customer_id: r.customer_id, full_name: r.customer_name })}>Renew</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* Payments + activity */}
      <motion.section variants={staggerChild} className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div><CardTitle>Recent payments</CardTitle><CardDescription>Latest receipts issued</CardDescription></div>
            <Link to="/payments"><Button variant="ghost" size="sm">View all<ArrowRight className="size-4" /></Button></Link>
          </CardHeader>
          <CardContent className="pt-0">
            {payments.isLoading ? <Skeleton className="h-40 w-full rounded-lg" /> : (
              <ul className="divide-y divide-line-subtle">
                {(payments.data ?? []).slice(0, 5).map((p) => (
                  <li key={p.payment_id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={p.customer_name} className="size-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{p.customer_name}</p>
                      <p className="text-xs text-ink-secondary uppercase">{p.receipt_no} · {p.method} · {formatDate(p.received_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-ink">{formatINR(p.paid || p.amount)}</p>
                      <PaymentBadge status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div><CardTitle>Recent activity</CardTitle><CardDescription>Latest front-desk actions</CardDescription></div>
          </CardHeader>
          <CardContent className="pt-0">
            {activities.isLoading ? <Skeleton className="h-40 w-full rounded-lg" /> : (
              <ul className="divide-y divide-line-subtle">
                {(activities.data ?? []).slice(0, 6).map((a) => (
                  <li key={a.activity_id} className="flex min-w-0 gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Avatar name={a.actor} className="size-8 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink"><span className="font-medium">{a.actor}</span> <span className="text-ink-secondary">{a.action}</span></p>
                      {a.detail ? <p className="truncate text-[13px] text-ink-secondary">{a.detail}</p> : null}
                      <p className="mt-0.5 text-xs text-ink-muted">{formatDate(a.created_at, 'd MMM · h:mm a')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.section>

      {/* Revenue by method mini */}
      <motion.section variants={staggerChild}>
        <Card>
          <CardHeader>
            <div><CardTitle>Collections this week</CardTitle><CardDescription>Daily received amount · demo</CardDescription></div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/payments')}>Payments<ArrowRight className="size-4" /></Button>
          </CardHeader>
          <CardContent>
            <LazyBarChart data={(revenue.data?.points ?? []).slice(-7)} height={140} />
          </CardContent>
        </Card>
      </motion.section>

      <RenewDialog open={Boolean(renewFor)} onOpenChange={(v) => { if (!v) setRenewFor(null) }} customer={renewFor} />
    </motion.div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string; sub: string; tone: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-secondary">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink">{value}</p>
          <p className={`mt-1 text-xs font-medium ${tone}`}>{sub}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  )
}

function OpsCard({ label, value, hint, urgent, onClick }: { label: string; value: number; hint: string; urgent?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 cursor-pointer rounded-xl border border-line-subtle bg-surface p-3 text-left shadow-xs transition-all hover:border-line-strong hover:shadow-sm active:scale-[0.98]">
      <p className="truncate text-xs font-medium text-ink-secondary">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${urgent && value > 0 ? 'text-warning' : 'text-ink'}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{hint}</p>
    </button>
  )
}

function Mini({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="min-w-0 rounded-lg border border-line-subtle bg-app/50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-ink-secondary"><Icon className="size-3.5" />{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}
