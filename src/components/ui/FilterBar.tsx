import { SlidersHorizontal } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Dialog, DialogContent } from './Dialog'
import { SearchInput } from './SearchInput'

export interface FilterOption {
  value: string
  label: string
}

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  selects,
  onReset,
  resultCount,
}: {
  search: string
  onSearch: (v: string) => void
  searchPlaceholder?: string
  selects: {
    label: string
    value: string
    onChange: (v: string) => void
    options: FilterOption[]
  }[]
  onReset?: () => void
  resultCount?: number
}) {
  const [open, setOpen] = React.useState(false)
  const active = selects.filter((s) => s.value !== 'all').length

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} />
        </div>
        {/* Desktop inline */}
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          {selects.map((s) => (
            <label key={s.label} className="flex shrink-0 items-center gap-1.5">
              <span className="sr-only">{s.label}</span>
              <select
                aria-label={s.label}
                value={s.value}
                onChange={(e) => s.onChange(e.target.value)}
                className="h-10 cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm text-ink shadow-xs hover:border-line-strong"
              >
                <option value="all">{s.label}: All</option>
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {onReset && active > 0 ? (
            <Button variant="ghost" size="sm" onClick={onReset}>
              Reset
            </Button>
          ) : null}
        </div>
        {/* Mobile filter button */}
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          aria-label="Open filters"
          className="relative shrink-0 md:hidden"
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {active > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {active}
            </span>
          ) : null}
        </Button>
      </div>
      {typeof resultCount === 'number' ? (
        <p className="mt-2 text-xs text-ink-muted" aria-live="polite">
          {resultCount} result{resultCount === 1 ? '' : 's'}
          {active > 0 ? ` · ${active} filter${active === 1 ? '' : 's'} active` : ''}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent title="Filters" description="Refine the list" className="sm:max-w-sm">
            <div className="space-y-4">
              {selects.map((s) => (
                <div key={s.label}>
                  <p className="mb-1.5 text-[13px] font-semibold text-ink">{s.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => s.onChange('all')}
                      className={cn(
                        'h-9 cursor-pointer rounded-full border px-3 text-[13px] font-medium',
                        s.value === 'all'
                          ? 'border-brand bg-brand-soft text-brand-ink'
                          : 'border-line bg-surface text-ink-secondary',
                      )}
                    >
                      All
                    </button>
                    {s.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => s.onChange(o.value)}
                        aria-pressed={s.value === o.value}
                        className={cn(
                          'h-9 cursor-pointer rounded-full border px-3 text-[13px] font-medium',
                          s.value === o.value
                            ? 'border-brand bg-brand-soft text-brand-ink'
                            : 'border-line bg-surface text-ink-secondary',
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                {onReset ? (
                  <Button variant="secondary" fullWidth onClick={() => { onReset(); }}>
                    Reset
                  </Button>
                ) : null}
                <Button fullWidth onClick={() => setOpen(false)}>
                  Show results
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}
