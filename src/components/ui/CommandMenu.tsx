import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { allNav } from '@/config/navigation'
import { queryKeys } from '@/lib/query-keys'
import { freshness } from '@/app/query-client'
import { fetchCustomer, useGlobalSearch } from '@/lib/business-queries'
import { prefersReducedMotion } from '@/lib/motion'
import { useUIStore } from '@/app/store'
import { QUICK_ACTIONS } from '@/config/quick-actions'
import { Skeleton } from './Skeleton'

/**
 * Global search (Cmd/Ctrl+K) across customers, leads, bookings and tasks.
 * Server-side via GET /search (debounced, paginated, business-scoped);
 * falls back to local data when the API is unreachable in dev/test.
 */

function useGroupedSearch(query: string) {
  const { data } = useGlobalSearch(query, 4)
  return React.useMemo(() => {
    const empty = { customers: [], leads: [], bookings: [], tasks: [] }
    if (!query.trim()) return empty
    return {
      customers: (data?.customers ?? []).map((c) => ({
        customer_id: c.id,
        full_name: c.name,
        phone: c.phone ?? '',
      })),
      leads: (data?.leads ?? []).map((l) => ({
        lead_id: l.id,
        full_name: l.name,
        stage: l.stage ?? '',
      })),
      bookings: (data?.bookings ?? []).map((b) => ({
        booking_id: b.id,
        title: b.title,
        customer_name: '',
      })),
      tasks: (data?.tasks ?? []).map((t) => ({
        task_id: t.id,
        title: t.title,
        priority: '',
      })),
    }
  }, [data, query])
}

export function CommandMenu() {
  const open = useUIStore((s) => s.commandOpen)
  const setOpen = useUIStore((s) => s.setCommandOpen)
  const setQuick = useUIStore((s) => s.setQuickActionsOpen)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = React.useState('')
  const debounced = useDebouncedValue(q, 180)
  // Derived "searching" state — no effect needed; skeleton shows while debouncing
  const searching = open && q !== debounced

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (useUIStore.getState().commandOpen) {
          setQ('')
        }
        setOpen(!useUIStore.getState().commandOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const go = (to: string, prefetch?: () => void) => {
    prefetch?.()
    setQ('')
    setOpen(false)
    navigate(to)
  }

  function close() {
    setQ('')
    setOpen(false)
  }

  const results = useGroupedSearch(debounced)
  const hasQuery = debounced.trim().length > 0
  const totalHits =
    results.customers.length +
    results.leads.length +
    results.bookings.length +
    results.tasks.length

  const itemCls =
    'mt-0.5 flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm text-ink aria-selected:bg-app'
  const groupCls = 'px-2 py-1.5 text-xs font-semibold text-ink-muted uppercase'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
          className="safe-top fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[12dvh]"
          onClick={close}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: prefersReducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              label="Global search across customers, leads, payments, bookings and tasks"
              className="[&_[cmdk-input]]:!border-0"
            >
              <div className="border-b border-line-subtle">
                <Command.Input
                  autoFocus
                  value={q}
                  onValueChange={setQ}
                  placeholder="Search customers, leads, receipts, bookings, tasks…"
                  className="h-12 w-full bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
              <Command.List
                className="max-h-[50dvh] overflow-y-auto p-1.5"
                aria-label="Search results"
              >
                {searching && hasQuery ? (
                  <div className="space-y-2 p-2" aria-label="Searching">
                    <Skeleton className="h-9 w-full rounded-md" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                ) : (
                  <>
                    <Command.Empty className="px-3 py-8 text-center text-sm text-ink-secondary">
                      {hasQuery
                        ? `No results for “${debounced.trim()}”. Try a member, receipt, room or task.`
                        : 'Type to search across the workspace.'}
                    </Command.Empty>
                    {results.customers.length > 0 ? (
                      <Command.Group heading="Customers" className={groupCls}>
                        {results.customers.map((c) => (
                          <Command.Item
                            key={c.customer_id}
                            value={`customer ${c.full_name} ${c.phone}`}
                            onSelect={() =>
                              go(`/customers/${c.customer_id}`, () =>
                                qc.prefetchQuery({
                                  queryKey: queryKeys.customer(c.customer_id),
                                  queryFn: () => fetchCustomer(c.customer_id),
                                  staleTime: freshness.customer,
                                }),
                              )
                            }
                            className={itemCls}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {c.full_name}{' '}
                              <span className="text-ink-muted">· {c.phone}</span>
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    ) : null}
                    {results.leads.length > 0 ? (
                      <Command.Group heading="Leads" className={groupCls}>
                        {results.leads.map((l) => (
                          <Command.Item
                            key={l.lead_id}
                            value={`lead ${l.full_name}`}
                            onSelect={() => go(`/leads/${l.lead_id}`)}
                            className={itemCls}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {l.full_name}{' '}
                              {l.stage ? (
                                <span className="text-ink-muted">· {l.stage}</span>
                              ) : null}
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    ) : null}
                    {results.bookings.length > 0 ? (
                      <Command.Group heading="Bookings" className={groupCls}>
                        {results.bookings.map((b) => (
                          <Command.Item
                            key={b.booking_id}
                            value={`booking ${b.title}`}
                            onSelect={() => go('/bookings')}
                            className={itemCls}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {b.title} <span className="text-ink-muted">· {b.customer_name}</span>
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    ) : null}
                    {results.tasks.length > 0 ? (
                      <Command.Group heading="Tasks" className={groupCls}>
                        {results.tasks.map((t) => (
                          <Command.Item
                            key={t.task_id}
                            value={`task ${t.title}`}
                            onSelect={() => go('/tasks')}
                            className={itemCls}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {t.title} <span className="text-ink-muted">· {t.priority}</span>
                            </span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    ) : null}
                    {!hasQuery || totalHits === 0 ? (
                      <>
                        <Command.Group heading="Go to" className={groupCls}>
                          {allNav.map((n) => (
                            <Command.Item
                              key={n.to}
                              value={`${n.label} ${n.to}`}
                              onSelect={() => go(n.to)}
                              className={itemCls}
                            >
                              <n.icon className="size-4 text-ink-secondary" />
                              Go to {n.label}
                            </Command.Item>
                          ))}
                        </Command.Group>
                        <Command.Group heading="Actions" className={groupCls}>
                          {QUICK_ACTIONS.map((a) => (
                            <Command.Item
                              key={a.key}
                              value={a.label}
                              onSelect={() => go(a.to)}
                              className={itemCls}
                            >
                              {a.label}
                            </Command.Item>
                          ))}
                          <Command.Item
                            value="open quick actions"
                            onSelect={() => {
                              close()
                              setQuick(true)
                            }}
                            className={itemCls}
                          >
                            Open Quick Actions
                          </Command.Item>
                        </Command.Group>
                      </>
                    ) : null}
                  </>
                )}
              </Command.List>
              <div className="flex items-center gap-2 border-t border-line-subtle px-3 py-2 text-[11px] text-ink-muted">
                <kbd className="rounded border border-line bg-app px-1.5 py-0.5 font-sans">↑↓</kbd>
                navigate
                <kbd className="rounded border border-line bg-app px-1.5 py-0.5 font-sans">↵</kbd>
                select
                <kbd className="rounded border border-line bg-app px-1.5 py-0.5 font-sans">esc</kbd>
                close
              </div>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
