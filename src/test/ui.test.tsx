import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'
import { admissionBalance, admissionValidation } from '@/features/admissions/admission-schema'
import { formatINR, expiryLabel, daysUntil } from '@/lib/format'

describe('UI primitives', () => {
  it('renders a button and handles clicks', async () => {
    const user = userEvent.setup()
    let clicks = 0
    render(<Button onClick={() => (clicks += 1)}>New admission</Button>)
    const btn = screen.getByRole('button', { name: /new admission/i })
    await user.click(btn)
    expect(clicks).toBe(1)
  })

  it('renders a loading button as busy and disabled', () => {
    render(<Button loading>Save</Button>)
    const btn = screen.getByRole('button', { name: /save/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('renders badge + empty state copy', () => {
    render(
      <>
        <Badge tone="brand">Coming soon</Badge>
        <EmptyState title="No renewals" description="All caught up." />
      </>,
    )
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
    expect(screen.getByText(/no renewals/i)).toBeInTheDocument()
  })
})

describe('Admission validation', () => {
  it('accepts a valid admission', () => {
    expect(
      admissionValidation({
        full_name: 'Rahul Sharma',
        phone: '+91 98200 12345',
        plan: 'monthly',
        start_at: '2026-09-26',
        amount: 2000,
        paid: 2000,
        method: 'upi',
      }),
    ).toEqual([])
  })

  it('rejects missing name, bad phone and overpayment', () => {
    const errors = admissionValidation({
      full_name: 'A',
      phone: '123',
      plan: 'monthly',
      start_at: '',
      amount: 2000,
      paid: 2500,
      method: 'upi',
    })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('flags paid exceeding amount', () => {
    expect(
      admissionValidation({
        full_name: 'Rahul Sharma',
        phone: '+91 98200 12345',
        plan: 'monthly',
        start_at: '2026-09-26',
        amount: 2000,
        paid: 2500,
        method: 'upi',
      }),
    ).toContain('Paid amount cannot exceed the plan amount')
  })

  it('calculates balance as amount minus paid', () => {
    expect(admissionBalance(5500, 2000)).toBe(3500)
    expect(admissionBalance(2000, 2000)).toBe(0)
  })
})

describe('Business formatting', () => {
  it('formats INR with Indian grouping', () => {
    expect(formatINR(18450)).toBe('₹18,450')
    expect(formatINR(1500)).toBe('₹1,500')
  })

  it('computes days-until and expiry labels', () => {
    expect(typeof daysUntil('2026-10-01')).toBe('number')
    expect(typeof expiryLabel('2026-10-01')).toBe('string')
  })
})
