import { useState } from 'react'
import { useRenewMembership } from '@/lib/business-queries'
import { formatINR } from '@/lib/format'
import { notify } from '@/lib/notify'
import type { MembershipPlan } from '@/types/domain'
import { PLAN_AMOUNTS, PLAN_LABELS } from '@/types/domain'
import { Button } from '../ui/Button'
import { DatePicker } from '../ui/DatePicker'
import { Dialog, DialogContent } from '../ui/Dialog'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'netbanking', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

export function RenewDialog({
  open,
  onOpenChange,
  customer,
  defaultPlan,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  customer: { customer_id: string; full_name: string } | null
  defaultPlan?: MembershipPlan
  onDone?: () => void
}) {
  if (!customer) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <RenewForm
          key={`${customer.customer_id}-${defaultPlan ?? 'monthly'}`}
          customer={customer}
          defaultPlan={defaultPlan ?? 'monthly'}
          onClose={() => onOpenChange(false)}
          onDone={onDone}
        />
      ) : null}
    </Dialog>
  )
}

function RenewForm({
  customer,
  defaultPlan,
  onClose,
  onDone,
}: {
  customer: { customer_id: string; full_name: string }
  defaultPlan: MembershipPlan
  onClose: () => void
  onDone?: () => void
}) {
  const renew = useRenewMembership()
  const [plan, setPlan] = useState<MembershipPlan>(defaultPlan)
  const [start, setStart] = useState<Date | undefined>(() => new Date())
  const [amount, setAmount] = useState(() => PLAN_AMOUNTS[defaultPlan])
  const [paid, setPaid] = useState(() => PLAN_AMOUNTS[defaultPlan])
  const [method, setMethod] = useState('upi')

  function changePlan(v: string) {
    const p = v as MembershipPlan
    setPlan(p)
    setAmount(PLAN_AMOUNTS[p])
    setPaid(PLAN_AMOUNTS[p])
  }

  const balance = amount - paid
  const invalid = paid < 0 || paid > amount

  return (
    <DialogContent title={`Renew — ${customer.full_name}`} description="Extend expiry and issue a receipt">
      <div className="space-y-3.5">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">Plan</p>
          <Select
            value={plan}
            onValueChange={changePlan}
            options={Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">Start date</p>
          <DatePicker value={start} onChange={setStart} label="Start date" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">Amount (Rs)</span>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">Paid (Rs)</span>
            <Input
              type="number"
              min={0}
              value={paid}
              onChange={(e) => setPaid(Number(e.target.value))}
            />
          </label>
        </div>
        {invalid ? (
          <p className="text-[13px] text-danger">Paid amount must be between 0 and the plan amount.</p>
        ) : null}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">Method</p>
          <Select value={method} onValueChange={setMethod} options={METHODS} />
        </div>
        <div className="rounded-lg border border-line-subtle bg-app/60 px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-secondary">Balance</span>
            <span className="font-semibold text-ink">{formatINR(Math.max(0, balance))}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">Balance = Amount - Paid</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={renew.isPending}
            disabled={invalid || !start}
            onClick={() => {
              renew.mutate(
                {
                  customer_id: customer.customer_id,
                  plan,
                  start_at: (start ?? new Date()).toISOString().slice(0, 10),
                  amount,
                  paid,
                  method: method as 'upi',
                },
                {
                  onSuccess: () => {
                    notify.success('Membership renewed', `${customer.full_name} — ${PLAN_LABELS[plan]}`)
                    onClose()
                    onDone?.()
                  },
                },
              )
            }}
          >
            Confirm renewal
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
