import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import * as React from 'react'
import { Toaster } from 'sonner'
import { BusinessProvider } from './business-context'
import { Devtools } from './devtools'
import { queryClient } from './query-client'
import { AuthProvider } from '@/features/auth/AuthContext'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BusinessProvider>
          <AuthProvider>
            {children}
            <Toaster
            position="top-center"
            richColors={false}
            closeButton
            toastOptions={{
              style: {
                background: '#1c1917',
                color: '#fafaf9',
                border: '1px solid #44403c',
              },
            }}
          />
          <Devtools />
          </AuthProvider>
        </BusinessProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}
