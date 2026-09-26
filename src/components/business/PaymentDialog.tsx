import { useState } from 'react'
import { useRecordPayment } from '@/lib/business-queries'
import { formatINR } from '@/lib/format'
import { notify } from '@/lib/notify'
import { Button } from '../ui/Button'
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

export function PaymentDialog({
  open,
  onOpenChange,
  customer,
  defaultAmount,
  membership_id,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  customer: { customer_id: string; full_name: string } | null
  defaultAmount?: number
  membership_id?: string
  onDone?: () => void
}) {
  if (!customer) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <PaymentForm
          key={`${customer.customer_id}-${defaultAmount ?? 2000}`}
          customer={customer}
          defaultAmount={defaultAmount ?? 2000}
          membership_id={membership_id}
          onClose={() => onOpenChange(false)}
          onDone={onDone}
        />
      ) : null}
    </Dialog>
  )
}

function PaymentForm({
  customer,
  defaultAmount,
  membership_id,
  onClose,
  onDone,
}: {
  customer: { customer_id: string; full_name: string }
  defaultAmount: number
  membership_id?: string
  onClose: () => void
  onDone?: () => void
}) {
  const record = useRecordPayment()
  const [amount, setAmount] = useState(defaultAmount)
  const [paid, setPaid] = useState(defaultAmount)
  const [method, setMethod] = useState('upi')

  const balance = amount - paid
  const invalid = paid < 0 || paid > amount || amount < 0

  return (
    <DialogContent title={`Record payment — ${customer.full_name}`} description="Issue a receipt instantly">
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">Amount (Rs)</span>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink">Paid (Rs)</span>
            <Input type="number" min={0} value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
          </label>
        </div>
        {invalid ? (
          <p className="text-[13px] text-danger">Paid must be between 0 and the amount.</p>
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
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={record.isPending}
            disabled={invalid}
            onClick={() => {
              record.mutate(
                { customer_id: customer.customer_id, membership_id, amount, paid, method: method as 'upi' },
                {
                  onSuccess: () => {
                    notify.success('Payment recorded', `${formatINR(paid)} from ${customer.full_name}`)
                    onClose()
                    onDone?.()
                  },
                },
              )
            }}
          >
            Save payment
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
