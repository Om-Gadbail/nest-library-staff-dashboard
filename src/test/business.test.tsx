import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import CustomersPage from '@/features/customers/CustomersPage'
import PaymentsPage from '@/features/payments/PaymentsPage'
import RenewalsPage from '@/features/renewals/RenewalsPage'
import { resetStore } from '@/mock/business'

function shell(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Core business modules', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders the customer directory with search', async () => {
    shell(<CustomersPage />)
    expect(await screen.findByText(/Member directory/i, undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Search name or mobile/i)).toBeInTheDocument()
    expect(await screen.findAllByText(/Aarav Mehta/i, undefined, { timeout: 10000 })).not.toHaveLength(0)
  })

  it('filters customers via search', async () => {
    const user = userEvent.setup()
    shell(<CustomersPage />)
    await screen.findAllByText(/Aarav Mehta/i, undefined, { timeout: 10000 })
    await user.type(screen.getByPlaceholderText(/Search name or mobile/i), 'Diya')
    expect(await screen.findAllByText(/Diya Sharma/i, undefined, { timeout: 10000 })).not.toHaveLength(0)
  })

  it('renders renewals with urgency actions', async () => {
    shell(
      <Routes>
        <Route path="/" element={<RenewalsPage />} />
      </Routes>,
    )
    expect(await screen.findByText(/^Renewals$/i, undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(await screen.findAllByRole('button', { name: /renew/i }, { timeout: 10000 })).not.toHaveLength(0)
  })

  it('renders payments with received/due summary', async () => {
    shell(<PaymentsPage />)
    expect(await screen.findByText(/^Payments$/i, undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText(/Outstanding/i)).toBeInTheDocument()
  })
})
