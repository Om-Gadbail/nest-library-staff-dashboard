import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { MessageCircle, NotebookPen, Phone, Plus, UserCheck } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import {
  useConvertLead,
  useCreateLead,
  useScheduleFollowUp,
  useUpdateLeadStage,
} from '@/lib/business-queries'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatDate, formatPlan } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { notify } from '@/lib/notify'
import {
  PLAN_AMOUNTS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type Lead,
  type LeadStage,
  type MembershipPlan,
} from '@/types/domain'
import { whatsappCustomer } from '@/components/business/customer-contact'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { FilterBar } from '@/components/ui/FilterBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { LeadStageBadge, PlanBadge } from '@/components/ui/StatusBadge'
import { useLeads } from '@/lib/business-queries'
import { cn } from '@/lib/utils'

const leadSchema = z.object({
  full_name: z.string().min(2, 'Enter the lead name'),
  phone: z.string().min(8, 'Enter a valid mobile number'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  source: z.string().min(1, 'Select a source'),
  interested_plan: z.string().optional(),
  assigned_to: z.string().optional(),
  notes: z.string().optional(),
  follow_up_at: z.string().optional(),
})

type LeadForm = z.infer<typeof leadSchema>

const SOURCES = ['Walk-in', 'Instagram', 'Google', 'Referral', 'Phone', 'Other']
const STAFF = ['Priya Sharma', 'Rahul Verma']

export function LeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const create = useCreateLead()
  const { register, handleSubmit, reset, formState } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
  })

  const submit = handleSubmit((v) => {
    create.mutate(
      {
        full_name: v.full_name,
        phone: v.phone,
        email: v.email || undefined,
        source: v.source,
        interested_plan: (v.interested_plan || undefined) as MembershipPlan | undefined,
        assigned_to: v.assigned_to || undefined,
        notes: v.notes || undefined,
        follow_up_at: v.follow_up_at || undefined,
      },
      {
        onSuccess: () => {
          notify.success('Lead captured', `${v.full_name} added to the pipeline.`)
          reset()
          onOpenChange(false)
        },
        onError: (e) => notify.error('Could not save lead', e.message),
      },
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent
          title="New lead"
          description="Capture an enquiry in seconds"
          className="sm:max-w-md"
        >
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Full name *</span>
                <input
                  {...register('full_name')}
                  placeholder="e.g. Ishaan Patel"
                  className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                />
                {formState.errors.full_name ? (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.full_name.message}
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Mobile *</span>
                <input
                  {...register('phone')}
                  placeholder="+91 …"
                  inputMode="tel"
                  className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                />
                {formState.errors.phone ? (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.phone.message}
                  </span>
                ) : null}
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Source *</span>
                <select
                  {...register('source')}
                  defaultValue=""
                  className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
                >
                  <option value="" disabled>
                    Select source
                  </option>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {formState.errors.source ? (
                  <span className="mt-1 block text-xs text-danger">
                    {formState.errors.source.message}
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Interested plan</span>
                <select
                  {...register('interested_plan')}
                  defaultValue=""
                  className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
                >
                  <option value="">Not sure yet</option>
                  {(['monthly', 'quarterly', 'half-yearly', 'yearly'] as const).map((p) => (
                    <option key={p} value={p}>
                      {formatPlan(p)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Assigned to</span>
                <select
                  {...register('assigned_to')}
                  defaultValue="Priya Sharma"
                  className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
                >
                  {STAFF.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Follow-up date</span>
                <input
                  {...register('follow_up_at')}
                  type="date"
                  className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink">Email (optional)</span>
              <input
                {...register('email')}
                placeholder="name@example.com"
                inputMode="email"
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink">Notes (optional)</span>
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="What are they looking for?"
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" fullWidth disabled={create.isPending}>
                {create.isPending ? 'Saving…' : 'Save lead'}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

export function FollowUpDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const schedule = useScheduleFollowUp()
  const [date, setDate] = React.useState('')
  if (!lead) return null
  return (
    <Dialog
      open={Boolean(lead)}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent
        title="Schedule follow-up"
        description={`${lead.full_name} · ${lead.phone}`}
        className="sm:max-w-sm"
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink">Follow-up date</span>
            <input
              type="date"
              value={date}
              min="2026-09-26"
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button
              fullWidth
              disabled={!date || schedule.isPending}
              onClick={() =>
                schedule.mutate(
                  { id: lead.lead_id, date },
                  {
                    onSuccess: () => {
                      notify.success('Follow-up scheduled', `${lead.full_name} — ${date}.`)
                      onClose()
                    },
                  },
                )
              }
            >
              {schedule.isPending ? 'Saving…' : 'Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ConvertDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const convert = useConvertLead()
  const navigate = useNavigate()
  const [plan, setPlan] = React.useState<MembershipPlan>(
    (lead?.interested_plan as MembershipPlan) ?? 'monthly',
  )
  const amount = PLAN_AMOUNTS[plan]
  const [paid, setPaid] = React.useState(amount)
  const pickPlan = (p: MembershipPlan) => {
    setPlan(p)
    setPaid(PLAN_AMOUNTS[p])
  }
  if (!lead) return null
  return (
    <Dialog
      open={Boolean(lead)}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent
        title="Convert to customer"
        description="Prefilled from the lead — complete membership & payment"
        className="sm:max-w-md"
      >
        <div className="rounded-lg border border-line-subtle bg-app/60 px-3 py-2.5 text-sm">
          <p className="font-semibold text-ink">{lead.full_name}</p>
          <p className="text-ink-secondary">
            {lead.phone}
            {lead.email ? ` · ${lead.email}` : ''}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Source: {lead.source}
            {lead.notes ? ` · ${lead.notes}` : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink">Plan</span>
            <select
              value={plan}
              onChange={(e) => pickPlan(e.target.value as MembershipPlan)}
              className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
            >
              {(Object.keys(PLAN_AMOUNTS) as MembershipPlan[]).map((p) => (
                <option key={p} value={p}>
                  {formatPlan(p)} — ₹{PLAN_AMOUNTS[p].toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink">Amount received (₹)</span>
            <input
              type="number"
              min={0}
              max={amount}
              value={paid}
              onChange={(e) => setPaid(Number(e.target.value))}
              className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink"
            />
          </label>
        </div>
        <p className="text-xs text-ink-muted">
          Admission creates customer + membership + payment + renewal + activity automatically.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            fullWidth
            disabled={convert.isPending}
            onClick={() =>
              convert.mutate(
                {
                  lead_id: lead.lead_id,
                  plan,
                  start_at: '2026-09-26',
                  amount,
                  paid,
                  method: 'upi',
                },
                {
                  onSuccess: (r) => {
                    notify.success('Lead converted', `${lead.full_name} is now a customer.`)
                    onClose()
                    navigate(`/customers/${r.customer.customer_id}`)
                  },
                },
              )
            }
          >
            {convert.isPending ? 'Converting…' : 'Convert & admit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LeadCard({
  lead,
  onFollowUp,
  onConvert,
}: {
  lead: Lead
  onFollowUp: (l: Lead) => void
  onConvert: (l: Lead) => void
}) {
  const navigate = useNavigate()
  const move = useUpdateLeadStage()
  return (
    <article className="rounded-xl border border-line-subtle bg-surface p-3 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(`/leads/${lead.lead_id}`)}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <span className="block truncate text-sm font-semibold text-ink hover:underline">
            {lead.full_name}
          </span>
          <span className="block truncate text-xs text-ink-secondary">{lead.phone}</span>
        </button>
        <LeadStageBadge stage={lead.stage} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
        <span className="rounded bg-app px-1.5 py-0.5">{lead.source}</span>
        {lead.interested_plan ? <PlanBadge plan={lead.interested_plan} /> : null}
        {lead.follow_up_at ? <span>Follow-up {formatDate(lead.follow_up_at)}</span> : null}
      </div>
      {lead.last_activity ? (
        <p className="mt-1.5 truncate text-xs text-ink-muted">{lead.last_activity}</p>
      ) : null}
      <div className="mt-2.5 flex gap-1.5">
        <a
          href={`tel:${lead.phone.replace(/\s/g, '')}`}
          aria-label={`Call ${lead.full_name}`}
          className="flex h-9 min-w-9 flex-1 cursor-pointer items-center justify-center rounded-md border border-line text-ink-secondary hover:text-ink"
        >
          <Phone className="size-4" />
        </a>
        <button
          type="button"
          aria-label={`WhatsApp ${lead.full_name}`}
          onClick={() => whatsappCustomer(lead.phone, lead.full_name)}
          className="flex h-9 min-w-9 flex-1 cursor-pointer items-center justify-center rounded-md border border-line text-ink-secondary hover:text-ink"
        >
          <MessageCircle className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`Schedule follow-up for ${lead.full_name}`}
          onClick={() => onFollowUp(lead)}
          className="flex h-9 min-w-9 flex-1 cursor-pointer items-center justify-center rounded-md border border-line text-ink-secondary hover:text-ink"
        >
          <NotebookPen className="size-4" />
        </button>
        {lead.stage !== 'converted' && lead.stage !== 'lost' ? (
          <Button size="sm" className="flex-1" onClick={() => onConvert(lead)}>
            <UserCheck className="size-4" />
            Convert
          </Button>
        ) : null}
      </div>
      <label className="mt-2 block">
        <span className="sr-only">Change status for {lead.full_name}</span>
        <select
          value={lead.stage}
          onChange={(e) => move.mutate({ id: lead.lead_id, stage: e.target.value as LeadStage })}
          className="h-9 w-full cursor-pointer rounded-md border border-line-subtle bg-app/60 px-2 text-[13px] text-ink-secondary"
        >
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
    </article>
  )
}

export default function LeadsPage() {
  const { data, isLoading, isError, refetch } = useLeads()
  const [search, setSearch] = React.useState('')
  const [source, setSource] = React.useState('all')
  const [mobileStage, setMobileStage] = React.useState<LeadStage | 'all'>('all')
  const [followUpFor, setFollowUpFor] = React.useState<Lead | null>(null)
  const [convertFor, setConvertFor] = React.useState<Lead | null>(null)
  const debounced = useDebouncedValue(search, 200)
  const [params, setParams] = useSearchParams()

  // Quick action (?new=1) deep-links into the create workflow; the param
  // is consumed when the dialog closes so the URL stays shareable.
  const [createOpen, setCreateOpen] = React.useState(() => params.get('new') === '1')
  const handleCreateOpen = (v: boolean) => {
    setCreateOpen(v)
    if (!v) {
      const n = new URLSearchParams(params)
      if (n.has('new')) {
        n.delete('new')
        setParams(n, { replace: true })
      }
    }
  }

  const rows = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return (data ?? []).filter((l) => {
      if (source !== 'all' && l.source !== source) return false
      if (!q) return true
      return (
        l.full_name.toLowerCase().includes(q) ||
        l.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      )
    })
  }, [data, debounced, source])

  const sources = React.useMemo(() => [...new Set((data ?? []).map((l) => l.source))], [data])

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-4 sm:space-y-5"
    >
      <motion.div variants={staggerChild}>
        <PageHeader
          title="Leads"
          description="Pipeline from first enquiry to converted member"
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New lead
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search name or mobile…"
          resultCount={rows.length}
          onReset={() => {
            setSearch('')
            setSource('all')
            setMobileStage('all')
          }}
          selects={[
            {
              label: 'Source',
              value: source,
              onChange: setSource,
              options: sources.map((s) => ({ value: s, label: s })),
            },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent>
              <ErrorState onRetry={() => refetch()} />
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                title="No leads found"
                description="Capture the next walk-in or phone enquiry."
                action={<Button onClick={() => setCreateOpen(true)}>New lead</Button>}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile: stage tabs + stacked cards */}
            <div className="lg:hidden">
              <div
                role="tablist"
                aria-label="Lead stages"
                className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
              >
                {(['all', ...LEAD_STAGES] as const).map((s) => {
                  const count = s === 'all' ? rows.length : rows.filter((l) => l.stage === s).length
                  return (
                    <button
                      key={s}
                      role="tab"
                      aria-selected={mobileStage === s}
                      type="button"
                      onClick={() => setMobileStage(s)}
                      className={cn(
                        'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap',
                        mobileStage === s
                          ? 'border-brand bg-brand-soft text-brand-ink'
                          : 'border-line bg-surface text-ink-secondary',
                      )}
                    >
                      {s === 'all' ? 'All' : LEAD_STAGE_LABELS[s]}
                      <span className="text-xs opacity-70">{count}</span>
                    </button>
                  )
                })}
              </div>
              <ul className="mt-3 space-y-2.5">
                {rows
                  .filter((l) => mobileStage === 'all' || l.stage === mobileStage)
                  .map((l) => (
                    <li key={l.lead_id}>
                      <LeadCard lead={l} onFollowUp={setFollowUpFor} onConvert={setConvertFor} />
                    </li>
                  ))}
              </ul>
            </div>

            {/* Desktop: Kanban (scrolls at lg, six-up at xl) */}
            <div className="hidden gap-3 overflow-x-auto pb-2 lg:flex xl:grid xl:grid-cols-6 xl:overflow-visible">
              {LEAD_STAGES.map((stage) => {
                const cards = rows.filter((l) => l.stage === stage)
                return (
                  <section
                    key={stage}
                    aria-label={`${LEAD_STAGE_LABELS[stage]} leads`}
                    className="w-64 shrink-0 rounded-xl border border-line-subtle bg-app/50 p-2 xl:w-auto xl:min-w-0"
                  >
                    <header className="flex items-center justify-between px-1.5 py-1">
                      <h2 className="text-[13px] font-semibold text-ink">
                        {LEAD_STAGE_LABELS[stage]}
                      </h2>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-secondary">
                        {cards.length}
                      </span>
                    </header>
                    <ul className="mt-1 space-y-2">
                      {cards.map((l) => (
                        <li key={l.lead_id}>
                          <LeadCard
                            lead={l}
                            onFollowUp={setFollowUpFor}
                            onConvert={setConvertFor}
                          />
                        </li>
                      ))}
                      {cards.length === 0 ? (
                        <li className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-xs text-ink-muted">
                          No leads
                        </li>
                      ) : null}
                    </ul>
                  </section>
                )
              })}
            </div>
          </>
        )}
      </motion.div>

      <LeadDialog open={createOpen} onOpenChange={handleCreateOpen} />
      <FollowUpDialog lead={followUpFor} onClose={() => setFollowUpFor(null)} />
      <ConvertDialog lead={convertFor} onClose={() => setConvertFor(null)} />
    </motion.div>
  )
}
