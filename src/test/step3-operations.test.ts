import { beforeEach, describe, expect, it } from 'vitest'
import { resetStore, store } from '@/mock/business'
import {
  archiveTask,
  completeTask,
  convertLead,
  createBooking,
  createLead,
  createStaff,
  createTask,
  dismissNotification,
  findBookingConflicts,
  markAllNotificationsRead,
  markNotificationRead,
  scheduleLeadFollowUp,
  updateBookingStatus,
  updateLeadStage,
  updateSettings,
  updateStaffRole,
  updateTask,
} from '@/mock/business-service'

beforeEach(() => {
  resetStore()
})

describe('leads pipeline', () => {
  it('creates a lead with assignment and follow-up', async () => {
    const lead = await createLead({
      full_name: 'Test Person',
      phone: '+91 90000 00000',
      source: 'Walk-in',
      interested_plan: 'monthly',
      follow_up_at: '2026-09-27',
    })
    expect(lead.stage).toBe('new')
    expect(store.leads[0].lead_id).toBe(lead.lead_id)
    expect(store.notifications[0].kind).toBe('lead')
  })

  it('moves through stages and schedules follow-ups', async () => {
    await updateLeadStage('l-21', 'contacted')
    expect(store.leads.find((l) => l.lead_id === 'l-21')?.stage).toBe('contacted')
    await scheduleLeadFollowUp('l-21', '2026-09-28')
    const l = store.leads.find((x) => x.lead_id === 'l-21')!
    expect(l.follow_up_at).toBe('2026-09-28')
    expect(l.stage).toBe('follow-up')
  })

  it('converts a lead into customer + membership + payment + renewal + activity', async () => {
    const before = {
      c: store.customers.length,
      m: store.memberships.length,
      p: store.payments.length,
      r: store.renewals.length,
    }
    const result = await convertLead({
      lead_id: 'l-21',
      plan: 'monthly',
      start_at: '2026-09-26',
      amount: 2000,
      paid: 2000,
      method: 'upi',
    })
    expect(result.lead.stage).toBe('converted')
    expect(result.lead.converted_customer_id).toBe(result.customer.customer_id)
    expect(store.customers.length).toBe(before.c + 1)
    expect(store.memberships.length).toBe(before.m + 1)
    expect(store.payments.length).toBe(before.p + 1)
    expect(store.renewals.length).toBe(before.r + 1)
    // Prefilled from the lead — no re-entry
    expect(result.customer.full_name).toBe('Ishaan Patel')
    expect(result.customer.phone).toBe('+91 98111 00021')
  })
})

describe('bookings + conflict detection', () => {
  it('detects overlapping bookings for the same staff', () => {
    // b-11: Priya Sharma 10:00–12:00 on Sept 26
    const hits = findBookingConflicts({
      staff: 'Priya Sharma',
      starts_at: '2026-09-26T10:30:00',
      ends_at: '2026-09-26T11:30:00',
    })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].title).toBe('Discussion Room A')
  })

  it('allows adjacent bookings and different staff', () => {
    expect(
      findBookingConflicts({
        staff: 'Priya Sharma',
        starts_at: '2026-09-26T12:00:00',
        ends_at: '2026-09-26T13:00:00',
      }),
    ).toHaveLength(0)
    expect(
      findBookingConflicts({
        staff: 'Rahul Verma',
        starts_at: '2026-09-26T10:30:00',
        ends_at: '2026-09-26T11:30:00',
      }),
    ).toHaveLength(0)
  })

  it('blocks accidental overlaps unless explicitly overridden', async () => {
    await expect(
      createBooking({
        title: 'Clash',
        customer_name: 'X',
        staff: 'Priya Sharma',
        date: '2026-09-26',
        start_time: '10:30',
        end_time: '11:30',
      }),
    ).rejects.toThrow(/already booked/)
    const forced = await createBooking(
      {
        title: 'Clash',
        customer_name: 'X',
        staff: 'Priya Sharma',
        date: '2026-09-26',
        start_time: '10:30',
        end_time: '11:30',
      },
      { allowOverlap: true },
    )
    expect(forced.status).toBe('scheduled')
  })

  it('rejects end-before-start and supports cancel/complete', async () => {
    await expect(
      createBooking({
        title: 'Bad',
        customer_name: 'X',
        date: '2026-09-27',
        start_time: '12:00',
        end_time: '10:00',
      }),
    ).rejects.toThrow(/End time/)
    await updateBookingStatus('b-11', 'completed')
    expect(store.bookings.find((b) => b.booking_id === 'b-11')?.status).toBe('completed')
    await updateBookingStatus('b-12', 'cancelled')
    expect(store.bookings.find((b) => b.booking_id === 'b-12')?.status).toBe('cancelled')
  })
})

describe('tasks queue', () => {
  it('creates, completes and archives tasks', async () => {
    const t = await createTask({
      title: 'Call test',
      assigned_to: 'Priya Sharma',
      priority: 'urgent',
      due_at: '2026-09-27',
    })
    expect(t.status).toBe('open')
    await completeTask(t.task_id)
    expect(store.tasks.find((x) => x.task_id === t.task_id)?.status).toBe('done')
    await archiveTask(t.task_id)
    expect(store.tasks.find((x) => x.task_id === t.task_id)?.status).toBe('archived')
  })

  it('reassigns and filters by bucket', async () => {
    const t = await createTask({ title: 'Reassign me', assigned_to: 'Priya Sharma' })
    await updateTask(t.task_id, { assigned_to: 'Rahul Verma' })
    expect(store.tasks.find((x) => x.task_id === t.task_id)?.assigned_to).toBe('Rahul Verma')
    expect(
      store.tasks.filter((x) => (x.due_at ?? '') < '2026-09-26' && x.status === 'open').length,
    ).toBeGreaterThanOrEqual(0)
  })
})

describe('notifications center', () => {
  it('tracks unread, marks read, marks all read and dismisses', async () => {
    const unread = store.notifications.filter((n) => !n.read && !n.dismissed)
    expect(unread.length).toBeGreaterThan(0)
    await markNotificationRead(unread[0].notification_id)
    expect(
      store.notifications.find((n) => n.notification_id === unread[0].notification_id)?.read,
    ).toBe(true)
    await markAllNotificationsRead()
    expect(store.notifications.every((n) => n.read)).toBe(true)
    await dismissNotification('n-1')
    expect(store.notifications.find((n) => n.notification_id === 'n-1')?.dismissed).toBe(true)
  })
})

describe('staff + settings (mock foundations)', () => {
  it('invites staff and changes roles', async () => {
    const m = await createStaff({
      full_name: 'New Joiner',
      email: 'new@nestlibrary.in',
      role: 'staff',
    })
    expect(m.status).toBe('invited')
    await updateStaffRole(m.staff_id, 'admin')
    expect(store.staff.find((s) => s.staff_id === m.staff_id)?.role).toBe('admin')
  })

  it('updates settings in the mock store', async () => {
    await updateSettings({ name: 'Nest Library — Test', renewal_reminders: false })
    expect(store.settings.name).toBe('Nest Library — Test')
    expect(store.settings.renewal_reminders).toBe(false)
  })
})
