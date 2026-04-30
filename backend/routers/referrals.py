"""Referral engine routes."""
from fastapi import APIRouter, Depends

from core_auth import current_user
from services import payouts as payout_service
from services import referrals as referral_service

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


@router.get("/me")
async def my_referrals(user=Depends(current_user)):
    await referral_service.ensure_user_referral(user)
    summary = await referral_service.get_referral_summary(user["id"])
    summary["ledger"] = await payout_service.ledger_for_user(user["id"])
    return summary


@router.get("/ledger")
async def payout_ledger(user=Depends(current_user)):
    return await payout_service.ledger_for_user(user["id"])


@router.post("/payouts/request")
async def request_payout(user=Depends(current_user)):
    return await payout_service.request_payout(user)


@router.get("/leaderboard")
async def top_referrers(limit: int = 20):
    return {"leaderboard": await referral_service.leaderboard(limit=limit)}


@router.get("/resolve/{code}")
async def resolve_code(code: str):
    """Public — used by signup page to validate ?ref=... links."""
    ref = await referral_service.resolve_code(code)
    if not ref:
        return {"valid": False}
    return {"valid": True, "code": ref["code"]}
