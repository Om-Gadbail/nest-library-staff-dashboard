import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { popoverVariants, prefersReducedMotion } from '@/lib/motion'
import { Button } from './Button'

/* ---------- Dialog ---------- */

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  )
}

export function DialogContent({
  title,
  description,
  children,
  className,
  onClose,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  onClose?: () => void
}) {
  return (
    <DialogPrimitive.Portal forceMount>
      <AnimatePresence>
        <DialogPrimitive.Overlay forceMount asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            className="fixed inset-0 z-50 bg-black/40"
          />
        </DialogPrimitive.Overlay>
        <div className="safe-bottom safe-top fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <DialogPrimitive.Content forceMount asChild>
            <motion.div
              variants={popoverVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              role="dialog"
              aria-modal="true"
              className={cn(
                'relative flex max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden bg-surface shadow-lg',
                'rounded-t-2xl sm:rounded-xl',
                'sm:max-w-lg',
                className,
              )}
            >
              <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-[15px] font-semibold text-ink">
                    {title}
                  </DialogPrimitive.Title>
                  {description ? (
                    <DialogPrimitive.Description className="mt-0.5 text-[13px] text-ink-secondary">
                      {description}
                    </DialogPrimitive.Description>
                  ) : null}
                </div>
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    aria-label="Close dialog"
                    onClick={onClose}
                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-secondary hover:bg-app hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </DialogPrimitive.Close>
              </div>
              <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
            </motion.div>
          </DialogPrimitive.Content>
        </div>
      </AnimatePresence>
    </DialogPrimitive.Portal>
  )
}

/* ---------- Drawer (right side on desktop, bottom sheet on mobile) ---------- */

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <DialogPrimitive.Overlay forceMount asChild key="overlay">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40"
              />
            </DialogPrimitive.Overlay>
          ) : null}
          {open ? (
            <div
              key="wrap"
              className="safe-bottom fixed inset-0 z-50 flex items-end justify-end sm:items-stretch sm:p-0"
            >
              <DialogPrimitive.Content forceMount asChild>
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24, x: 0 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl bg-surface shadow-lg sm:max-h-none sm:h-full sm:w-[420px] sm:rounded-none sm:border-l sm:border-line"
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
                    <div className="min-w-0">
                      <DialogPrimitive.Title className="text-[15px] font-semibold text-ink">
                        {title}
                      </DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="mt-0.5 text-[13px] text-ink-secondary">
                          {description}
                        </DialogPrimitive.Description>
                      ) : null}
                    </div>
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        aria-label="Close panel"
                        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-secondary hover:bg-app"
                      >
                        <X className="size-4" />
                      </button>
                    </DialogPrimitive.Close>
                  </div>
                  <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          ) : null}
        </AnimatePresence>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* ---------- Confirm dialog ---------- */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  danger,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  danger?: boolean
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <AlertDialogPrimitive.Content className="w-full rounded-t-2xl border border-line bg-surface p-5 shadow-lg sm:max-w-sm sm:rounded-xl">
            <AlertDialogPrimitive.Title className="text-[15px] font-semibold text-ink">
              {title}
            </AlertDialogPrimitive.Title>
            {description ? (
              <AlertDialogPrimitive.Description className="mt-1 text-sm text-ink-secondary">
                {description}
              </AlertDialogPrimitive.Description>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="secondary">{cancelLabel}</Button>
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action asChild>
                <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
                  {confirmLabel}
                </Button>
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </div>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
