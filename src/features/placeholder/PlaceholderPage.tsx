import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Settings,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { allNav } from '@/config/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { DemoForm } from '@/components/forms/DemoForm'

const iconFallback: Record<string, LucideIcon> = {
  customers: Users,
  admissions: UserPlus,
  memberships: BookOpenCheck,
  renewals: ArrowLeftRight,
  leads: UsersRound,
  bookings: CalendarDays,
  payments: Wallet,
  analytics: BarChart3,
  tasks: ClipboardList,
  notifications: Bell,
  staff: CreditCard,
  settings: Settings,
}

const planned: Record<string, string[]> = {
  customers: ['Member directory + search', 'Profile with membership history', 'Responsive cards on mobile'],
  admissions: ['Admission → customer → membership → payment flow', 'Front-desk validation', 'Receipt on completion'],
  memberships: ['Plans & durations', 'Freeze / cancel handling', 'Expiry tracking'],
  renewals: ['Due-today + upcoming queues', 'Reminders', 'One-tap renew + receipt'],
  leads: ['Lead stages & follow-ups', 'Convert lead → customer', 'Source tracking'],
  bookings: ['Room & pod calendar', 'Conflict handling', 'Check-in flow'],
  payments: ['Record UPI / cash / card', 'Receipts & refunds', 'Settlement review'],
  analytics: ['Revenue trends', 'Plan mix & retention', 'Custom date ranges'],
  tasks: ['Front-desk task queue', 'Assignment & due dates', 'Completion tracking'],
  notifications: ['Renewal & payment alerts', 'Read / unread', 'Future WhatsApp hooks'],
  staff: ['Roles & access (UI only)', 'Activity visibility', 'Multi-business later'],
  settings: ['Business profile', 'Plans & pricing config', 'Feature flags'],
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function PlaceholderPage({ segment }: { segment: string }) {
  const nav = allNav.find((n) => n.to === `/${segment}`)
  const Icon = (nav?.icon ?? iconFallback[segment] ?? Users) as LucideIcon
  const title = nav?.label ?? titleCase(segment)
  const items = planned[segment] ?? ['List view', 'Detail view', 'Actions & history']

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title={title}
        description="This section is scaffolded in Step 1. Full workflows arrive in the next build stage."
        actions={
          <Link to="/dashboard">
            <Button variant="secondary">Back to overview</Button>
          </Link>
        }
      />
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-13 items-center justify-center rounded-2xl bg-sidebar p-3 text-ink-inverse">
            <Icon className="size-6" />
          </span>
          <Badge tone="brand" className="mt-4">
            Coming in the next build stage
          </Badge>
          <h2 className="mt-3 text-lg font-semibold text-ink">{title} foundation is ready</h2>
          <p className="mt-1 max-w-md text-sm text-ink-secondary">
            Routing, shell, permissions-ready API service and mock data are in place. The UI below
            shows what this section will include.
          </p>
          <ul className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {items.map((i) => (
              <li
                key={i}
                className="rounded-lg border border-line-subtle bg-app/50 px-3 py-2.5 text-[13px] text-ink-secondary"
              >
                {i}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {segment === 'settings' ? (
        <Card>
          <CardContent>
            <h3 className="text-[15px] font-semibold text-ink">Form foundation check</h3>
            <p className="mt-0.5 mb-4 text-[13px] text-ink-secondary">
              React Hook Form + Zod running inside the real shell — try submitting empty fields.
            </p>
            <DemoForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
