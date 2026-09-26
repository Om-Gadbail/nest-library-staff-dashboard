import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'

async function enableMocks() {
  if (!import.meta.env.DEV) return
  if (import.meta.env.VITE_ENABLE_MSW === 'false') return
  const { worker } = await import('./mock/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element')

enableMocks().finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
