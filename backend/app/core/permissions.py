"""Server-side RBAC. The frontend permission UI is never authoritative."""

OWNER = "owner"
ADMIN = "admin"
STAFF = "staff"

ALL_ROLES = (OWNER, ADMIN, STAFF)

# action -> roles allowed
PERMISSIONS: dict[str, tuple[str, ...]] = {
    "dashboard.view": (OWNER, ADMIN, STAFF),
    "customers.view": (OWNER, ADMIN, STAFF),
    "customers.manage": (OWNER, ADMIN, STAFF),
    "leads.view": (OWNER, ADMIN, STAFF),
    "leads.manage": (OWNER, ADMIN, STAFF),
    "leads.convert": (OWNER, ADMIN, STAFF),
    "admissions.create": (OWNER, ADMIN, STAFF),
    "memberships.view": (OWNER, ADMIN, STAFF),
    "memberships.manage": (OWNER, ADMIN),
    "renewals.manage": (OWNER, ADMIN, STAFF),
    "payments.view": (OWNER, ADMIN),
    "payments.manage": (OWNER, ADMIN),
    "payments.refund": (OWNER,),
    "bookings.view": (OWNER, ADMIN, STAFF),
    "bookings.manage": (OWNER, ADMIN, STAFF),
    "bookings.override": (OWNER, ADMIN),
    "tasks.view": (OWNER, ADMIN, STAFF),
    "tasks.manage": (OWNER, ADMIN, STAFF),
    "notifications.view": (OWNER, ADMIN, STAFF),
    "notifications.manage": (OWNER, ADMIN, STAFF),
    "analytics.view": (OWNER, ADMIN),
    "staff.view": (OWNER, ADMIN),
    "staff.invite": (OWNER,),
    "staff.role": (OWNER,),
    "staff.status": (OWNER, ADMIN),
    "settings.view": (OWNER, ADMIN),
    "settings.manage": (OWNER,),
    "settings.limited": (OWNER, ADMIN),
    "whatsapp.view": (OWNER, ADMIN),
    "whatsapp.manage": (OWNER,),
    "whatsapp.send": (OWNER, ADMIN, STAFF),
    "jobs.run": (OWNER, ADMIN),
}


def can(role: str, action: str) -> bool:
    return role in PERMISSIONS.get(action, ())


def owner_only(role: str) -> bool:
    return role == OWNER
