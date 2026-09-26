import { motion } from 'motion/react'
import { ArrowLeft, NotebookPen, Pencil } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAddCustomerNote, useCustomer } from '@/lib/business-queries'
import { customersApi } from '@/api/services'
import { expiryLabel, formatDate, formatINR, formatMethod } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { notify } from '@/lib/notify'
import { ActivityTimeline } from '@/components/business/ActivityTimeline'
import { toTimelineEvents } from '@/lib/timeline'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { MembershipBadge, PaymentBadge, PlanBadge } from '@/components/ui/StatusBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { CustomerContactButtons } from '@/components/business/customer-actions'
import { PaymentDialog } from '@/components/business/PaymentDialog'
import { RenewDialog } from '@/components/business/RenewDialog'

export default function CustomerProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useCustomer(id)
  const [renewOpen, setRenewOpen] = React.useState(false)
  const [payOpen, setPayOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [note, setNote] = React.useState('')
  const addNote = useAddCustomerNote()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Customer not found"
            description="This profile may have been removed."
            onRetry={() => refetch()}
          />
          <div className="mt-2 text-center">
            <Link to="/customers">
              <Button variant="secondary">Back to customers</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { customer, memberships, payments, renewals, activities } = data
  const current = memberships[0]

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
          onClick={() => navigate('/customers')}
          className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Back to customers
        </button>
      </motion.div>

      <motion.div variants={staggerChild}>
        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={customer.full_name} className="size-14 text-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold text-ink">{customer.full_name}</h1>
                  <MembershipBadge status={customer.status} />
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-secondary">
                  {customer.phone}
                  {customer.email ? ` · ${customer.email}` : ''}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  Member since {formatDate(customer.joined_at)} · {customer.customer_id}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CustomerContactButtons phone={customer.phone} name={customer.full_name} />
                  <Button size="sm" onClick={() => setRenewOpen(true)}>
                    Renew
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setPayOpen(true)}>
                    Record payment
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                </div>
              </div>
              {current ? (
                <div className="grid shrink-0 grid-cols-3 gap-2 sm:w-64 sm:grid-cols-1 lg:grid-cols-3">
                  <Summary label="Plan" value={current.plan.replace('-', ' ')} />
                  <Summary
                    label="Expires"
                    value={formatDate(current.expires_at, 'd MMM')}
                    sub={expiryLabel(current.expires_at)}
                  />
                  <Summary label="Balance" value={formatINR(current.balance)} />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {current ? (
        <motion.div variants={staggerChild}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Membership summary</CardTitle>
                <CardDescription>Current plan and money position</CardDescription>
              </div>
              <PlanBadge plan={current.plan} />
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <Fact label="Plan" value={current.plan.replace('-', ' ')} />
                <Fact label="Start" value={formatDate(current.start_at)} />
                <Fact label="Expiry" value={formatDate(current.expires_at)} />
                <Fact label="Amount" value={formatINR(current.amount)} />
                <Fact label="Paid" value={formatINR(current.paid)} />
                <Fact label="Balance" value={formatINR(current.balance)} />
              </dl>
              <div className="mt-2.5">
                <PaymentBadge status={current.payment_state} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={staggerChild}>
        <Tabs defaultValue="payments">
          <TabsList aria-label="Customer detail">
            <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
            <TabsTrigger value="renewals">Renewals ({renewals.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="payments">
            <Card>
              <CardContent className="pt-4">
                {payments.length === 0 ? (
                  <EmptyState
                    title="No payments yet"
                    description="Record the first payment to start history."
                    action={
                      <Button size="sm" onClick={() => setPayOpen(true)}>
                        Record payment
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {payments.map((p) => (
                      <li
                        key={p.payment_id}
                        className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {formatINR(p.paid || p.amount)} · {formatMethod(p.method)}
                          </p>
                          <p className="text-xs text-ink-secondary">
                            {p.receipt_no} · {formatDate(p.received_at)}
                          </p>
                        </div>
                        <PaymentBadge status={p.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="renewals">
            <Card>
              <CardContent className="pt-4">
                {renewals.length === 0 ? (
                  <EmptyState
                    title="No renewals"
                    description="Renewals appear as expiry approaches."
                  />
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {renewals.map((r) => (
                      <li
                        key={r.renewal_id}
                        className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {r.plan.replace('-', ' ')} · {formatINR(r.amount)}
                          </p>
                          <p className="text-xs text-ink-secondary">
                            Due {formatDate(r.due_at)} · {expiryLabel(r.due_at)}
                          </p>
                        </div>
                        <MembershipBadge
                          status={
                            r.status === 'overdue'
                              ? 'expired'
                              : r.status === 'due-today'
                                ? 'expiring'
                                : 'active'
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="activity">
            <Card>
              <CardContent className="pt-4">
                <div className="mb-3 flex gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note — call outcome, preference…"
                    aria-label="Add a customer note"
                    className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                  />
                  <Button
                    size="sm"
                    className="h-10"
                    disabled={!note.trim()}
                    onClick={() => {
                      addNote.mutate(
                        { id: customer.customer_id, note: note.trim() },
                        {
                          onSuccess: () => {
                            setNote('')
                            notify.success('Note added', 'It now appears on the timeline.')
                          },
                        },
                      )
                    }}
                  >
                    <NotebookPen className="size-4" />
                    Add
                  </Button>
                </div>
                {activities.length === 0 ? (
                  <EmptyState
                    title="No activity yet"
                    description="Admissions, payments and renewals will appear here."
                  />
                ) : (
                  <ActivityTimeline events={toTimelineEvents(activities)} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      <RenewDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        customer={{ customer_id: customer.customer_id, full_name: customer.full_name }}
        defaultPlan={customer.plan}
      />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        customer={{ customer_id: customer.customer_id, full_name: customer.full_name }}
        defaultAmount={current?.balance || current?.amount}
        membership_id={current?.membership_id}
      />
      <EditCustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        key={`edit-${customer.customer_id}-${editOpen}`}
        customer={customer}
        onSaved={() => refetch()}
      />
    </motion.div>
  )
}

function EditCustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  customer: { customer_id: string; full_name: string; phone: string; email?: string; notes?: string }
  onSaved: () => void
}) {
  const [fullName, setFullName] = React.useState(customer.full_name)
  const [phone, setPhone] = React.useState(customer.phone)
  const [email, setEmail] = React.useState(customer.email ?? '')
  const [notes, setNotes] = React.useState(customer.notes ?? '')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function save() {
    if (fullName.trim().length < 2) {
      setError('Enter the customer name.')
      return
    }
    if (phone.trim().length < 6) {
      setError('Enter a valid phone number.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await customersApi.update(customer.customer_id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      notify.success('Customer updated', fullName.trim())
      onOpenChange(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent title="Edit customer" description="Update contact details and notes">
          <div className="space-y-3.5">
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-ink">Full name</p>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-ink">Phone</p>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-ink">Email</p>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-ink">Notes</p>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            {error ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button loading={saving} onClick={() => void save()}>
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line-subtle bg-app/50 px-2.5 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="truncate text-sm font-semibold text-ink capitalize">{value}</p>
      {sub ? <p className="truncate text-xs text-ink-secondary">{sub}</p> : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-app/50 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-ink capitalize">{value}</dd>
    </div>
  )
}
