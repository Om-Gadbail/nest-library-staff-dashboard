import { motion } from 'motion/react'
import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useSettings, useUpdateSettings } from '@/lib/business-queries'
import { staggerChild, staggerParent } from '@/lib/motion'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { Switch } from '@/components/ui/Checkbox'
import { cn } from '@/lib/utils'

type Tab = 'business' | 'membership' | 'notifications' | 'whatsapp' | 'staff'

const TABS: { v: Tab; label: string }[] = [
  { v: 'business', label: 'Business' },
  { v: 'membership', label: 'Membership' },
  { v: 'notifications', label: 'Notifications' },
  { v: 'whatsapp', label: 'WhatsApp' },
  { v: 'staff', label: 'Staff & roles' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand'

export default function SettingsPage() {
  const { data, isLoading, isError, refetch } = useSettings()
  const [params, setParams] = useSearchParams()
  const tab = ((params.get('tab') as Tab | null) ?? 'business') as Tab

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-4 sm:space-y-5"
    >
      <motion.div variants={staggerChild}>
        <PageHeader title="Settings" description="Business profile, plans, reminders and access" />
      </motion.div>

      <motion.div variants={staggerChild}>
        <div
          role="tablist"
          aria-label="Settings sections"
          className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:hidden"
        >
          {TABS.map((t) => (
            <button
              key={t.v}
              role="tab"
              aria-selected={tab === t.v}
              type="button"
              onClick={() => {
                const n = new URLSearchParams(params)
                n.set('tab', t.v)
                setParams(n, { replace: true })
              }}
              className={cn(
                'h-9 shrink-0 cursor-pointer rounded-full border px-3 text-[13px] font-medium whitespace-nowrap',
                tab === t.v
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-ink-secondary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent>
            <ErrorState onRetry={() => refetch()} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          {/* Desktop side nav */}
          <nav aria-label="Settings sections" className="hidden lg:block">
            <ul className="space-y-1">
              {TABS.map((t) => (
                <li key={t.v}>
                  <button
                    type="button"
                    onClick={() => {
                      const n = new URLSearchParams(params)
                      n.set('tab', t.v)
                      setParams(n, { replace: true })
                    }}
                    aria-current={tab === t.v ? 'page' : undefined}
                    className={cn(
                      'w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium',
                      tab === t.v
                        ? 'bg-sidebar text-ink-inverse'
                        : 'text-ink-secondary hover:bg-app hover:text-ink',
                    )}
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            <SettingsPanels tab={tab} />
          </div>
        </div>
      )}
    </motion.div>
  )
}

type SettingsData = NonNullable<ReturnType<typeof useSettings>['data']>

function SettingsPanels({ tab }: { tab: Tab }) {
  const { data } = useSettings()
  const save = useUpdateSettings()
  const navigate = useNavigate()
  // Initialized once the query has data (this panel only renders then).
  const [draft, setDraft] = React.useState<Record<string, string | boolean>>(() => ({
    name: data?.name ?? '',
    phone: data?.phone ?? '',
    email: data?.email ?? '',
    address: data?.address ?? '',
    opening_hours: data?.opening_hours ?? '',
    renewal_reminders: data?.renewal_reminders ?? true,
    payment_reminders: data?.payment_reminders ?? true,
    lead_followups: data?.lead_followups ?? true,
    booking_reminders: data?.booking_reminders ?? true,
    reminder_timing: data?.reminder_timing ?? '1 day before',
  }))

  if (!data) return null
  const settings: SettingsData = data

  const set = (k: string, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }))

  const persist = (patch: Record<string, string | boolean>) => {
    save.mutate(patch as Parameters<typeof save.mutate>[0], {
      onSuccess: () => notify.success('Settings saved', 'Changes are live for this business.'),
      onError: (e) => notify.error('Could not save', e.message),
    })
  }

  return (
    <>
      {tab === 'business' ? (
        <Card>
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Business name">
                <input
                  value={String(draft.name ?? '')}
                  onChange={(e) => set('name', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={String(draft.phone ?? '')}
                  onChange={(e) => set('phone', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  value={String(draft.email ?? '')}
                  onChange={(e) => set('email', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Opening hours">
                <input
                  value={String(draft.opening_hours ?? '')}
                  onChange={(e) => set('opening_hours', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Address">
                <textarea
                  value={String(draft.address ?? '')}
                  onChange={(e) => set('address', e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                />
              </Field>
            </div>
            <Button className="mt-4" onClick={() => persist(draft)} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save business profile'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'membership' ? (
        <Card>
          <CardHeader>
            <CardTitle>Membership plans</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line-subtle">
              {[
                { plan: 'Monthly', duration: '1 month', price: '₹2,000' },
                { plan: 'Quarterly', duration: '3 months', price: '₹5,500' },
                { plan: 'Half-yearly', duration: '6 months', price: '₹10,000' },
                { plan: 'Yearly', duration: '12 months', price: '₹18,000' },
                { plan: 'Day pass', duration: '1 day', price: '₹200' },
              ].map((p) => (
                <li key={p.plan} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <span className="font-semibold text-ink">{p.plan}</span>
                    <span className="block text-xs text-ink-muted">{p.duration}</span>
                  </span>
                  <span className="font-semibold text-ink">{p.price}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-muted">
              Renewal rule: members enter the renewal queue 7 days before expiry. Plan pricing is
              managed by the owner.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'notifications' ? (
        <Card>
          <CardHeader>
            <CardTitle>Reminder preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(
                [
                  [
                    'renewal_reminders',
                    'Renewal reminders',
                    'Nudge staff before memberships expire',
                  ],
                  [
                    'payment_reminders',
                    'Payment reminders',
                    'Follow up on partial and pending balances',
                  ],
                  ['lead_followups', 'Lead follow-ups', 'Surface due follow-ups in tasks'],
                  [
                    'booking_reminders',
                    'Booking reminders',
                    'Confirm upcoming room and pod bookings',
                  ],
                ] as const
              ).map(([key, label, hint]) => (
                <li key={key} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium text-ink">{label}</span>
                    <span className="block text-xs text-ink-muted">{hint}</span>
                  </span>
                  <Switch
                    checked={Boolean(draft[key])}
                    onCheckedChange={(v) => {
                      set(key, v)
                      persist({ [key]: v })
                    }}
                    aria-label={label}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Field label="Reminder timing">
                <select
                  value={String(draft.reminder_timing ?? '')}
                  onChange={(e) => {
                    set('reminder_timing', e.target.value)
                    persist({ reminder_timing: e.target.value })
                  }}
                  className={cn(inputCls, 'cursor-pointer')}
                >
                  {['Same day', '1 day before', '3 days before', '7 days before'].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'whatsapp' ? (
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-line-subtle bg-app/60 px-3 py-2.5 text-sm">
              <span className="font-medium text-ink">Connection status</span>
              <span
                className={
                  settings.whatsapp_connected
                    ? 'font-semibold text-success'
                    : 'font-semibold text-warning'
                }
              >
                {settings.whatsapp_connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <p className="mt-3 text-[13px] font-medium text-ink">Message templates</p>
            <ul className="mt-1.5 space-y-1.5">
              {(settings.whatsapp_templates ?? []).map((t: string) => (
                <li
                  key={t}
                  className="rounded-lg border border-line-subtle bg-surface px-3 py-2 text-sm text-ink-secondary"
                >
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-muted">
              Connect a WhatsApp provider (Meta Cloud API) in the backend settings to enable
              automated reminders. Messages are only marked sent after the provider confirms
              delivery — the dashboard never fakes delivery status.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'staff' ? (
        <Card>
          <CardHeader>
            <CardTitle>Staff & roles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="rounded-lg border border-line-subtle px-3 py-2.5">
                <strong className="text-ink">Owner</strong>
                <span className="block text-ink-secondary">
                  Everything — business, staff, settings.
                </span>
              </li>
              <li className="rounded-lg border border-line-subtle px-3 py-2.5">
                <strong className="text-ink">Admin</strong>
                <span className="block text-ink-secondary">Operations, reports and renewals.</span>
              </li>
              <li className="rounded-lg border border-line-subtle px-3 py-2.5">
                <strong className="text-ink">Staff</strong>
                <span className="block text-ink-secondary">Day-to-day front-desk work.</span>
              </li>
            </ul>
            <Button variant="secondary" className="mt-3" onClick={() => navigate('/staff')}>
              Manage staff
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
