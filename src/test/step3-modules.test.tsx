import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import AnalyticsPage from '@/features/analytics/AnalyticsPage'
import BookingsPage from '@/features/bookings/BookingsPage'
import LeadsPage from '@/features/leads/LeadsPage'
import NotificationsPage from '@/features/notifications/NotificationsPage'
import SettingsPage from '@/features/settings/SettingsPage'
import StaffPage from '@/features/staff/StaffPage'
import TasksPage from '@/features/tasks/TasksPage'
import { resetStore } from '@/mock/business'

function shell(ui: React.ReactNode, initial = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Step 3 modules render + interact', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders the leads pipeline with stage tabs and cards', async () => {
    shell(<LeadsPage />)
    expect(await screen.findByText(/^Leads$/i, undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(
      await screen.findAllByText(/Ishaan Patel/i, undefined, { timeout: 10000 }),
    ).not.toHaveLength(0)
  })

  it('creates a lead from the dialog', async () => {
    const user = userEvent.setup()
    shell(<LeadsPage />)
    await screen.findByText(/^Leads$/i, undefined, { timeout: 10000 })
    await user.click(screen.getByRole('button', { name: /new lead/i }))
    await user.type(screen.getByPlaceholderText(/Ishaan Patel/i), 'QA Prospect')
    await user.type(screen.getByPlaceholderText(/\+91/i), '+91 90000 11111')
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'Walk-in')
    await user.click(screen.getByRole('button', { name: /^save lead$/i }))
    expect(
      await screen.findAllByText(/QA Prospect/i, undefined, { timeout: 10000 }),
    ).not.toHaveLength(0)
  })

  it('renders bookings with list and calendar toggle', async () => {
    const user = userEvent.setup()
    shell(<BookingsPage />)
    expect(
      await screen.findByText(/^Bookings$/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findAllByText(/Discussion Room A/i, undefined, { timeout: 10000 }),
    ).not.toHaveLength(0)
    await user.click(screen.getByRole('tab', { name: /^calendar$/i }))
    expect(await screen.findByRole('tablist', { name: /calendar view/i })).toBeInTheDocument()
  })

  it('renders tasks with view tabs and completes a task', async () => {
    const user = userEvent.setup()
    shell(<TasksPage />, '/tasks?tab=upcoming')
    expect(await screen.findByText(/^Tasks$/i, undefined, { timeout: 10000 })).toBeInTheDocument()
    const boxes = await screen.findAllByRole('checkbox', undefined, { timeout: 10000 })
    expect(boxes.length).toBeGreaterThan(0)
    await user.click(boxes[0])
  })

  it('renders notifications with unread filter', async () => {
    const user = userEvent.setup()
    shell(<NotificationsPage />)
    expect(
      await screen.findByText(/^Notifications$/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^unread$/i }))
  })

  it('renders analytics with KPIs, trend and transactions', async () => {
    shell(<AnalyticsPage />, '/analytics?range=last-30')
    expect(
      await screen.findByText(/^Analytics$/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Revenue received/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Revenue trend/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Average transaction/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
  })

  it('renders staff with roles and the server-enforced notice', async () => {
    shell(<StaffPage />)
    expect(await screen.findByText(/^Staff$/i, undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(
      await screen.findByText(/Server-enforced roles/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findAllByText(/Priya Sharma/i, undefined, { timeout: 10000 }),
    ).not.toHaveLength(0)
  })

  it('renders settings with tabbed sections', async () => {
    shell(<SettingsPage />)
    expect(
      await screen.findByText(/^Settings$/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Business profile/i, undefined, { timeout: 10000 }),
    ).toBeInTheDocument()
  })

  it('mobile filter drawer opens from FilterBar', async () => {
    const user = userEvent.setup()
    shell(<LeadsPage />)
    await screen.findByText(/^Leads$/i, undefined, { timeout: 10000 })
    await user.click(screen.getByRole('button', { name: /open filters/i }))
    expect(await screen.findByRole('dialog', undefined, { timeout: 10000 })).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /show results/i, timeout: 10000 } as never),
    ).toBeInTheDocument()
  })
})
