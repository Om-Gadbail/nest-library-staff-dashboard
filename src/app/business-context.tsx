import * as React from 'react'
import { BusinessContext } from './business-context-value'
import { currentBusiness } from '@/config/business'

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  return <BusinessContext.Provider value={currentBusiness}>{children}</BusinessContext.Provider>
}
