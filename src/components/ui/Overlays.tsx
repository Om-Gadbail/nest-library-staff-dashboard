import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'
import { cn } from '@/lib/utils'

const menuCls =
  'z-50 min-w-44 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-lg'

export function Dropdown({
  trigger,
  children,
  align = 'end',
  label,
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'end' | 'center'
  label?: string
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild aria-label={label}>
        {trigger}
      </DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content align={align} sideOffset={8} className={menuCls}>
          {children}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  )
}

export function DropdownItem({
  children,
  onSelect,
  danger,
  icon,
}: {
  children: React.ReactNode
  onSelect?: () => void
  danger?: boolean
  icon?: React.ReactNode
}) {
  return (
    <DropdownPrimitive.Item
      onSelect={(e) => {
        e.preventDefault()
        onSelect?.()
      }}
      className={cn(
        'flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm outline-none select-none focus:bg-app',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {icon}
      {children}
    </DropdownPrimitive.Item>
  )
}

export function Popover({
  trigger,
  children,
  align = 'end',
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'end' | 'center'
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={8}
          className="z-50 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg outline-none"
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export function Tooltip({
  trigger,
  content,
  side = 'top',
}: {
  trigger: React.ReactNode
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-[60] max-w-56 rounded-md bg-sidebar px-2.5 py-1.5 text-xs font-medium text-ink-inverse shadow-md"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
