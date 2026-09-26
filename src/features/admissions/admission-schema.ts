import { z } from 'zod'

export const admissionSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the full name'),
  phone: z
    .string()
    .trim()
    .min(8, 'Enter a valid mobile number')
    .regex(/^[+\d][\d\s-]{7,}$/, 'Enter a valid mobile number'),
  email: z.string().trim().optional().refine((v) => !v || /.+@.+\..+/.test(v), 'Enter a valid email'),
  notes: z.string().optional(),
  plan: z.enum(['monthly', 'quarterly', 'half-yearly', 'yearly', 'day-pass']),
  start_at: z.string().min(1, 'Choose a start date'),
  amount: z.coerce.number().min(0, 'Amount must be 0 or more'),
  paid: z.coerce.number().min(0, 'Paid must be 0 or more'),
  method: z.enum(['upi', 'cash', 'card', 'netbanking', 'bank-transfer', 'other']),
})

export type AdmissionFormValues = z.infer<typeof admissionSchema>

export function admissionValidation(data: Partial<AdmissionFormValues>): string[] {
  const parsed = admissionSchema.safeParse({
    full_name: data.full_name ?? '',
    phone: data.phone ?? '',
    email: data.email ?? '',
    notes: data.notes ?? '',
    plan: data.plan ?? 'monthly',
    start_at: data.start_at ?? '',
    amount: data.amount ?? 0,
    paid: data.paid ?? 0,
    method: data.method ?? 'upi',
  })
  if (parsed.success) {
    if (parsed.data.paid > parsed.data.amount) return ['Paid amount cannot exceed the plan amount']
    return []
  }
  return parsed.error.issues.map((i) => i.message)
}

export function admissionBalance(amount: number, paid: number): number {
  return amount - paid
}
