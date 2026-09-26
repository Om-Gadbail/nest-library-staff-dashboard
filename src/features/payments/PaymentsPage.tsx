import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import * as React from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCustomers, usePayments, useRecordPayment } from '@/lib/business-queries'
import { formatDate, formatINR } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { notify } from '@/lib/notify'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { FilterBar } from '@/components/ui/FilterBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { LazyDonutChart } from '@/components/ui/charts-lazy'
import { MethodBadge, PaymentBadge, PlanBadge } from '@/components/ui/StatusBadge'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

export default function PaymentsPage() {
  const { data, isLoading, isError, refetch } = usePayments()
  const { data: customers } = useCustomers()
  const record = useRecordPayment()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [method, setMethod] = React.useState('all')
  const debounced = useDebouncedValue(search, 200)
  const [open, setOpen] = React.useState(false)
  const [customerId, setCustomerId] = React.useState('')
  const [amount, setAmount] = React.useState(2000)
  const [paid, setPaid] = React.useState(2000)
  const [payMethod, setPayMethod] = React.useState('upi')
  const effectiveCustomerId = customerId || customers?.[0]?.customer_id || ''

  const rows = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return (data ?? []).filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      if (method !== 'all' && p.method !== method) return false
      if (!q) return true
      return p.customer_name.toLowerCase().includes(q) || p.receipt_no.toLowerCase().includes(q)
    })
  }, [data, debounced, status, method])

  const totals = React.useMemo(() => {
    const list = (data ?? []).filter((p) => p.status !== 'refunded')
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfToday.getDay() + 6) % 7))
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const sum = (from: Date) =>
      list.filter((p) => new Date(p.received_at) >= from).reduce((s, p) => s + p.paid, 0)
    return {
      today: sum(startOfToday),
      week: sum(startOfWeek),
      month: sum(startOfMonth),
      outstanding: (data ?? []).reduce((s, p) => s + Math.max(0, p.balance), 0),
      expected: list.reduce((s, p) => s + p.amount, 0),
    }
  }, [data])

  const byMethod = React.useMemo(() => {
    const m: Record<string, number> = {}
    ;(data ?? []).forEach((p) => { m[p.method] = (m[p.method] ?? 0) + p.paid })
    return Object.entries(m).map(([name, value]) => ({ name: name.toUpperCase(), value }))
  }, [data])

  const byPlan = React.useMemo(() => {
    const m: Record<string, number> = {}
    ;(data ?? []).forEach((p) => { if (p.plan) m[p.plan] = (m[p.plan] ?? 0) + p.paid })
    return Object.entries(m).map(([k, v]) => ({ plan: k, amount: v }))
  }, [data])

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="min-w-0 space-y-4 sm:space-y-5">
      <motion.div variants={staggerChild}>
        <PageHeader title="Payments" description="Received vs due vs expected — every rupee accounted" actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" />Record payment</Button>} />
      </motion.div>

      <motion.div variants={staggerChild} className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Total label="Today" value={formatINR(totals.today)} />
        <Total label="This week" value={formatINR(totals.week)} />
        <Total label="This month" value={formatINR(totals.month)} />
        <Total label="Outstanding" value={formatINR(totals.outstanding)} alert />
        <Total label="Expected" value={formatINR(totals.expected)} />
      </motion.div>

      <motion.div variants={staggerChild} className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader><div><CardTitle>Revenue by method</CardTitle><CardDescription>Where money comes from</CardDescription></div></CardHeader>
          <CardContent>
            {byMethod.length === 0 ? <EmptyState title="No payments" description="Record a payment to see the mix." /> : <LazyDonutChart data={byMethod} height={190} />}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {byPlan.map((p) => (
                <div key={p.plan} className="rounded-lg bg-app/50 px-3 py-2.5"><p className="text-xs text-ink-secondary capitalize">{p.plan.replace('-', ' ')}</p><p className="text-sm font-semibold text-ink">{formatINR(p.amount)}</p></div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader><div><CardTitle>Paid vs pending</CardTitle><CardDescription>Collection health</CardDescription></div></CardHeader>
          <CardContent>
            <HealthBar paid={(data ?? []).filter((p) => p.status === 'paid').length} partial={(data ?? []).filter((p) => p.status === 'partial').length} pending={(data ?? []).filter((p) => p.status === 'pending').length} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerChild}>
        <FilterBar
          search={search} onSearch={setSearch} searchPlaceholder="Search member or receipt…" resultCount={rows.length}
          onReset={() => { setStatus('all'); setMethod('all'); setSearch('') }}
          selects={[
            { label: 'Status', value: status, onChange: setStatus, options: [{ value: 'paid', label: 'Paid' }, { value: 'partial', label: 'Partial' }, { value: 'pending', label: 'Pending' }, { value: 'refunded', label: 'Refunded' }] },
            { label: 'Method', value: method, onChange: setMethod, options: [{ value: 'upi', label: 'UPI' }, { value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }, { value: 'netbanking', label: 'Bank Transfer' }] },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        {isLoading ? <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        : isError ? <Card><CardContent><ErrorState onRetry={() => refetch()} /></CardContent></Card>
        : rows.length === 0 ? <Card><CardContent><EmptyState title="No payments found" description="Try different filters or record a payment." action={<Button onClick={() => setOpen(true)}>Record payment</Button>} /></CardContent></Card>
        : (
          <>
            <ul className="space-y-2.5 md:hidden">
              {rows.map((p) => (
                <li key={p.payment_id} className="rounded-xl border border-line-subtle bg-surface p-3.5 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.customer_name} className="size-9" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{p.customer_name}</p><p className="text-xs text-ink-secondary">{p.receipt_no} · {formatDate(p.received_at)}</p></div>
                    <div className="text-right"><p className="text-sm font-semibold text-ink">{formatINR(p.paid || p.amount)}</p><PaymentBadge status={p.status} /></div>
                  </div>
                  <div className="mt-2 flex gap-1.5"><MethodBadge method={p.method} />{p.plan ? <PlanBadge plan={p.plan} /> : null}{p.balance > 0 ? <span className="text-xs text-warning">Rs {p.balance} due</span> : null}</div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl border border-line-subtle md:block">
              <table className="w-full min-w-[760px] border-collapse bg-surface text-left text-sm">
                <thead><tr className="border-b border-line-subtle bg-app/60">
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Customer</th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Receipt</th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Method</th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Amount</th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Status</th>
                </tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.payment_id} className="border-b border-line-subtle last:border-0 hover:bg-app/50">
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Avatar name={p.customer_name} className="size-7 text-xs" /><span className="font-medium text-ink">{p.customer_name}</span></div></td>
                      <td className="px-3 py-2.5 text-ink-secondary">{p.receipt_no}<span className="block text-xs text-ink-muted">{formatDate(p.received_at)}</span></td>
                      <td className="px-3 py-2.5"><MethodBadge method={p.method} /></td>
                      <td className="px-3 py-2.5"><span className="font-semibold text-ink">{formatINR(p.paid || p.amount)}</span>{p.balance > 0 ? <span className="block text-xs text-warning">Rs {p.balance} due</span> : null}</td>
                      <td className="px-3 py-2.5"><PaymentBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent title="Record payment" description="Receipt is generated instantly">
            <div className="space-y-3.5">
              <div><p className="mb-1.5 text-[13px] font-semibold text-ink">Customer</p>
                <Select
                  value={customerId || (customers?.[0]?.customer_id ?? '')}
                  onValueChange={setCustomerId}
                  options={(customers ?? []).map((c) => ({ value: c.customer_id, label: `${c.full_name} — ${c.phone}` }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-ink">Amount</span><Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
                <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-ink">Paid</span><Input type="number" min={0} value={paid} onChange={(e) => setPaid(Number(e.target.value))} /></label>
              </div>
              <div><p className="mb-1.5 text-[13px] font-semibold text-ink">Method</p>
                <Select value={payMethod} onValueChange={setPayMethod} options={[{ value: 'upi', label: 'UPI' }, { value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }, { value: 'netbanking', label: 'Bank Transfer' }, { value: 'other', label: 'Other' }]} />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button loading={record.isPending} disabled={!effectiveCustomerId || paid < 0 || paid > amount} onClick={() => record.mutate({ customer_id: effectiveCustomerId, amount, paid, method: payMethod as 'upi' }, { onSuccess: () => { notify.success('Payment recorded', formatINR(paid)); setOpen(false) } })}>Save payment</Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </motion.div>
  )
}

function Total({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-line-subtle bg-surface p-3 shadow-xs sm:p-4">
      <p className="truncate text-xs font-medium text-ink-secondary">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl ${alert ? 'text-warning' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function HealthBar({ paid, partial, pending }: { paid: number; partial: number; pending: number }) {
  const total = Math.max(1, paid + partial + pending)
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-app" role="img" aria-label={`${paid} paid, ${partial} partial, ${pending} pending`}>
        <span className="bg-success" style={{ width: `${(paid / total) * 100}%` }} />
        <span className="bg-warning" style={{ width: `${(partial / total) * 100}%` }} />
        <span className="bg-danger" style={{ width: `${(pending / total) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex justify-between"><span className="text-ink-secondary">Paid</span><span className="font-semibold text-success">{paid}</span></li>
        <li className="flex justify-between"><span className="text-ink-secondary">Partial</span><span className="font-semibold text-warning">{partial}</span></li>
        <li className="flex justify-between"><span className="text-ink-secondary">Pending</span><span className="font-semibold text-danger">{pending}</span></li>
      </ul>
      <p className="mt-3 text-xs text-ink-muted">Paid = fully received. Partial = some balance left. Pending = nothing received yet.</p>
    </div>
  )
}
