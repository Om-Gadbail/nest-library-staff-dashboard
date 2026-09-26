import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  tabs,
  className,
  children,
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  tabs?: { value: string; label: string; content?: React.ReactNode }[]
  className?: string
  children?: React.ReactNode
}) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue ?? tabs?.[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={cn('w-full min-w-0', className)}
    >
      {tabs ? (
        <>
          <TabsPrimitive.List
            aria-label="Tabs"
            className="flex w-full min-w-0 gap-1 overflow-x-auto rounded-lg border border-line-subtle bg-surface p-1"
          >
            {tabs.map((t) => (
              <TabsPrimitive.Trigger
                key={t.value}
                value={t.value}
                className="min-h-10 flex-1 cursor-pointer rounded-md px-3 text-sm font-medium whitespace-nowrap text-ink-secondary transition-colors hover:bg-brand-soft/60 hover:text-brand-ink data-[state=active]:bg-brand-soft data-[state=active]:text-brand-ink data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-brand/30 data-[state=active]:shadow-xs"
              >
                {t.label}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          {tabs.map((t) =>
            t.content ? (
              <TabsPrimitive.Content key={t.value} value={t.value} className="pt-4 outline-none">
                {t.content}
              </TabsPrimitive.Content>
            ) : null,
          )}
        </>
      ) : (
        children
      )}
    </TabsPrimitive.Root>
  )
}

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      aria-label="Tabs"
      className={cn(
        'flex w-full min-w-0 gap-1 overflow-x-auto rounded-lg border border-line-subtle bg-surface p-1',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'min-h-10 flex-1 cursor-pointer rounded-md px-3 text-sm font-medium whitespace-nowrap text-ink-secondary transition-colors hover:bg-brand-soft/60 hover:text-brand-ink data-[state=active]:bg-brand-soft data-[state=active]:text-brand-ink data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-brand/30 data-[state=active]:shadow-xs',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('pt-4 outline-none', className)} {...props} />
}
