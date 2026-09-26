import type { Business } from '@/types/domain'

export const currentBusiness: Business = {
  business_id: import.meta.env.VITE_BUSINESS_ID ?? 'nest-library-001',
  business_name: 'Nest Library',
  business_type: 'library',
  tagline: 'Study space, managed calmly',
  phone: '+91 98200 00000',
  email: 'hello@nestlibrary.in',
  address: '2nd Floor, Palm Court, Pune',
}

export const featureFlags = {
  admissions: true,
  renewals: true,
  payments: true,
  leads: true,
  bookings: true,
  analytics: true,
  tasks: true,
  multiBusiness: false,
} as const

export type FeatureFlag = keyof typeof featureFlags
