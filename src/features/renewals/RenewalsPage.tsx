import { motion } from 'motion/react'
import * as React from 'react'
import { useSearchParams } from 'react-router'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useMarkContacted, useRenewals } from '@/lib/business-queries'
import { expiryLabel, formatDate, formatINR } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { FilterBar } from '@/components/ui/FilterBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { MembershipBadge } from '@/components/ui/StatusBadge'
import { RenewDialog } from '@/components/business/RenewDialog'
import { whatsappCustomer } from '@/components/business/customer-contact'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'expired', label: 'Expired' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'renewed', label: 'Renewed' },
] as const

export default function RenewalsPage() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('tab') ?? 'all'
  const [tab, setTab] = React.useState(initial)
  const { data, isLoading, isError, refetch } = useRenewals()
  const mark = useMarkContacted()
  const [search, setSearch] = React.useState('')
  const debounced = useDebouncedValue(search, 200)
  const [renewFor, setRenewFor] = React.useState<{ customer_id: string; full_name: string } | null>(null)

  const rows = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return (data ?? []).filter((r) => {
      if (tab === 'today' && r.status !== 'due-today') return false
      if (tab === 'week' && !((r.days_remaining ?? 99) >= 0 && (r.days_remaining ?? 99) <= 7)) return false
      if (tab === 'expired' && r.status !== 'overdue') return false
      if (tab === 'contacted' && r.contact_status !== 'contacted') return false
      if (tab === 'renewed' && r.contact_status !== 'renewed') return false
      if (!q) return true
      return r.customer_name.toLowerCase().includes(q)
    })
  }, [data, debounced, tab])

  function changeTab(v: string) {
    setTab(v)
    setParams(v === 'all' ? {} : { tab: v }, { replace: true })
  }

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="min-w-0 space-y-4 sm:space-y-5">
      <motion.div variants={staggerChild}>
        <PageHeader title="Renewals" description="Due-today first — WhatsApp, call, renew in one tap" />
      </motion.div>
      <motion.div variants={staggerChild}>
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList aria-label="Renewal buckets" className="w-full justify-start overflow-x-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </motion.div>
      <motion.div variants={staggerChild}>
        <FilterBar
          search={search} onSearch={setSearch} searchPlaceholder="Search member…" resultCount={rows.length}
          onReset={() => setSearch('')}
          selects={[]}
        />
      </motion.div>
      <motion.div variants={staggerChild}>
        {isLoading ? <div className="space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        : isError ? <Card><CardContent><ErrorState onRetry={() => refetch()} /></CardContent></Card>
        : rows.length === 0 ? <Card><CardContent><EmptyState title={tab === 'expired' ? 'No expired memberships' : 'All caught up'} description={tab === 'expired' ? 'Expired renewals will appear here.' : 'No renewals in this bucket.'} /></CardContent></Card>
        : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.renewal_id} className={`rounded-xl border bg-surface p-3.5 shadow-xs sm:p-4 ${r.status === 'overdue' ? 'border-danger-border' : r.status === 'due-today' ? 'border-warning-border' : 'border-line-subtle'}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={r.customer_name} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{r.customer_name}</p>
                    <p className="truncate text-xs text-ink-secondary capitalize">{r.plan.replace('-', ' ')} · due {formatDate(r.due_at)} · {expiryLabel(r.due_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-ink">{formatINR(r.amount)}</p>
                    <MembershipBadge status={r.status === 'overdue' ? 'expired' : r.status === 'due-today' ? 'expiring' : 'active'} />
                  </div>
                </div>
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => whatsappCustomer(r.customer_phone ?? '', r.customer_name, `Hi ${r.customer_name}, your ${r.plan} membership expires ${formatDate(r.due_at)}. Renew at Nest Library.`)}>WhatsApp</Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => { window.location.href = `tel:${(r.customer_phone ?? '').replace(/\s/g, '')}` }}>Call</Button>
                  <Button variant="secondary" size="sm" className="flex-1" disabled={r.contact_status === 'contacted' || mark.isPending} onClick={() => mark.mutate(r.renewal_id)}>{r.contact_status === 'contacted' ? 'Contacted' : 'Mark contacted'}</Button>
                  <Button size="sm" className="flex-1" onClick={() => setRenewFor({ customer_id: r.customer_id, full_name: r.customer_name })}>Renew</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
      <RenewDialog open={Boolean(renewFor)} onOpenChange={(v) => { if (!v) setRenewFor(null) }} customer={renewFor} />
    </motion.div>
  )
}
