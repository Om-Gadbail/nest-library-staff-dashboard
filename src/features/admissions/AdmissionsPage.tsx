import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CheckCircle2, PartyPopper } from 'lucide-react'
import * as React from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { useCreateAdmission } from '@/lib/business-queries'
import { formatDate, formatINR } from '@/lib/format'
import { prefersReducedMotion } from '@/lib/motion'
import { PLAN_AMOUNTS, PLAN_LABELS } from '@/types/domain'
import type { MembershipPlan } from '@/types/domain'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { DatePicker } from '@/components/ui/DatePicker'
import { Input, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Progress } from '@/components/ui/Progress'
import { Select } from '@/components/ui/Select'
import { admissionBalance, admissionSchema, type AdmissionFormValues } from './admission-schema'

type FormValues = AdmissionFormValues

const STEPS = ['Customer', 'Membership', 'Payment', 'Confirm'] as const

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'netbanking', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

export default function AdmissionsPage() {
  const navigate = useNavigate()
  const create = useCreateAdmission()
  const [step, setStep] = React.useState(0)
  const [done, setDone] = React.useState<null | {
    name: string
    plan: string
    paid: number
    expires: string
    customer_id: string
    membership_id: string
  }>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(admissionSchema) as unknown as Resolver<FormValues>,
    mode: 'onTouched',
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      notes: '',
      plan: 'monthly',
      start_at: new Date().toISOString().slice(0, 10),
      amount: PLAN_AMOUNTS.monthly,
      paid: PLAN_AMOUNTS.monthly,
      method: 'upi',
    },
  })

  // RHF watch() is non-memoizable by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const plan = form.watch('plan') as MembershipPlan
  const amount = form.watch('amount')
  const paid = form.watch('paid')

  React.useEffect(() => {
    form.setValue('amount', PLAN_AMOUNTS[plan])
    form.setValue('paid', PLAN_AMOUNTS[plan])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])

  const balance = admissionBalance(Number(amount) || 0, Number(paid) || 0)

  async function next() {
    const fields: (keyof FormValues)[][] = [
      ['full_name', 'phone', 'email'],
      ['plan', 'start_at', 'amount'],
      ['paid', 'method'],
      [],
    ]
    const ok = await form.trigger(fields[step])
    if (!ok) return
    if (step === 2 && Number(paid) > Number(amount)) {
      form.setError('paid', { message: 'Paid cannot exceed amount' })
      return
    }
    setStep((s) => Math.min(3, s + 1))
  }

  function submit(values: FormValues) {
    create.mutate(
      {
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        email: values.email?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        plan: values.plan,
        start_at: values.start_at,
        amount: Number(values.amount),
        paid: Number(values.paid),
        method: values.method,
      },
      {
        onSuccess: (res) => {
          setDone({
            name: res.customer.full_name,
            plan: res.membership.plan,
            paid: res.payment.paid,
            expires: res.membership.expires_at,
            customer_id: res.customer.customer_id,
            membership_id: res.membership.membership_id,
          })
        },
      },
    )
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <motion.span initial={{ scale: prefersReducedMotion ? 1 : 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex size-14 items-center justify-center rounded-2xl bg-success-soft text-success">
              <PartyPopper className="size-7" />
            </motion.span>
            <h1 className="mt-4 text-xl font-semibold text-ink">Admission created</h1>
            <p className="mt-1 text-sm text-ink-secondary">Customer, membership, payment and renewal were created together.</p>
            <div className="mt-5 flex w-full items-center gap-3 rounded-xl border border-line-subtle bg-app/50 p-4 text-left">
              <Avatar name={done.name} className="size-11" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{done.name}</p>
                <p className="text-[13px] text-ink-secondary capitalize">{done.plan.replace('-', ' ')} · {formatINR(done.paid)} paid</p>
                <p className="text-[13px] text-ink-secondary">Expires {formatDate(done.expires)}</p>
              </div>
              <CheckCircle2 className="ml-auto size-5 shrink-0 text-success" />
            </div>
            <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="secondary" onClick={() => navigate(`/customers/${done.customer_id}`)}>View customer</Button>
              <Button variant="secondary" onClick={() => navigate('/memberships')}>Membership</Button>
              <Button onClick={() => { setDone(null); setStep(0); form.reset(); create.reset() }}>New admission</Button>
            </div>
            <Link to="/dashboard" className="mt-3 text-[13px] font-medium text-ink-secondary hover:text-ink">Back to overview</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 sm:space-y-5">
      <PageHeader title="New admission" description="Customer, membership and payment in one calm flow" />
      <Card>
        <CardHeader>
          <div className="min-w-0 flex-1">
            <CardTitle>Step {step + 1} of 4 — {STEPS[step]}</CardTitle>
            <CardDescription>Demo mode — saves to the mock service, no backend yet</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Progress value={((step + 1) / 4) * 100} label={`Step ${step + 1} of 4`} />
          <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Admission progress">
            {STEPS.map((s, i) => (
              <li key={s} className={`truncate rounded-md px-2 py-1.5 text-center text-xs font-medium ${i === step ? 'bg-brand-soft text-brand-ink' : i < step ? 'bg-success-soft text-success' : 'bg-app text-ink-muted'}`}>{s}</li>
            ))}
          </ol>

          <form onSubmit={form.handleSubmit(submit)} className="mt-5">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -12 }} transition={{ duration: 0.18 }}>
                {step === 0 ? (
                  <div className="space-y-3.5">
                    <Field label="Full name" error={form.formState.errors.full_name?.message}>
                      <Input placeholder="e.g. Rahul Sharma" autoComplete="name" {...form.register('full_name')} />
                    </Field>
                    <Field label="Mobile" error={form.formState.errors.phone?.message}>
                      <Input placeholder="+91 98XXX XXXXX" inputMode="tel" autoComplete="tel" {...form.register('phone')} />
                    </Field>
                    <Field label="Email (optional)" error={form.formState.errors.email?.message}>
                      <Input placeholder="name@example.com" inputMode="email" {...form.register('email')} />
                    </Field>
                    <Field label="Notes (optional)">
                      <Textarea placeholder="Seat preference, ID proof, etc." {...form.register('notes')} />
                    </Field>
                  </div>
                ) : null}
                {step === 1 ? (
                  <div className="space-y-3.5">
                    <div>
                      <p className="mb-1.5 text-[13px] font-semibold text-ink">Plan</p>
                      <Select value={plan} onValueChange={(v) => form.setValue('plan', v as FormValues['plan'])} options={Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label: `${label} — ${formatINR(PLAN_AMOUNTS[value as MembershipPlan])}` }))} />
                      {form.formState.errors.plan ? <p className="mt-1 text-[13px] text-danger">{form.formState.errors.plan.message}</p> : null}
                    </div>
                    <Field label="Start date" error={form.formState.errors.start_at?.message}>
                      <DatePicker value={form.watch('start_at') ? new Date(form.watch('start_at')) : undefined} onChange={(d) => form.setValue('start_at', d ? d.toISOString().slice(0, 10) : '')} label="Start date" />
                    </Field>
                    <Field label="Plan amount (Rs)" error={form.formState.errors.amount?.message}>
                      <Input type="number" min={0} {...form.register('amount')} />
                    </Field>
                  </div>
                ) : null}
                {step === 2 ? (
                  <div className="space-y-3.5">
                    <Field label="Amount paid (Rs)" error={form.formState.errors.paid?.message}>
                      <Input type="number" min={0} {...form.register('paid')} />
                    </Field>
                    <div>
                      <p className="mb-1.5 text-[13px] font-semibold text-ink">Payment method</p>
                      <Select value={form.watch('method')} onValueChange={(v) => form.setValue('method', v as FormValues['method'])} options={METHODS} />
                    </div>
                    <div className="rounded-lg border border-line-subtle bg-app/60 px-3 py-2.5 text-sm">
                      <div className="flex justify-between"><span className="text-ink-secondary">Balance</span><span className="font-semibold text-ink">{formatINR(Math.max(0, balance))}</span></div>
                      <p className="mt-0.5 text-xs text-ink-muted">Balance = Amount - Paid</p>
                    </div>
                  </div>
                ) : null}
                {step === 3 ? (
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Summary label="Customer" value={form.watch('full_name')} sub={form.watch('phone')} />
                    <Summary label="Plan" value={(PLAN_LABELS[plan] ?? plan)} sub={`${formatINR(Number(amount) || 0)} · starts ${formatDate(form.watch('start_at'))}`} />
                    <Summary label="Paid" value={formatINR(Number(paid) || 0)} sub={form.watch('method').toUpperCase()} />
                    <Summary label="Balance" value={formatINR(Math.max(0, balance))} sub={balance === 0 ? 'Fully paid' : 'Due at desk'} />
                  </dl>
                ) : null}
              </motion.div>
            </AnimatePresence>

            {create.isError ? <p className="mt-3 text-[13px] text-danger">Could not save admission. Please retry.</p> : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                <ArrowLeft className="size-4" />Back
              </Button>
              {step < 3 ? (
                <Button type="button" onClick={next}>Continue<ArrowRight className="size-4" /></Button>
              ) : (
                <Button type="submit" loading={create.isPending}>Confirm admission</Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[13px] text-danger" role="alert">{error}</span> : null}
    </label>
  )
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line-subtle bg-app/50 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{value}</dd>
      {sub ? <dd className="truncate text-xs text-ink-secondary">{sub}</dd> : null}
    </div>
  )
}
