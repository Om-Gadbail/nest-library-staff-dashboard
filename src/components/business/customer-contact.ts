import { notify } from '@/lib/notify'

export function callCustomer(phone: string, name: string) {
  window.location.href = `tel:${phone.replace(/\s/g, '')}`
  notify.info(`Calling ${name}`, phone)
}

export function whatsappCustomer(phone: string, name: string, message?: string) {
  const digits = phone.replace(/[^+\d]/g, '')
  const text = encodeURIComponent(message ?? `Hi ${name}, this is Nest Library.`)
  window.open(`https://wa.me/${digits}?text=${text}`, '_blank', 'noopener')
}
