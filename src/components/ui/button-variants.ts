import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white shadow-xs hover:bg-brand-hover active:bg-brand-active',
        secondary:
          'border border-line bg-surface text-ink shadow-xs hover:bg-app hover:border-line-strong',
        ghost: 'text-ink-secondary hover:bg-app hover:text-ink',
        danger: 'bg-danger text-white shadow-xs hover:brightness-110',
        dark: 'bg-sidebar text-ink-inverse hover:bg-sidebar-hover',
      },
      size: {
        sm: 'h-8 min-h-8 px-3 text-[13px]',
        md: 'h-10 min-h-10 px-4',
        lg: 'h-11 min-h-11 px-5',
        icon: 'h-10 w-10 min-h-10 min-w-10 p-0',
        'icon-sm': 'h-8 w-8 min-h-8 min-w-8 p-0',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)
