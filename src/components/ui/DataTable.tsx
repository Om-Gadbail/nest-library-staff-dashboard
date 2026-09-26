import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { EmptyState } from './States'

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  searchValue?: string
  onSearchChange?: (v: string) => void
  /** Rendered on mobile instead of the table (card list). If omitted, key columns collapse. */
  mobileCard?: (row: T) => React.ReactNode
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
}

export function DataTable<T>({
  columns,
  data,
  pageSize = 8,
  mobileCard,
  emptyTitle = 'No results',
  emptyDescription = 'Try adjusting your search or filters.',
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState({})

  // TanStack Table deliberately returns non-memoizable table functions.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const rows = table.getRowModel().rows

  return (
    <div className="min-w-0">
      {/* Mobile: stacked cards */}
      {mobileCard ? (
        <div className="space-y-2.5 md:hidden">
          {rows.length === 0 ? (
            <EmptyState title={emptyTitle} description={emptyDescription} />
          ) : (
            rows.map((r) => <div key={r.id}>{mobileCard(r.original)}</div>)
          )}
          <MobilePagination table={table} />
        </div>
      ) : null}

      {/* Desktop table / mobile horizontal-safe wrapper */}
      <div className={cn(mobileCard && 'hidden md:block')}>
        <div className="overflow-x-auto rounded-xl border border-line-subtle">
          <table className="w-full min-w-[640px] border-collapse bg-surface text-left text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-line-subtle bg-app/60">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      scope="col"
                      className="px-3 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-ink-secondary uppercase"
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-ink"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <ArrowUpDown className="size-3.5 opacity-50" />
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-0">
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-line-subtle last:border-0 hover:bg-app/50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap text-ink">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
          <p className="text-xs text-ink-secondary" aria-live="polite">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())} ·{' '}
            {data.length} rows
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobilePagination({ table }: { table: { previousPage: () => void; nextPage: () => void; getCanPreviousPage: () => boolean; getCanNextPage: () => boolean; getState: () => { pagination: { pageIndex: number } }; getPageCount: () => number } }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-xs text-ink-secondary">
        Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
      </p>
      <div className="flex gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function RowMenu({ children, label = 'Row actions' }: { children: React.ReactNode; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-ink-secondary">
      <MoreHorizontal className="size-4" aria-label={label} />
      <span className="flex items-center gap-1">{children}</span>
    </span>
  )
}
