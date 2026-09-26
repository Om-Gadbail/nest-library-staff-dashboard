"""Pydantic schemas: consistent request/response contracts with pagination."""

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, EmailStr, Field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class Pagination(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


# ---------- auth ----------


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class BizOut(BaseModel):
    business_id: str
    name: str
    role: str
    timezone: str


class MeOut(BaseModel):
    user_id: str
    full_name: str
    email: str
    businesses: list[BizOut]
    permissions: list[str]


# ---------- customers ----------


class CustomerIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=6, max_length=32)
    email: EmailStr | None = None
    notes: str | None = None


class CustomerOut(BaseModel):
    customer_id: str
    business_id: str
    full_name: str
    phone: str
    email: str | None = None
    notes: str | None = None
    joined_at: datetime
    status: str
    plan: str | None = None
    expires_at: datetime | None = None


class CustomerDetailOut(BaseModel):
    customer: CustomerOut
    memberships: list["MembershipOut"]
    payments: list["PaymentOut"]
    renewals: list["RenewalOut"]
    activities: list["ActivityOut"]


# ---------- admissions ----------


class AdmissionIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=6, max_length=32)
    email: EmailStr | None = None
    notes: str | None = None
    plan: str
    start_at: datetime
    amount: float = Field(ge=0)
    paid: float = Field(ge=0)
    method: str = "upi"


class MembershipOut(BaseModel):
    membership_id: str
    business_id: str
    customer_id: str
    customer_name: str
    plan: str
    status: str
    start_at: datetime
    expires_at: datetime
    amount: float
    paid: float
    balance: float
    payment_state: str


class PaymentOut(BaseModel):
    payment_id: str
    business_id: str
    customer_id: str
    customer_name: str
    membership_id: str | None = None
    plan: str | None = None
    kind: str = "admission"
    amount: float
    paid: float
    balance: float
    method: str
    status: str
    received_at: datetime
    receipt_no: str


class RenewalOut(BaseModel):
    renewal_id: str
    business_id: str
    customer_id: str
    customer_name: str
    plan: str
    due_at: datetime
    amount: float
    status: str
    contact_status: str
    days_remaining: int | None = None


class AdmissionOut(BaseModel):
    customer: CustomerOut
    membership: MembershipOut
    payment: PaymentOut
    renewal: RenewalOut


class RenewIn(BaseModel):
    plan: str
    start_at: datetime
    amount: float = Field(ge=0)
    paid: float = Field(ge=0)
    method: str = "upi"


class PaymentIn(BaseModel):
    customer_id: str
    membership_id: str | None = None
    kind: str = "other"
    amount: float = Field(ge=0)
    paid: float = Field(ge=0)
    method: str = "upi"


# ---------- leads ----------


class LeadIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=6, max_length=32)
    email: EmailStr | None = None
    source: str = "Walk-in"
    interested_plan: str | None = None
    assigned_to: str | None = None
    notes: str | None = None
    follow_up_at: datetime | None = None


class LeadPatch(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    source: str | None = None
    interested_plan: str | None = None
    assigned_to: str | None = None
    notes: str | None = None
    follow_up_at: datetime | None = None
    stage: str | None = None


class LeadOut(BaseModel):
    lead_id: str
    business_id: str
    full_name: str
    phone: str
    email: str | None = None
    stage: str
    source: str
    interested_plan: str | None = None
    assigned_to: str | None = None
    notes: str | None = None
    follow_up_at: datetime | None = None
    converted_customer_id: str | None = None
    created_at: datetime
    updated_at: datetime


class LeadConvertIn(BaseModel):
    plan: str
    start_at: datetime
    amount: float = Field(ge=0)
    paid: float = Field(ge=0)
    method: str = "upi"
    allow_link: bool = False
    link_customer_id: str | None = None


# ---------- bookings ----------


class BookingIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    service: str | None = None
    customer_id: str | None = None
    customer_name: str = ""
    customer_phone: str | None = None
    staff: str | None = None
    starts_at: datetime
    ends_at: datetime
    notes: str | None = None
    allow_overlap: bool = False


class BookingPatch(BaseModel):
    title: str | None = None
    service: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    staff: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    status: str | None = None
    notes: str | None = None
    allow_overlap: bool = False


class BookingOut(BaseModel):
    booking_id: str
    business_id: str
    title: str
    service: str | None = None
    customer_id: str | None = None
    customer_name: str
    customer_phone: str | None = None
    staff: str | None = None
    starts_at: datetime
    ends_at: datetime
    status: str
    notes: str | None = None


# ---------- tasks ----------


class TaskIn(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    assigned_to: str | None = None
    customer_id: str | None = None
    lead_id: str | None = None
    priority: str = "medium"
    due_at: datetime | None = None
    notes: str | None = None


class TaskPatch(BaseModel):
    title: str | None = None
    assigned_to: str | None = None
    customer_id: str | None = None
    lead_id: str | None = None
    priority: str | None = None
    status: str | None = None
    due_at: datetime | None = None
    notes: str | None = None


class TaskOut(BaseModel):
    task_id: str
    business_id: str
    title: str
    assigned_to: str | None = None
    customer_id: str | None = None
    lead_id: str | None = None
    priority: str
    status: str
    due_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


# ---------- notifications / activities ----------


class NotificationOut(BaseModel):
    notification_id: str
    business_id: str
    title: str
    body: str
    kind: str
    link: str | None = None
    customer_id: str | None = None
    read: bool
    created_at: datetime


class ActivityOut(BaseModel):
    activity_id: str
    business_id: str
    actor: str
    action: str
    detail: str | None = None
    kind: str
    customer_id: str | None = None
    created_at: datetime


class NoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


# ---------- staff / settings ----------


class StaffOut(BaseModel):
    staff_id: str
    business_id: str
    full_name: str
    email: str
    role: str
    status: str
    last_active: datetime | None = None


class StaffInviteIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    role: str = "staff"


class StaffRoleIn(BaseModel):
    role: str


class StaffStatusIn(BaseModel):
    status: str


class SettingsOut(BaseModel):
    business_id: str
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    opening_hours: str | None = None
    timezone: str
    currency: str
    renewal_reminders: bool
    payment_reminders: bool
    lead_followups: bool
    booking_reminders: bool
    whatsapp_connected: bool
    reminder_timing: str
    plans: list[dict[str, Any]]


class SettingsPatch(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    opening_hours: str | None = None
    timezone: str | None = None
    renewal_reminders: bool | None = None
    payment_reminders: bool | None = None
    lead_followups: bool | None = None
    booking_reminders: bool | None = None
    reminder_timing: str | None = None
    plans: list[dict[str, Any]] | None = None


# ---------- whatsapp ----------


class WhatsAppSettingsOut(BaseModel):
    provider: str
    enabled: bool
    configured: bool
    phone_number_id_set: bool
    has_token: bool
    reminder_days: str
    templates: str


class WhatsAppSettingsPatch(BaseModel):
    provider: str | None = None
    phone_number_id: str | None = None
    access_token: str | None = None
    enabled: bool | None = None
    reminder_days: str | None = None
    templates: str | None = None


class WhatsAppSendIn(BaseModel):
    recipient: str = Field(min_length=6, max_length=32)
    template: str = ""
    body: str = Field(min_length=1, max_length=2000)
    customer_id: str | None = None
    renewal_id: str | None = None


class WhatsAppMessageOut(BaseModel):
    message_id: str
    business_id: str
    recipient: str
    template: str
    body: str
    status: str
    provider_message_id: str | None = None
    error: str | None = None
    created_at: datetime


# ---------- analytics ----------


class RevenueSummaryOut(BaseModel):
    received: float
    due: float
    outstanding: float
    expected: float
    refunds: float
    net: float
    transactions: int
    average: float
    previous_received: float
    change_percent: float | None = None
    has_data: bool


class TrendPointOut(BaseModel):
    key: str
    label: str
    revenue: float
    previous: float | None = None


class AnalyticsOverviewOut(BaseModel):
    customers_total: int
    customers_active: int
    customers_expiring: int
    customers_expired: int
    memberships_active: int
    memberships_expiring: int
    memberships_expired: int
    renewal_rate: float
    leads_total: int
    leads_new: int
    leads_converted: int
    lead_conversion_rate: float
    bookings_today: int
    tasks_overdue: int
    renewals_due_7d: int
    revenue_today: float
    revenue_month: float
