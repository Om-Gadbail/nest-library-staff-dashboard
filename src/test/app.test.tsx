import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '@/app/App'
import { router } from '@/app/router'

/** Lazy dashboard + charts are heavy in jsdom — allow generous async timeouts. */
const FIND_OPTS = { timeout: 20000 }

beforeEach(async () => {
  await router.navigate('/dashboard')
})

describe('App shell', () => {
  it('renders the dashboard overview', async () => {
    render(<App />)
    expect(await screen.findByText(/Today's revenue/i, undefined, FIND_OPTS)).toBeInTheDocument()
    expect(screen.getAllByText(/Nest Library/i).length).toBeGreaterThan(0)
  })

  it('renders desktop + mobile navigation foundations', async () => {
    render(<App />)
    await screen.findByText(/Today's revenue/i, undefined, FIND_OPTS)
    expect(screen.getByRole('navigation', { name: /primary navigation/i })).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: /mobile primary navigation/i }),
    ).toBeInTheDocument()
  })

  it('navigates to the real customers module', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Today's revenue/i, undefined, FIND_OPTS)
    const customersLinks = screen.getAllByRole('link', { name: /customers/i })
    await user.click(customersLinks[0])
    expect(
      await screen.findByText(/Member directory/i, undefined, FIND_OPTS),
    ).toBeInTheDocument()
  })

  it('navigates to the renewals module', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Today's revenue/i, undefined, FIND_OPTS)
    const renewalsLinks = screen.getAllByRole('link', { name: /renewals/i })
    await user.click(renewalsLinks[0])
    expect(await screen.findAllByText(/^Renewals$/i, undefined, FIND_OPTS)).not.toHaveLength(0)
  })
})
