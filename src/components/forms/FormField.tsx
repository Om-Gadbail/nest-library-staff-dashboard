import * as React from 'react'
import type { FieldError } from 'react-hook-form'
import { cn } from '@/lib/utils'

export function FormField({
  label,
  htmlFor,
  required,
  description,
  error,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  description?: string
  error?: FieldError | { message?: string } | string
  children: React.ReactNode
}) {
  const msg = typeof error === 'string' ? error : error?.message
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span aria-hidden className="text-danger">
            {' '}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">(required)</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {description && !msg ? (
        <p className="mt-1 text-xs text-ink-secondary">{description}</p>
      ) : null}
      {msg ? (
        <p role="alert" id={`${htmlFor}-error`} className="mt-1 text-xs font-medium text-danger">
          {msg}
        </p>
      ) : null}
    </div>
  )
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>{children}</div>
}
