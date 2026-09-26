import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked?: boolean
  onCheckedChange?: (v: boolean) => void
  label?: string
  id?: string
}) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 sm:min-h-0">
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange?.(v === true)}
        className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-line-strong bg-surface transition-colors data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white"
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3.5" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? (
        <label htmlFor={id} className="cursor-pointer text-sm text-ink">
          {label}
        </label>
      ) : null}
    </span>
  )
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked?: boolean
  onCheckedChange?: (v: boolean) => void
  label?: string
  id?: string
}) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 sm:min-h-0">
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-disabled transition-colors data-[state=checked]:bg-brand"
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </SwitchPrimitive.Root>
      {label ? (
        <label htmlFor={id} className="cursor-pointer text-sm text-ink">
          {label}
        </label>
      ) : null}
    </span>
  )
}

export function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('mt-1 text-xs text-ink-secondary', className)}>{children}</p>
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-danger">
      {children}
    </p>
  )
}
