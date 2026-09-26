import { motion } from 'motion/react'
import { Plus, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import {
  useCreateStaff,
  useStaff,
  useUpdateStaffRole,
  useUpdateStaffStatus,
} from '@/lib/business-queries'
import { formatRelative } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { notify } from '@/lib/notify'
import type { StaffMember, StaffRole } from '@/types/domain'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

const ROLES: StaffRole[] = ['owner', 'admin', 'staff']

const PERMISSIONS: Record<StaffRole, string[]> = {
  owner: ['Everything — business, staff, settings, billing'],
  admin: ['Customers, admissions, renewals, payments, bookings, tasks, reports'],
  staff: ['Customers, bookings, tasks, lead follow-ups (no settings/staff changes)'],
}

function roleBadge(role: StaffRole) {
  return (
    <Badge
      tone={role === 'owner' ? 'warning' : role === 'admin' ? 'info' : 'neutral'}
      className="capitalize"
    >
      {role}
    </Badge>
  )
}

function statusBadge(status: StaffMember['status']) {
  return (
    <Badge
      tone={status === 'active' ? 'success' : status === 'invited' ? 'warning' : 'neutral'}
      className="capitalize"
    >
      {status}
    </Badge>
  )
}

function StaffCard({ m }: { m: StaffMember }) {
  const role = useUpdateStaffRole()
  const status = useUpdateStaffStatus()
  return (
    <article className="rounded-xl border border-line-subtle bg-surface p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <Avatar name={m.full_name} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{m.full_name}</p>
          <a
            href={`mailto:${m.email}`}
            className="truncate text-xs text-ink-secondary hover:text-ink hover:underline"
          >
            {m.email}
          </a>
        </div>
        <div className="flex flex-col items-end gap-1">
          {roleBadge(m.role)}
          {statusBadge(m.status)}
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {m.last_active_at ? `Active ${formatRelative(m.last_active_at)}` : 'Invite pending'}
        {typeof m.assigned_count === 'number' ? ` · ${m.assigned_count} assigned` : ''}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-secondary">
          Role
          <select
            value={m.role}
            aria-label={`Role for ${m.full_name}`}
            onChange={(e) =>
              role.mutate(
                { id: m.staff_id, role: e.target.value as StaffRole },
                {
                  onSuccess: () =>
                    notify.success('Role updated', `${m.full_name} is now ${e.target.value}.`),
                },
              )
            }
            className="h-9 cursor-pointer rounded-md border border-line bg-surface px-2 text-[13px] text-ink"
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="capitalize">
                {r}
              </option>
            ))}
          </select>
        </label>
        {m.status !== 'active' ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => status.mutate({ id: m.staff_id, status: 'active' })}
          >
            Activate
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => status.mutate({ id: m.staff_id, status: 'inactive' })}
          >
            Deactivate
          </Button>
        )}
      </div>
    </article>
  )
}

export default function StaffPage() {
  const { data, isLoading, isError, refetch } = useStaff()
  const create = useCreateStaff()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<StaffRole>('staff')

  const invite = () => {
    if (name.trim().length < 2 || !email.includes('@')) {
      notify.error('Check the details', 'Enter a name and a valid email.')
      return
    }
    create.mutate(
      { full_name: name.trim(), email: email.trim(), role },
      {
        onSuccess: () => {
          notify.success('Invite sent', `${name.trim()} invited as ${role}.`)
          setOpen(false)
          setName('')
          setEmail('')
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
        <PageHeader
          title="Staff"
          description="Who can access the dashboard and what they can do"
          actions={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Invite staff
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        <div className="flex gap-2 rounded-xl border border-warning-border bg-warning-soft px-3.5 py-3 text-[13px] text-warning">
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Server-enforced roles.</strong> Owner, admin and staff permissions are
            enforced by the API — restricted controls are hidden and blocked server-side.
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerChild}>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent>
              <ErrorState onRetry={() => refetch()} />
            </CardContent>
          </Card>
        ) : !data || data.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState title="No staff yet" description="Invite your first team member." />
            </CardContent>
          </Card>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.map((m) => (
                <li key={m.staff_id}>
                  <StaffCard m={m} />
                </li>
              ))}
            </ul>
            <div className="mt-4 overflow-hidden rounded-xl border border-line-subtle bg-surface">
              <p className="border-b border-line-subtle bg-app/60 px-4 py-2.5 text-[13px] font-semibold text-ink">
                What each role can do (enforced by the server)
              </p>
              <ul className="divide-y divide-line-subtle">
                {ROLES.map((r) => (
                  <li key={r} className="px-4 py-2.5 text-sm">
                    <span className="font-semibold text-ink capitalize">{r}</span>
                    <span className="block text-[13px] text-ink-secondary">
                      {PERMISSIONS[r][0]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent
            title="Invite staff"
            description="They'll appear as Invited until they join"
            className="sm:max-w-sm"
          >
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kavya Nair"
                  className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@nestlibrary.in"
                  inputMode="email"
                  className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="capitalize">
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button fullWidth onClick={invite} disabled={create.isPending}>
                  {create.isPending ? 'Sending…' : 'Send invite'}
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </motion.div>
  )
}
