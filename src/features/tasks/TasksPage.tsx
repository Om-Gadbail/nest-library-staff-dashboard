import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { CheckCircle2, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { z } from 'zod'
import {
  useArchiveTask,
  useCompleteTask,
  useCreateTask,
  useTasks,
  useUpdateTask,
} from '@/lib/business-queries'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatDate } from '@/lib/format'
import { staggerChild, staggerParent } from '@/lib/motion'
import { notify } from '@/lib/notify'
import type { Task, TaskPriority } from '@/types/domain'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { FilterBar } from '@/components/ui/FilterBar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PriorityBadge, TaskStatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/utils'

const schema = z.object({
  title: z.string().min(3, 'Describe the task'),
  assigned_to: z.string().optional(),
  priority: z.string().optional(),
  due_at: z.string().optional(),
  notes: z.string().optional(),
})

type Form = z.infer<typeof schema>

const STAFF = ['Priya Sharma', 'Rahul Verma']
const TODAY = '2026-09-26'

type Tab = 'today' | 'overdue' | 'upcoming' | 'mine' | 'completed'

function bucket(t: Task, tab: Tab): boolean {
  const done = t.status === 'done' || t.status === 'completed' || t.status === 'archived'
  if (tab === 'completed') return done
  if (done) return false
  if (tab === 'today') return (t.due_at ?? '') <= TODAY && (t.due_at ?? '') >= TODAY
  if (tab === 'overdue') return Boolean(t.due_at) && t.due_at! < TODAY
  if (tab === 'upcoming') return !t.due_at || t.due_at > TODAY
  if (tab === 'mine') return (t.assigned_to ?? t.assignee) === 'Priya Sharma'
  return true
}

export function TaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const create = useCreateTask()
  const { register, handleSubmit, reset, formState } = useForm<Form>({
    resolver: zodResolver(schema),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent
          title="New task"
          description="Assign follow-ups and front-desk work"
          className="sm:max-w-md"
        >
          <form
            onSubmit={handleSubmit((v) =>
              create.mutate(
                {
                  title: v.title,
                  assigned_to: v.assigned_to || 'Priya Sharma',
                  priority: (v.priority as TaskPriority) ?? 'medium',
                  due_at: v.due_at || undefined,
                  notes: v.notes || undefined,
                },
                {
                  onSuccess: () => {
                    notify.success('Task created', v.title)
                    reset()
                    onOpenChange(false)
                  },
                  onError: (e) => notify.error('Could not create task', e.message),
                },
              ),
            )}
            className="space-y-3"
          >
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink">Title *</span>
              <input
                {...register('title')}
                placeholder="e.g. Call back expiring members"
                className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
              />
              {formState.errors.title ? (
                <span className="mt-1 block text-xs text-danger">
                  {formState.errors.title.message}
                </span>
              ) : null}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Assign to</span>
                <select
                  {...register('assigned_to')}
                  defaultValue="Priya Sharma"
                  className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2 text-sm text-ink"
                >
                  {STAFF.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Priority</span>
                <select
                  {...register('priority')}
                  defaultValue="medium"
                  className="h-10 w-full cursor-pointer rounded-md border border-line bg-surface px-2 text-sm text-ink"
                >
                  {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                    <option key={p} value={p} className="capitalize">
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink">Due date</span>
                <input
                  {...register('due_at')}
                  type="date"
                  className="h-10 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink">Notes (optional)</span>
              <textarea
                {...register('notes')}
                rows={2}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" fullWidth disabled={create.isPending}>
                {create.isPending ? 'Saving…' : 'Create task'}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function TaskCard({ t }: { t: Task }) {
  const complete = useCompleteTask()
  const archive = useArchiveTask()
  const update = useUpdateTask()
  const done = t.status === 'done' || t.status === 'completed'
  const who = t.assigned_to ?? t.assignee
  return (
    <article
      className={cn(
        'rounded-xl border border-line-subtle bg-surface p-3.5 shadow-xs',
        done && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Reopen task: ${t.title}` : `Complete task: ${t.title}`}
          onClick={() =>
            done
              ? update.mutate({ id: t.task_id, patch: { status: 'open' } })
              : complete.mutate(t.task_id)
          }
          className={cn(
            'mt-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors',
            done
              ? 'border-success bg-success text-white'
              : 'border-line-strong text-transparent hover:border-success',
          )}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-semibold text-ink', done && 'line-through')}>{t.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={t.priority} />
            <TaskStatusBadge status={t.status} />
            {t.due_at ? (
              <span className="text-xs text-ink-muted">Due {formatDate(t.due_at)}</span>
            ) : null}
          </div>
          {t.notes ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-secondary">{t.notes}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            {who ? (
              <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
                <Avatar name={who} className="size-5 text-[9px]" />
                {who}
              </span>
            ) : null}
            {t.customer_name ? (
              <span className="truncate text-xs text-ink-muted">· {t.customer_name}</span>
            ) : null}
            <span className="ml-auto flex gap-1">
              {!done ? (
                <label className="flex items-center">
                  <span className="sr-only">Reassign {t.title}</span>
                  <select
                    value={who ?? ''}
                    onChange={(e) =>
                      update.mutate({ id: t.task_id, patch: { assigned_to: e.target.value } })
                    }
                    className="h-8 cursor-pointer rounded-md border border-line-subtle bg-app/60 px-1.5 text-xs text-ink-secondary"
                  >
                    {STAFF.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                aria-label={`Archive task: ${t.title}`}
                onClick={() => archive.mutate(t.task_id)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-app hover:text-ink"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

const TABS: { v: Tab; label: string }[] = [
  { v: 'today', label: 'Today' },
  { v: 'overdue', label: 'Overdue' },
  { v: 'upcoming', label: 'Upcoming' },
  { v: 'mine', label: 'My tasks' },
  { v: 'completed', label: 'Completed' },
]

export default function TasksPage() {
  const { data, isLoading, isError, refetch } = useTasks()
  const [params, setParams] = useSearchParams()
  const tab = ((params.get('tab') as Tab | null) ?? 'today') as Tab
  const [priority, setPriority] = React.useState('all')
  const [search, setSearch] = React.useState('')
  // Quick action (?new=1) deep-links into the create workflow.
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
  const debounced = useDebouncedValue(search, 200)

  const rows = React.useMemo(() => {
    const q = debounced.trim().toLowerCase()
    return (data ?? [])
      .filter((t) => bucket(t, TABS.some((x) => x.v === tab) ? tab : 'today'))
      .filter((t) => (priority === 'all' ? true : t.priority === priority))
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.customer_name ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
  }, [data, tab, priority, debounced])

  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-4 sm:space-y-5"
    >
      <motion.div variants={staggerChild}>
        <PageHeader
          title="Tasks"
          description="Today's queue, overdue work and follow-ups"
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New task
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        <div
          role="tablist"
          aria-label="Task views"
          className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {TABS.map((t) => {
            const count = (data ?? []).filter((x) => bucket(x, t.v)).length
            return (
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
                  'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap',
                  tab === t.v
                    ? 'border-brand bg-brand-soft text-brand-ink'
                    : 'border-line bg-surface text-ink-secondary',
                )}
              >
                {t.label}
                <span className="text-xs opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
      </motion.div>

      <motion.div variants={staggerChild}>
        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search tasks…"
          resultCount={rows.length}
          onReset={() => {
            setSearch('')
            setPriority('all')
          }}
          selects={[
            {
              label: 'Priority',
              value: priority,
              onChange: setPriority,
              options: [
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ],
            },
          ]}
        />
      </motion.div>

      <motion.div variants={staggerChild}>
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
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
                title="All clear"
                description="No tasks in this view. Create the next follow-up."
                action={<Button onClick={() => setCreateOpen(true)}>New task</Button>}
              />
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {rows.map((t) => (
              <li key={t.task_id}>
                <TaskCard t={t} />
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <TaskDialog open={createOpen} onOpenChange={handleCreateOpen} />
    </motion.div>
  )
}
