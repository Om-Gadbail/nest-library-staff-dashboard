import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'
import { Card } from './Card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  hint,
}: {
  label: string
  value: string
  delta?: string
  icon?: LucideIcon
  hint?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink-secondary">{label}</p>
            <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink">{value}</p>
            {delta ? <p className={cn('mt-1 text-xs font-medium text-success')}>{delta}</p> : null}
            {hint ? <div className="mt-0.5 text-xs text-ink-muted">{hint}</div> : null}
          </div>
          {Icon ? (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
              <Icon className="size-5" />
            </div>
          ) : null}
        </div>
      </Card>
    </motion.div>
  )
}
