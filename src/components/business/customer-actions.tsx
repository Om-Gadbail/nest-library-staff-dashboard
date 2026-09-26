import { MessageCircle, Phone } from 'lucide-react'
import { whatsappCustomer } from './customer-contact'

export function CustomerContactButtons({
  phone,
  name,
  compact,
}: {
  phone: string
  name: string
  compact?: boolean
}) {
  return (
    <div className={compact ? 'flex gap-1.5' : 'flex gap-2'}>
      <a
        href={`tel:${phone.replace(/\s/g, '')}`}
        aria-label={`Call ${name}`}
        title={`Call ${name}`}
        className="flex h-8 min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border border-line bg-surface px-2 text-ink-secondary hover:border-line-strong hover:text-ink"
      >
        <Phone className="size-4" />
      </a>
      <button
        type="button"
        aria-label={`WhatsApp ${name}`}
        title={`WhatsApp ${name}`}
        onClick={() => whatsappCustomer(phone, name)}
        className="flex h-8 min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border border-line bg-surface px-2 text-ink-secondary hover:border-line-strong hover:text-ink"
      >
        <MessageCircle className="size-4" />
      </button>
    </div>
  )
}
