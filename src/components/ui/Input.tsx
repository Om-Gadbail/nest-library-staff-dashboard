import * as React from 'react'
import { cn } from '@/lib/utils'

const inputBase =
  'flex h-10 w-full min-w-0 rounded-md border border-line bg-surface px-3 text-sm text-ink shadow-xs transition-colors outline-none placeholder:text-ink-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-app disabled:text-ink-muted'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputBase, 'min-h-10', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(inputBase, 'h-auto min-h-20 py-2', className)}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
