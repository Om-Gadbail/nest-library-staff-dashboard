import { motion } from 'motion/react'
import * as React from 'react'
import { Link } from 'react-router'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useMemberships } from '@/lib/business-queries'
import { expiryLabel, formatDate, formatINR } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { FilterBar } from '@/components/ui/FilterBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { MembershipBadge, PaymentBadge, PlanBadge } from '@/components/ui/StatusBadge'
import { PaymentDialog } from '@/components/business/PaymentDialog'
import { RenewDialog } from '@/components/business/RenewDialog'

export default function MembershipsPage() {
  const { data, isLoading, isError, refetch } = useMemberships()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [plan, setPlan] = React.useState('all')
  const debounced = useDebouncedValue(search, 200)
  const [renewFor, setRenewFor] = React.useState<{ customer_id: string; full_name: string } | null>(null)
  const [payFor, setPayFor] = React.useState<{ customer_id: string; full_name: string; amount: number; membership_id: string } | null>(null)

  const rows = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return (data ?? []).filter((m) => {
      if (status !== 'all' && m.status !== status) return false
      if (plan !== 'all' && m.plan !== plan) return false
      if (!q) return true
      return m.customer_name.toLowerCase().includes(q) || m.membership_id.toLowerCase().includes(q)
    })
  }, [data, debounced, status, plan])

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="min-w-0 space-y-4 sm:space-y-5">
      <motion.div variants={staggerChild}>
        <PageHeader title="Memberships" description="Plans, expiry and money position" actions={<Link to="/admissions"><Button>New admission</Button></Link>} />
      </motion.div>
      <motion.div variants={staggerChild}>
        <FilterBar
          search={search} onSearch={setSearch} searchPlaceholder="Search member…" resultCount={rows.length}
          onReset={() => { setStatus('all'); setPlan('all'); setSearch('') }}
          selects={[
            { label: 'Status', value: status, onChange: setStatus, options: [{ value: 'active', label: 'Active' }, { value: 'expiring', label: 'Expiring' }, { value: 'expired', label: 'Expired' }] },
            { label: 'Plan', value: plan, onChange: setPlan, options: [{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'half-yearly', label: 'Half-yearly' }, { value: 'yearly', label: 'Yearly' }] },
          ]}
        />
      </motion.div>
      <motion.div variants={staggerChild}>
        {isLoading ? <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        : isError ? <Card><CardContent><ErrorState onRetry={() => refetch()} /></CardContent></Card>
        : rows.length === 0 ? <Card><CardContent><EmptyState title="No memberships" description="No plans match these filters." /></CardContent></Card>
        : (
          <>
            <ul className="space-y-2.5 md:hidden">
              {rows.map((m) => (
                <li key={m.membership_id} className="rounded-xl border border-line-subtle bg-surface p-3.5 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.customer_name} className="size-9" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{m.customer_name}</p><p className="text-xs text-ink-secondary">{m.membership_id} · {expiryLabel(m.expires_at)}</p></div>
                    <MembershipBadge status={m.status} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs"><PlanBadge plan={m.plan} /><PaymentBadge status={m.payment_state} /><span className="ml-auto font-semibold text-ink">{formatINR(m.paid)}/{formatINR(m.amount)}</span></div>
                  <div className="mt-2.5 flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => setPayFor({ customer_id: m.customer_id, full_name: m.customer_name, amount: m.balance, membership_id: m.membership_id })}>Payment</Button>
                    <Button size="sm" className="flex-1" onClick={() => setRenewFor({ customer_id: m.customer_id, full_name: m.customer_name })}>Renew</Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl border border-line-subtle md:block">
              <table className="w-full min-w-[820px] border-collapse bg-surface text-left text-sm">
                <thead><tr className="border-b border-line-subtle bg-app/60">
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Member</th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Plan</th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Period</th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Money</th>
                  <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Status</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-secondary">Actions</th>
                </tr></thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.membership_id} className="border-b border-line-subtle last:border-0 hover:bg-app/50">
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Avatar name={m.customer_name} className="size-7 text-xs" /><span className="font-medium text-ink">{m.customer_name}</span></div><span className="text-xs text-ink-muted">{m.membership_id}</span></td>
                      <td className="px-3 py-2.5"><PlanBadge plan={m.plan} /></td>
                      <td className="px-3 py-2.5 text-ink-secondary">{formatDate(m.start_at, 'd MMM')} → {formatDate(m.expires_at)}<span className="block text-xs text-ink-muted">{expiryLabel(m.expires_at)}</span></td>
                      <td className="px-3 py-2.5"><span className="font-medium text-ink">{formatINR(m.paid)}/{formatINR(m.amount)}</span><span className="block"><PaymentBadge status={m.payment_state} /></span></td>
                      <td className="px-3 py-2.5"><MembershipBadge status={m.status} /></td>
                      <td className="px-3 py-2.5"><div className="flex justify-end gap-1.5"><Button variant="secondary" size="sm" onClick={() => setPayFor({ customer_id: m.customer_id, full_name: m.customer_name, amount: m.balance, membership_id: m.membership_id })}>Payment</Button><Button size="sm" onClick={() => setRenewFor({ customer_id: m.customer_id, full_name: m.customer_name })}>Renew</Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>
      <RenewDialog open={Boolean(renewFor)} onOpenChange={(v) => { if (!v) setRenewFor(null) }} customer={renewFor} />
      <PaymentDialog open={Boolean(payFor)} onOpenChange={(v) => { if (!v) setPayFor(null) }} customer={payFor} defaultAmount={payFor?.amount} membership_id={payFor?.membership_id} />
    </motion.div>
  )
}
