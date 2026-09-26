"""WhatsApp provider abstraction. Never claim delivery without provider confirmation."""

import httpx
from sqlalchemy.orm import Session

from app.core import errors
from app.core.config import get_settings
from app.models import models as m


class ProviderResult:
    def __init__(self, ok: bool, provider_message_id: str | None = None, error: str | None = None):
        self.ok = ok
        self.provider_message_id = provider_message_id
        self.error = error


class LogProvider:
    """Development fallback: records the message, never sends. Status stays 'queued'."""

    name = "log"

    def send(self, to: str, body: str) -> ProviderResult:
        return ProviderResult(ok=False, error="WhatsApp provider not configured (log mode)")


class MetaCloudProvider:
    """Meta WhatsApp Cloud API adapter (template/message rules per current API)."""

    name = "meta"

    def __init__(self, phone_number_id: str, access_token: str):
        self.phone_number_id = phone_number_id
        self.access_token = access_token

    def send(self, to: str, body: str) -> ProviderResult:
        digits = "".join(ch for ch in to if ch.isdigit())
        if not digits:
            return ProviderResult(ok=False, error="Invalid recipient number")
        try:
            resp = httpx.post(
                f"https://graph.facebook.com/v21.0/{self.phone_number_id}/messages",
                headers={"Authorization": f"Bearer {self.access_token}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": digits,
                    # Free-form text requires an open 24h customer-service window;
                    # templates should be used otherwise. We send text and let
                    # Meta validate, surfacing the real provider error.
                    "type": "text",
                    "text": {"body": body[:4096]},
                },
                timeout=15,
            )
        except Exception as exc:  # network failure: not delivered
            return ProviderResult(ok=False, error=f"Provider request failed: {exc}")
        if resp.status_code not in (200, 201):
            return ProviderResult(ok=False, error=f"Meta API {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        try:
            wid = data["messages"][0]["id"]
        except (KeyError, IndexError, TypeError):
            wid = None
        return ProviderResult(ok=True, provider_message_id=wid)


def get_provider(db: Session, business_id: str):
    cfg = db.get(m.WhatsAppSettings, business_id)
    s = get_settings()
    provider = (cfg.provider if cfg else None) or s.WHATSAPP_PROVIDER
    enabled = (cfg.enabled if cfg else None) if cfg else s.WHATSAPP_ENABLED
    phone_id = (cfg.phone_number_id if cfg else "") or s.WHATSAPP_PHONE_NUMBER_ID
    token = (cfg.access_token_enc if cfg else "") or s.WHATSAPP_ACCESS_TOKEN
    if not enabled or provider == "log" or not phone_id or not token:
        return None, {"provider": provider, "enabled": bool(enabled),
                      "configured": False,
                      "reason": "WhatsApp is not configured. Add provider credentials in Settings."}
    if provider == "meta":
        return MetaCloudProvider(phone_id, token), {"provider": provider, "enabled": True,
                                                    "configured": True}
    return None, {"provider": provider, "enabled": bool(enabled), "configured": False,
                  "reason": f"Unknown provider: {provider}"}


def queue_and_send(
    db: Session, business_id: str, *, recipient: str, template: str, body: str,
    kind: str = "manual", customer_id: str | None = None,
    renewal_id: str | None = None, dedupe_key: str | None = None,
) -> m.WhatsAppMessage:
    if dedupe_key:
        existing = db.query(m.WhatsAppMessage).filter_by(
            business_id=business_id, dedupe_key=dedupe_key).first()
        if existing:
            return existing  # idempotent: never double-send
    provider, info = get_provider(db, business_id)
    msg = m.WhatsAppMessage(
        business_id=business_id, recipient=recipient, template=template, body=body,
        kind=kind, customer_id=customer_id, renewal_id=renewal_id,
        status="queued", dedupe_key=dedupe_key,
    )
    db.add(msg)
    db.flush()
    if provider is None:
        msg.status = "failed"
        msg.error = info.get("reason", "WhatsApp not configured")
        db.commit()
        raise errors.unavailable(
            "WhatsApp is not configured. Connect a provider in Settings before sending.",
            details={"code": "WHATSAPP_NOT_CONFIGURED"},
        )
    result = provider.send(recipient, body)
    if result.ok:
        msg.status = "sent"
        msg.provider_message_id = result.provider_message_id
    else:
        msg.status = "failed"
        msg.error = result.error
    db.commit()
    if not result.ok:
        raise errors.unavailable(f"WhatsApp delivery failed: {result.error}",
                                 details={"code": "WHATSAPP_SEND_FAILED"})
    return msg
