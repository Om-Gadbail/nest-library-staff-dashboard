import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16">
      <Card>
        <CardContent className="px-6 py-12 text-center">
          <p className="text-4xl font-semibold tracking-tight text-ink">404</p>
          <h1 className="mt-2 text-lg font-semibold text-ink">Page not found</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            That link doesn&apos;t exist. Head back to the overview.
          </p>
          <Link to="/dashboard" className="mt-6 inline-block">
            <Button>Go to overview</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
