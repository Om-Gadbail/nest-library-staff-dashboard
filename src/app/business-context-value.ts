import * as React from 'react'
import type { Business } from '@/types/domain'
import { currentBusiness } from '@/config/business'

export const BusinessContext = React.createContext<Business>(currentBusiness)
