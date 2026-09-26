import { Badge } from './Badge'

export function MembershipBadge({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'success'
      : status === 'expiring'
        ? 'warning'
        : status === 'expired'
          ? 'danger'
          : 'neutral'
  return (
    <Badge tone={tone as 'success'} className="capitalize">
      {status}
    </Badge>
  )
}

export function PaymentBadge({ status }: { status: string }) {
  const tone =
    status === 'paid'
      ? 'success'
      : status === 'partial'
        ? 'warning'
        : status === 'pending'
          ? 'warning'
          : status === 'refunded'
            ? 'neutral'
            : status === 'failed'
              ? 'danger'
              : 'neutral'
  return (
    <Badge tone={tone as 'success'} className="capitalize">
      {status}
    </Badge>
  )
}

export function RenewalBadge({ status }: { status: string }) {
  const tone = status === 'overdue' ? 'danger' : status === 'due-today' ? 'warning' : 'info'
  const label = status === 'due-today' ? 'Due today' : status === 'overdue' ? 'Overdue' : 'Upcoming'
  return (
    <Badge tone={tone as 'info'} className="capitalize">
      {label}
    </Badge>
  )
}

export function PlanBadge({ plan }: { plan: string }) {
  return (
    <Badge tone="neutral" className="capitalize">
      {plan.replace(/-/g, ' ')}
    </Badge>
  )
}

export function MethodBadge({ method }: { method: string }) {
  const labels: Record<string, string> = {
    upi: 'UPI',
    cash: 'Cash',
    card: 'Card',
    netbanking: 'Bank Transfer',
    'bank-transfer': 'Bank Transfer',
    other: 'Other',
  }
  return <Badge tone="neutral">{labels[method] ?? method}</Badge>
}

export function LeadStageBadge({ stage }: { stage: string }) {
  const tone =
    stage === 'converted'
      ? 'success'
      : stage === 'lost'
        ? 'neutral'
        : stage === 'follow-up'
          ? 'warning'
          : stage === 'interested'
            ? 'info'
            : 'neutral'
  const label = stage === 'follow-up' ? 'Follow-up' : stage.charAt(0).toUpperCase() + stage.slice(1)
  return (
    <Badge tone={tone as 'success'} className="capitalize">
      {label}
    </Badge>
  )
}

export function BookingStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'success'
      : status === 'confirmed'
        ? 'info'
        : status === 'cancelled'
          ? 'danger'
          : status === 'no-show'
            ? 'danger'
            : 'warning'
  const label = status === 'no-show' ? 'No-show' : status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <Badge tone={tone as 'info'} className="capitalize">
      {label}
    </Badge>
  )
}

export function TaskStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'done' || status === 'completed'
      ? 'success'
      : status === 'in-progress'
        ? 'info'
        : status === 'waiting'
          ? 'warning'
          : status === 'archived'
            ? 'neutral'
            : 'neutral'
  const label =
    status === 'open' || status === 'todo'
      ? 'To Do'
      : status === 'in-progress'
        ? 'In Progress'
        : status === 'done' || status === 'completed'
          ? 'Completed'
          : status === 'waiting'
            ? 'Waiting'
            : 'Archived'
  return (
    <Badge tone={tone as 'success'} className="capitalize">
      {label}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === 'urgent'
      ? 'danger'
      : priority === 'high'
        ? 'warning'
        : priority === 'medium'
          ? 'info'
          : 'neutral'
  return (
    <Badge tone={tone as 'info'} className="capitalize">
      {priority}
    </Badge>
  )
}
