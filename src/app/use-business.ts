import * as React from 'react'
import type { Business } from '@/types/domain'
import { BusinessContext } from './business-context-value'

export function useBusiness(): Business {
  return React.useContext(BusinessContext)
}
