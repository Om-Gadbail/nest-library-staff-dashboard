import { motion } from 'motion/react'
import { Eye, Plus } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCustomers, useMemberships } from '@/lib/business-queries'
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
import { CustomerContactButtons } from '@/components/business/customer-actions'
import { PaymentDialog } from '@/components/business/PaymentDialog'
import { RenewDialog } from '@/components/business/RenewDialog'

export default function CustomersPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useCustomers()
  const { data: memberships } = useMemberships()
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [plan, setPlan] = React.useState('all')
  const [pay, setPay] = React.useState('all')
  const debounced = useDebouncedValue(search, 200)
  const [renewFor, setRenewFor] = React.useState<{ customer_id: string; full_name: string } | null>(null)
  const [payFor, setPayFor] = React.useState<{ customer_id: string; full_name: string; amount: number } | null>(null)

  const membershipByCustomer = React.useMemo(() => {
    const map = new Map<string, { payment_state: string; balance: number; amount: number; paid: number }>()
    for (const m of memberships ?? []) {
      if (!map.has(m.customer_id)) {
        map.set(m.customer_id, {
          payment_state: m.payment_state,
          balance: m.balance,
          amount: m.amount,
          paid: m.paid,
        })
      }
    }
    return map
  }, [memberships])

  const rows = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return (data ?? []).filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (plan !== 'all' && c.plan !== plan) return false
      if (pay !== 'all') {
        const m = membershipByCustomer.get(c.customer_id)
        if (!m || m.payment_state !== pay) return false
      }
      if (!q) return true
      return c.full_name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
    })
  }, [data, debounced, status, plan, pay, membershipByCustomer])

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="min-w-0 space-y-4 sm:space-y-5">
      <motion.div variants={staggerChild}>
        <PageHeader
          title="Customers"
          description="Member directory — search, filter and act in one tap"
          actions={
            <Link to="/admissions">
              <Button><Plus className="size-4" />New admission</Button>
            </Link>
          }
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search name or mobile…"
          resultCount={rows.length}
          onReset={() => { setStatus('all'); setPlan('all'); setPay('all'); setSearch('') }}
          selects={[
            { label: 'Status', value: status, onChange: setStatus, options: [{ value: 'active', label: 'Active' }, { value: 'expiring', label: 'Expiring' }, { value: 'expired', label: 'Expired' }] },
            { label: 'Plan', value: plan, onChange: setPlan, options: [{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'half-yearly', label: 'Half-yearly' }, { value: 'yearly', label: 'Yearly' }] },
            { label: 'Payment', value: pay, onChange: setPay, options: [{ value: 'paid', label: 'Paid' }, { value: 'partial', label: 'Partial' }, { value: 'pending', label: 'Pending' }] },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        {isLoading ? (
          <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : isError ? (
          <Card><CardContent><ErrorState onRetry={() => refetch()} /></CardContent></Card>
        ) : rows.length === 0 ? (
          <Card><CardContent><EmptyState title="No customers found" description="Try a different search or add a new admission." action={<Link to="/admissions"><Button>New admission</Button></Link>} /></CardContent></Card>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="space-y-2.5 md:hidden">
              {rows.map((c) => {
                const m = membershipByCustomer.get(c.customer_id)
                return (
                  <li key={c.customer_id} className="rounded-xl border border-line-subtle bg-surface p-3.5 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.full_name} className="size-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{c.full_name}</p>
                        <p className="truncate text-xs text-ink-secondary">{c.phone}</p>
                      </div>
                      <MembershipBadge status={c.status} />
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <PlanBadge plan={c.plan} />
                      {m ? <PaymentBadge status={m.payment_state} /> : null}
                      <span className="text-ink-muted">{c.expires_at ? `Exp ${formatDate(c.expires_at)} · ${expiryLabel(c.expires_at)}` : 'No active membership'}</span>
                      {m ? <span className="ml-auto font-semibold text-ink">{formatINR(m.balance)} due</span> : null}
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => navigate(`/customers/${c.customer_id}`)}><Eye className="size-4" />View</Button>
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => setPayFor({ customer_id: c.customer_id, full_name: c.full_name, amount: m?.balance ?? m?.amount ?? 2000 })}>Payment</Button>
                      <Button size="sm" className="flex-1" onClick={() => setRenewFor({ customer_id: c.customer_id, full_name: c.full_name })}>Renew</Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-line-subtle md:block">
              <table className="w-full min-w-[760px] border-collapse bg-surface text-left text-sm">
                <thead>
                  <tr className="border-b border-line-subtle bg-app/60">
                    <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Member</th>
                    <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Plan</th>
                    <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Expiry</th>
                    <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Payment</th>
                    <th scope="col" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Status</th>
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const m = membershipByCustomer.get(c.customer_id)
                    return (
                      <tr key={c.customer_id} className="border-b border-line-subtle last:border-0 hover:bg-app/50">
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => navigate(`/customers/${c.customer_id}`)} className="flex cursor-pointer items-center gap-2.5 text-left">
                            <Avatar name={c.full_name} className="size-8 text-xs" />
                            <span><span className="block font-medium text-ink hover:underline">{c.full_name}</span><span className="block text-xs text-ink-secondary">{c.phone}</span></span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5"><PlanBadge plan={c.plan} /></td>
                        <td className="px-3 py-2.5 text-ink-secondary">{c.expires_at ? formatDate(c.expires_at) : '—'}<span className="block text-xs text-ink-muted">{c.expires_at ? expiryLabel(c.expires_at) : 'No membership'}</span></td>
                        <td className="px-3 py-2.5">{m ? <div className="flex flex-col gap-1"><PaymentBadge status={m.payment_state} /><span className="text-xs text-ink-secondary">{formatINR(m.paid)}/{formatINR(m.amount)}</span></div> : '—'}</td>
                        <td className="px-3 py-2.5"><MembershipBadge status={c.status} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <CustomerContactButtons phone={c.phone} name={c.full_name} compact />
                            <Button variant="secondary" size="sm" onClick={() => navigate(`/customers/${c.customer_id}`)}>View</Button>
                            <Button size="sm" onClick={() => setRenewFor({ customer_id: c.customer_id, full_name: c.full_name })}>Renew</Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      <RenewDialog open={Boolean(renewFor)} onOpenChange={(v) => { if (!v) setRenewFor(null) }} customer={renewFor} />
      <PaymentDialog open={Boolean(payFor)} onOpenChange={(v) => { if (!v) setPayFor(null) }} customer={payFor} defaultAmount={payFor?.amount} />
    </motion.div>
  )
}
