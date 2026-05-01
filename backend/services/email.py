"""SendGrid transactional email engine with branded HTML templates.

Usage:
    from services.email import send_email, TEMPLATES
    await send_email(to="u@x.com", template="welcome", data={"name": "Alex"})
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, Optional

log = logging.getLogger("filthy.email")

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "no-reply@filthy.ai")
FROM_NAME = os.environ.get("SENDGRID_FROM_NAME", "FiiLTHY.AI")
BRAND_URL = (os.environ.get("FRONTEND_URL") or os.environ.get("BACKEND_URL", "https://fiilthy.ai")).replace("/api", "").rstrip("/")

# ---------- Branded template wrapper ----------
_BRAND = {
    "bg": "#09090B",
    "card": "#18181B",
    "border": "#27272A",
    "text": "#F4F4F5",
    "muted": "#A1A1AA",
    "yellow": "#FFD600",
    "red": "#FF3333",
}


def _wrap(title: str, body_html: str, cta_text: Optional[str] = None, cta_url: Optional[str] = None) -> str:
    cta = ""
    if cta_text and cta_url:
        cta = f"""
        <tr><td style="padding:24px 32px 8px 32px;">
          <a href="{cta_url}" style="display:inline-block;background:{_BRAND['yellow']};color:#000;padding:14px 28px;text-decoration:none;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:13px;font-family:monospace;">{cta_text}</a>
        </td></tr>"""
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:{_BRAND['bg']};font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:{_BRAND['text']};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BRAND['bg']};padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:{_BRAND['card']};border:1px solid {_BRAND['border']};">
      <tr><td style="padding:28px 32px;border-bottom:1px solid {_BRAND['border']};">
        <div style="font-size:12px;letter-spacing:.3em;color:{_BRAND['yellow']};text-transform:uppercase;font-family:monospace;">▮ FiiLTHY.AI</div>
      </td></tr>
      <tr><td style="padding:32px 32px 16px 32px;">
        <h1 style="margin:0 0 16px 0;font-size:28px;line-height:1.15;text-transform:uppercase;letter-spacing:.02em;color:{_BRAND['text']};">{title}</h1>
        <div style="color:{_BRAND['muted']};font-size:15px;line-height:1.6;">{body_html}</div>
      </td></tr>
      {cta}
      <tr><td style="padding:24px 32px;border-top:1px solid {_BRAND['border']};font-family:monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#71717A;">
        © FiiLTHY.AI — Built filthy. Built fast.<br/>
        <a href="{BRAND_URL}" style="color:#71717A;text-decoration:underline;">{BRAND_URL.replace('https://', '').replace('http://', '')}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


# ---------- Template registry ----------
TEMPLATES = {
    "welcome": {
        "subject": "Welcome to FiiLTHY.AI — go viral or go broke",
        "render": lambda d: _wrap(
            f"Welcome{', ' + d['name'] if d.get('name') else ''}.",
            "You just unlocked the viral product factory. Generate your first digital product, launch it to seven storefronts, and get five-platform ad creative — in under two minutes.<br/><br/>"
            "Your free plan includes <b>5 generations</b>. Upgrade any time to crank through dozens.",
            "Generate my first product", f"{BRAND_URL}/app/products",
        ),
    },
    "payment_succeeded": {
        "subject": "Payment received — you're on the {plan} plan",
        "render": lambda d: _wrap(
            f"Welcome to the {d.get('plan', '').upper()} plan.",
            f"Your subscription is now active. <b>${d.get('amount', 0)}</b>/mo "
            f"unlocks <b>{d.get('plan_limit', '')}</b> monthly generations.<br/><br/>"
            "Your receipt is attached to this email via Stripe.",
            "Open dashboard", f"{BRAND_URL}/app",
        ),
    },
    "payment_failed": {
        "subject": "Payment failed — update your card",
        "render": lambda d: _wrap(
            "Your subscription payment failed.",
            f"We couldn't charge your card for the <b>{d.get('plan', '').upper()}</b> plan. Stripe will retry automatically, "
            "but you can fix it manually any time by updating your card.",
            "Update payment method", f"{BRAND_URL}/pricing",
        ),
    },
    "password_reset": {
        "subject": "Reset your FiiLTHY password",
        "render": lambda d: _wrap(
            "Reset your password.",
            "Use the secure link below to set a new password. It expires in one hour. "
            "If you did not request this, you can ignore the email.",
            "Reset password", d.get("reset_url", f"{BRAND_URL}/login"),
        ),
    },
    "plan_upgraded": {
        "subject": "Plan upgraded — {plan}",
        "render": lambda d: _wrap(
            f"You're now on the {d.get('plan', '').upper()} plan.",
            f"Enjoy your new limit of <b>{d.get('plan_limit', '')}</b> monthly generations. Time to ship.",
            "Open dashboard", f"{BRAND_URL}/app",
        ),
    },
    "plan_cancelled": {
        "subject": "Subscription cancelled",
        "render": lambda d: _wrap(
            "Sorry to see you go.",
            "Your FiiLTHY subscription has been cancelled. You'll keep access until the end of your current billing period, then drop to the free plan.<br/><br/>"
            "Come back any time — your products and campaigns are saved.",
            "Reactivate", f"{BRAND_URL}/pricing",
        ),
    },
    "cancellation_save": {
        "subject": "Before you cancel FiiLTHY",
        "render": lambda d: _wrap(
            "Keep the machine running.",
            "You can downgrade instead of cancelling and keep your products, ads, analytics, and referral engine active.",
            "Review billing", f"{BRAND_URL}/app/billing",
        ),
    },
    "upsell": {
        "subject": "Unlock more launches with {plan}",
        "render": lambda d: _wrap(
            f"Upgrade to {d.get('plan', 'Pro')}.",
            "Your next product needs more generations, faster launch assets, and deeper analytics. Upgrade when you are ready to scale.",
            "Upgrade", f"{BRAND_URL}/pricing",
        ),
    },
    "product_sold": {
        "subject": "💸 You just made a sale — {title}",
        "render": lambda d: _wrap(
            f"Another one ({d.get('title', '')}).",
            f"A customer just bought <b>{d.get('title', '')}</b> for <b>${d.get('amount', 0)}</b>.<br/><br/>"
            f"Track every sale and spot winners in your analytics.",
            "View analytics", f"{BRAND_URL}/app/products/{d.get('product_id', '')}",
        ),
    },
    "launch_success": {
        "subject": "🚀 {title} is LIVE",
        "render": lambda d: _wrap(
            f"{d.get('title', 'Your product')} is live.",
            f"Your product is now live on <b>{d.get('store_count', 0)}</b> storefronts. "
            f"Real listings: <b>{d.get('real_count', 0)}</b>. Paste your viral TikTok bio link and start driving clicks.",
            "Open product", f"{BRAND_URL}/app/products/{d.get('product_id', '')}",
        ),
    },
    "referral_invite": {
        "subject": "Your friend {referrer} thinks you should try FiiLTHY.AI",
        "render": lambda d: _wrap(
            "You were invited by a hustler.",
            f"<b>{d.get('referrer', 'A friend')}</b> invited you to FiiLTHY.AI — the AI product + ads factory for creators.<br/><br/>"
            "Sign up with their link and you'll both get perks when you upgrade.",
            "Claim my invite", d.get("referral_url", BRAND_URL),
        ),
    },
    "referral_reward": {
        "subject": "You earned ${amount} — your referral just upgraded",
        "render": lambda d: _wrap(
            f"${d.get('amount', 0)} commission earned.",
            f"<b>{d.get('referred', 'Your referral')}</b> just upgraded to the <b>{d.get('plan', '').upper()}</b> plan — "
            f"you earn <b>${d.get('amount', 0)}</b> commission. See your running total in the referral dashboard.",
            "View referrals", f"{BRAND_URL}/app/referrals",
        ),
    },
    "abandoned_checkout": {
        "subject": "You left something on the table — upgrade now",
        "render": lambda d: _wrap(
            "Still on the fence?",
            f"You started a checkout for the <b>{d.get('plan', '').upper()}</b> plan but didn't finish. "
            "Your next product could be a winner — upgrade now and unlock more monthly generations.",
            "Finish checkout", f"{BRAND_URL}/pricing",
        ),
    },
    "payout_requested": {
        "subject": "Payout requested - ${amount}",
        "render": lambda d: _wrap(
            "Your referral payout is queued.",
            f"We received your payout request for <b>${d.get('amount', 0)}</b>. "
            "An admin will review fraud signals and approve it before payment.",
            "View payout ledger", f"{BRAND_URL}/app/referrals",
        ),
    },
    "payout_approved": {
        "subject": "Payout approved - ${amount}",
        "render": lambda d: _wrap(
            "Your payout was approved.",
            f"Your <b>${d.get('amount', 0)}</b> referral payout passed review and is ready to be paid.",
            "View payout ledger", f"{BRAND_URL}/app/referrals",
        ),
    },
    "payout_paid": {
        "subject": "Payout sent - ${amount}",
        "render": lambda d: _wrap(
            "Referral payout paid.",
            f"Your <b>${d.get('amount', 0)}</b> referral payout has been marked paid.",
            "Share again", f"{BRAND_URL}/app/referrals",
        ),
    },
    "admin_broadcast": {
        "subject": "{subject}",
        "render": lambda d: _wrap(d.get("heading", "Announcement"), d.get("body_html", ""), d.get("cta_text"), d.get("cta_url")),
    },
}


async def send_email(
    to: str,
    template: str,
    data: Optional[Dict[str, Any]] = None,
    subject_override: Optional[str] = None,
) -> Dict[str, Any]:
    """Send a templated transactional email. Always async, never blocks the event loop."""
    data = data or {}
    if template not in TEMPLATES:
        return {"ok": False, "error": f"unknown_template: {template}"}

    tpl = TEMPLATES[template]
    try:
        subject = (subject_override or tpl["subject"]).format(**data)
    except (KeyError, IndexError):
        subject = subject_override or tpl["subject"]
    html = tpl["render"](data)

    if not SENDGRID_API_KEY:
        log.warning(f"[MOCKED-EMAIL] to={to} tpl={template} subj={subject}")
        return {"ok": False, "error": "sendgrid_not_configured", "mocked": True}

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content

        mail = Mail(
            from_email=Email(FROM_EMAIL, FROM_NAME),
            to_emails=To(to),
            subject=subject,
            html_content=Content("text/html", html),
        )

        def _send():
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            return sg.send(mail)

        resp = await asyncio.to_thread(_send)
        ok = 200 <= resp.status_code < 300
        if not ok:
            log.error(f"SendGrid send failed to={to} tpl={template} status={resp.status_code} body={resp.body}")
        return {"ok": ok, "status_code": resp.status_code, "message_id": resp.headers.get("X-Message-Id") if hasattr(resp, "headers") else None}
    except Exception as ex:
        log.error(f"SendGrid exception to={to} tpl={template}: {ex}")
        return {"ok": False, "error": str(ex)}


async def send_raw(to: str, subject: str, html: str) -> Dict[str, Any]:
    """Send a raw HTML email (used by admin broadcast)."""
    if not SENDGRID_API_KEY:
        log.warning(f"[MOCKED-EMAIL] raw to={to} subj={subject}")
        return {"ok": False, "error": "sendgrid_not_configured", "mocked": True}
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content

        mail = Mail(
            from_email=Email(FROM_EMAIL, FROM_NAME),
            to_emails=To(to),
            subject=subject,
            html_content=Content("text/html", _wrap(subject, html)),
        )

        def _send():
            return SendGridAPIClient(SENDGRID_API_KEY).send(mail)

        resp = await asyncio.to_thread(_send)
        return {"ok": 200 <= resp.status_code < 300, "status_code": resp.status_code}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}
