import * as React from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { BookOpenText, LogIn } from 'lucide-react'
import { useAuth } from './AuthContext'
import { useBusiness } from '@/app/use-business'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/forms/FormField'
import { API_BASE_URL, toApiError } from '@/api/client'
import { WAKING_MESSAGE, isColdStartError, waitForBackendReady } from '@/api/readiness'
import { notify } from '@/lib/notify'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const business = useBusiness()
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [failed, setFailed] = React.useState<string | null>(null)
  const [waking, setWaking] = React.useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  React.useEffect(() => {
    document.title = `Sign in · ${business.business_name}`
  }, [business.business_name])

  React.useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true })
  }, [isAuthenticated, navigate, from])

  async function onSubmit(values: FormValues) {
    // Credentials stay in the form across cold-start retries (no reset),
    // so a Render free wake-up never wipes what the user typed.
    const attempt = () => login(values.email.trim(), values.password)
    setFailed(null)
    setWaking(false)
    try {
      await attempt()
      notify.success('Welcome back', 'Signed in successfully.')
      navigate(from, { replace: true })
    } catch (err) {
      const e = toApiError(err)
      if (e.kind === 'network' || e.kind === 'unavailable' || isColdStartError(err)) {
        setWaking(true)
        setFailed(WAKING_MESSAGE)
        try {
          const ready = await waitForBackendReady(API_BASE_URL)
          if (ready.ok) {
            try {
              await attempt()
              notify.success('Welcome back', 'Signed in successfully.')
              navigate(from, { replace: true })
              return
            } catch (retryErr) {
              setFailed(toApiError(retryErr).message)
            }
          } else {
            setFailed(e.message)
          }
        } finally {
          setWaking(false)
        }
      } else {
        setFailed(e.message)
      }
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-app px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-sidebar text-ink-inverse">
            <BookOpenText className="size-5" />
          </span>
          <div>
            <p className="text-lg font-semibold text-ink">{business.business_name}</p>
            <p className="text-sm text-ink-secondary">Staff sign in</p>
          </div>
        </div>
        <Card className="p-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              label="Work email"
              htmlFor="login-email"
              error={form.formState.errors.email?.message}
            >
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="you@nestlibrary.in"
                className="h-11 w-full rounded-md border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent"
                {...form.register('email')}
              />
            </FormField>
            <FormField
              label="Password"
              htmlFor="login-password"
              error={form.formState.errors.password?.message}
            >
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11 w-full rounded-md border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent"
                {...form.register('password')}
              />
            </FormField>
            {failed && (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {failed}
              </p>
            )}
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={form.formState.isSubmitting}
            >
              <LogIn className="size-4" />
              {form.formState.isSubmitting ? (waking ? 'Waking backend...' : 'Signing in…') : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-ink-muted">
            Protected staff area. Sessions expire after 30 minutes of inactivity.
          </p>
        </Card>
        <p className="mt-4 text-center text-xs text-ink-muted">
          <Link to="/dashboard" className="underline underline-offset-2">
            Back to dashboard
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
