import type { Variants } from 'motion/react'

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Subtle page entry */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
}

/** Staggered list container */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.05 } },
}

/** Staggered child */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: 'easeOut' },
  },
}

/** Popover / dialog / menu */
export const popoverVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: prefersReducedMotion ? 0 : 4 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: 'easeOut' },
  },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
}

export const durations = {
  instant: 0.12,
  fast: 0.18,
  base: 0.24,
} as const
