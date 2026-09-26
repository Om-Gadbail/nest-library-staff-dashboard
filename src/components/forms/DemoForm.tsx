import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { notify } from '@/lib/notify'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { FormField, FormGrid } from './FormField'

const demoSchema = z.object({
  fullName: z.string().min(2, 'Enter a full name'),
  phone: z.string().min(10, 'Enter a valid phone number'),
})

type DemoValues = z.infer<typeof demoSchema>

/** Small RHF + Zod demonstration to verify the form foundation. */
export function DemoForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DemoValues>({ resolver: zodResolver(demoSchema) })

  return (
    <form
      onSubmit={handleSubmit((v) => {
        notify.success('Looks good', `${v.fullName} passed validation.`)
        reset()
      })}
      noValidate
      className="space-y-4"
    >
      <FormGrid>
        <FormField label="Full name" htmlFor="demo-name" required error={errors.fullName}>
          <Input
            id="demo-name"
            autoComplete="name"
            placeholder="e.g. Aarav Mehta"
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? 'demo-name-error' : undefined}
            {...register('fullName')}
          />
        </FormField>
        <FormField
          label="Phone"
          htmlFor="demo-phone"
          required
          description="10-digit mobile number"
          error={errors.phone}
        >
          <Input
            id="demo-phone"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+91 …"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'demo-phone-error' : undefined}
            {...register('phone')}
          />
        </FormField>
      </FormGrid>
      <Button type="submit" loading={isSubmitting}>
        Validate
      </Button>
    </form>
  )
}
