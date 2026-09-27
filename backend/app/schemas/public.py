"""Public website intake contracts.

Mirrors the Nest website's zod schemas in `src/lib/formSchemas.ts` (field
names, length limits, phone shape). The frontend contract is fixed at
`POST /api/leads/{contact,visit,membership,seat-inquiry}` with a
`{ "referenceId": "<id>" }` JSON response.

Security notes:
- `businessId` / `tenantId` sent by the browser are accepted but IGNORED.
  Tenant resolution always happens server-side (see app/api/v1/public.py).
- `company` is the spam honeypot: any non-empty value means the submission
  is silently discarded with an opaque reference.
- `attribution` (UTMs, referrer, device class) is accepted and ignored by
  the current CRM pipeline; it is kept in the contract so website payloads
  validate without stripping marketing metadata.
"""

from typing import Any

from pydantic import BaseModel, Field


class _PublicBase(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=10, max_length=18, pattern=r"^[+\d][\d\s-]*$")
    # Client-supplied tenant hint. NEVER trusted — documented for honesty.
    businessId: Any | None = None
    tenantId: Any | None = None
    business_id: Any | None = None
    # Spam-defense honeypot (website `company` field). Non-empty = bot.
    company: str | None = Field(default=None, max_length=200)
    attribution: dict[str, Any] | None = None


class PublicContactIn(_PublicBase):
    message: str = Field(min_length=5, max_length=500)


class PublicVisitIn(_PublicBase):
    preferredDate: str = Field(min_length=1, max_length=20)
    preferredTime: str = Field(min_length=1, max_length=20)
    purpose: str | None = Field(default=None, max_length=160)
    message: str | None = Field(default=None, max_length=500)


class PublicMembershipIn(_PublicBase):
    plan: str = Field(min_length=1, max_length=80)
    seatType: str = Field(min_length=1, max_length=80)
    duration: str = Field(min_length=1, max_length=80)
    message: str | None = Field(default=None, max_length=500)


class PublicSeatInquiryIn(_PublicBase):
    occupation: str = Field(pattern=r"^(student|professional|other)$")
    examGoal: str | None = Field(default=None, max_length=120)
    duration: str = Field(min_length=1, max_length=80)
    seatPreference: str = Field(min_length=1, max_length=80)
    timing: str = Field(min_length=1, max_length=80)
    source: str | None = Field(default=None, max_length=120)
    message: str | None = Field(default=None, max_length=500)


class PublicReferenceOut(BaseModel):
    referenceId: str


class PublicBusinessConfigOut(BaseModel):
    slug: str
    businessId: str
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    openingHours: str | None = None
    timezone: str
    currency: str
    leadIntake: dict[str, str]
