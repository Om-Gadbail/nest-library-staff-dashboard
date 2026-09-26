import { motion } from 'motion/react'
import { ArrowLeft, MessageCircle, NotebookPen, Phone, UserCheck } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAddLeadNote, useLead } from '@/lib/business-queries'
import { formatDate, formatPlan } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { notify } from '@/lib/notify'
import { LEAD_STAGE_LABELS, LEAD_STAGES, type LeadStage } from '@/types/domain'
import { useUpdateLeadStage } from '@/lib/business-queries'
import { ActivityTimeline } from '@/components/business/ActivityTimeline'
import { toTimelineEvents } from '@/lib/timeline'
import { whatsappCustomer } from '@/components/business/customer-contact'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { LeadStageBadge, PlanBadge } from '@/components/ui/StatusBadge'
import { ConvertDialog, FollowUpDialog } from './LeadsPage'

export default function LeadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useLead(id)
  const move = useUpdateLeadStage()
  const addNoteMutation = useAddLeadNote()
  const [followUp, setFollowUp] = React.useState(false)
  const [convert, setConvert] = React.useState(false)
  const [note, setNote] = React.useState('')

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <Card>
        <CardContent>
          <ErrorState title="Lead not found" onRetry={() => refetch()} />
        </CardContent>
      </Card>
    )
  }
  const { lead, activities } = data

  const saveNote = () => {
    if (!note.trim()) return
    addNoteMutation.mutate(
      { id: lead.lead_id, note: note.trim() },
      {
        onSuccess: () => {
          setNote('')
          notify.success('Note added', 'It now appears on the lead timeline.')
        },
      },
    )
  }

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-4 sm:space-y-5"
    >
      <motion.div variants={staggerChild}>
        <button
          type="button"
          onClick={() => navigate('/leads')}
          className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back to leads
        </button>
        <div className="mt-2">
          <PageHeader
            title={lead.full_name}
            description={`${lead.phone} · Source: ${lead.source}`}
            actions={
              <div className="flex gap-2">
                <a
                  href={`tel:${lead.phone.replace(/\s/g, '')}`}
                  aria-label={`Call ${lead.full_name}`}
                  className="flex h-10 min-w-10 items-center justify-center rounded-md border border-line bg-surface px-2.5 text-ink-secondary hover:text-ink"
                >
                  <Phone className="size-4" />
                </a>
                <button
                  type="button"
                  aria-label={`WhatsApp ${lead.full_name}`}
                  onClick={() => whatsappCustomer(lead.phone, lead.full_name)}
                  className="flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-md border border-line bg-surface px-2.5 text-ink-secondary hover:text-ink"
                >
                  <MessageCircle className="size-4" />
                </button>
                {lead.stage !== 'converted' ? (
                  <Button onClick={() => setConvert(true)}>
                    <UserCheck className="size-4" />
                    Convert
                  </Button>
                ) : lead.converted_customer_id ? (
                  <Link to={`/customers/${lead.converted_customer_id}`}>
                    <Button>View customer</Button>
                  </Link>
                ) : null}
              </div>
            }
          />
        </div>
      </motion.div>

      <motion.div variants={staggerChild} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Lead details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-secondary">Status</dt>
                <dd>
                  <LeadStageBadge stage={lead.stage} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-secondary">Plan</dt>
                <dd>
                  {lead.interested_plan ? (
                    <PlanBadge plan={lead.interested_plan} />
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-secondary">Assigned</dt>
                <dd className="font-medium text-ink">{lead.assigned_to ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-secondary">Follow-up</dt>
                <dd className="font-medium text-ink">
                  {lead.follow_up_at ? formatDate(lead.follow_up_at) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-secondary">Created</dt>
                <dd className="text-ink">{formatDate(lead.created_at)}</dd>
              </div>
              {lead.email ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-secondary">Email</dt>
                  <dd className="truncate font-medium text-ink">{lead.email}</dd>
                </div>
              ) : null}
            </dl>
            {lead.interested_plan ? (
              <p className="mt-2 text-xs text-ink-muted">
                Interested in {formatPlan(lead.interested_plan)}.
              </p>
            ) : null}
            <label className="mt-3 block">
              <span className="mb-1 block text-[13px] font-medium text-ink">Change status</span>
              <select
                value={lead.stage}
                onChange={(e) =>
                  move.mutate({ id: lead.lead_id, stage: e.target.value as LeadStage })
                }
                className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
              >
                {LEAD_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              fullWidth
              className="mt-2"
              onClick={() => setFollowUp(true)}
            >
              <NotebookPen className="size-4" />
              Schedule follow-up
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes & activity</CardTitle>
          </CardHeader>
          <CardContent>
            {lead.notes ? (
              <p className="rounded-lg border border-line-subtle bg-app/60 px-3 py-2.5 text-sm whitespace-pre-line text-ink-secondary">
                {lead.notes}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note — call outcome, preference…"
                aria-label="Add a note"
                className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
              />
              <Button onClick={saveNote} disabled={!note.trim()}>
                Add
              </Button>
            </div>
            <div className="mt-4">
              <ActivityTimeline
                events={toTimelineEvents(activities)}
                emptyLabel="No activity recorded for this lead yet"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {followUp ? <FollowUpDialog lead={lead} onClose={() => setFollowUp(false)} /> : null}
      {convert ? <ConvertDialog lead={lead} onClose={() => setConvert(false)} /> : null}
    </motion.div>
  )
}
