"""Local Business Money Machine — Outreach generation and lead tracking."""
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core_auth import current_user
from db import db
from services.llm_client import generate_text_with_fallback

router = APIRouter(prefix="/api/local", tags=["local_business"])

# ============================================================================
# NICHE DATA
# ============================================================================

NICHES = [
    {
        "id": "hvac",
        "name": "HVAC / Heating & Cooling",
        "icon": "🌡️",
        "description": "Emergency repairs, maintenance, installations",
        "services": [
            {"id": "emergency", "name": "Emergency Repairs"},
            {"id": "maintenance", "name": "Seasonal Maintenance"},
            {"id": "installation", "name": "New Unit Installation"},
            {"id": "duct_cleaning", "name": "Duct Cleaning"},
            {"id": "thermostat", "name": "Smart Thermostat Setup"},
        ],
        "avg_deal_size": 1500,
    },
    {
        "id": "roofing",
        "name": "Roofing",
        "icon": "🏠",
        "description": "Repairs, replacements, inspections",
        "services": [
            {"id": "inspection", "name": "Roof Inspection"},
            {"id": "repair", "name": "Leak & Damage Repair"},
            {"id": "replacement", "name": "Full Roof Replacement"},
            {"id": "cleaning", "name": "Roof Cleaning"},
            {"id": "gutters", "name": "Gutter Installation"},
        ],
        "avg_deal_size": 3000,
    },
    {
        "id": "plumbing",
        "name": "Plumbing",
        "icon": "🔧",
        "description": "Emergency fixes, installations, maintenance",
        "services": [
            {"id": "emergency", "name": "Emergency Fixes"},
            {"id": "drain", "name": "Drain Cleaning"},
            {"id": "water_heater", "name": "Water Heater Service"},
            {"id": "installation", "name": "Fixture Installation"},
            {"id": "inspection", "name": "Plumbing Inspection"},
        ],
        "avg_deal_size": 800,
    },
    {
        "id": "med_spa",
        "name": "Medical Spa / Aesthetics",
        "icon": "💆",
        "description": "Botox, fillers, laser treatments, facials",
        "services": [
            {"id": "botox", "name": "Botox & Fillers"},
            {"id": "laser", "name": "Laser Treatments"},
            {"id": "facials", "name": "Medical Facials"},
            {"id": "microneedling", "name": "Microneedling"},
            {"id": "membership", "name": "Monthly Membership Plans"},
        ],
        "avg_deal_size": 350,
    },
    {
        "id": "detailing",
        "name": "Car Detailing",
        "icon": "🚗",
        "description": "Interior/exterior detailing, ceramic coatings",
        "services": [
            {"id": "exterior", "name": "Exterior Detail"},
            {"id": "interior", "name": "Interior Deep Clean"},
            {"id": "full", "name": "Full Detail Package"},
            {"id": "ceramic", "name": "Ceramic Coating"},
            {"id": "subscription", "name": "Monthly Subscription"},
        ],
        "avg_deal_size": 250,
    },
]

OUTREACH_TEMPLATE_SYSTEM = """You are an expert local business copywriter. Generate exactly 8 outreach variants for {niche} service providers.

Service: {service}
Target Audience: Local business owners

Generate EXACTLY 8 variants in this JSON format (no other text):
{{
  "variants": [
    {{
      "type": "cold_dm",
      "title": "Cold DM (Instagram/Facebook)",
      "copy": "..."
    }},
    {{
      "type": "cold_email",
      "title": "Cold Email",
      "copy": "..."
    }},
    {{
      "type": "missed_call_text",
      "title": "Missed Call Text",
      "copy": "..."
    }},
    {{
      "type": "quote_followup",
      "title": "Quote Follow-up",
      "copy": "..."
    }},
    {{
      "type": "review_request",
      "title": "Review Request",
      "copy": "..."
    }},
    {{
      "type": "reactivation",
      "title": "Reactivation Campaign",
      "copy": "..."
    }},
    {{
      "type": "facebook_ad",
      "title": "Facebook Ad Copy",
      "copy": "..."
    }},
    {{
      "type": "gbp_post",
      "title": "Google Business Post",
      "copy": "..."
    }}
  ]
}}

Rules:
- Each copy must be specific to {service} service
- Vary the angles: urgency, pain-point, social proof, scarcity, benefit
- Use [NAME] and [BUSINESS] as placeholders
- Cold DM/Email max 150 chars, others max 280 chars
- Include emojis for visual appeal
- Professional but conversational tone
- Focus on immediate benefit and clear CTA
"""

# ============================================================================
# MODELS
# ============================================================================

class NicheOut(BaseModel):
    id: str
    name: str
    icon: str
    description: str
    services: List[dict]
    avg_deal_size: int


class OutreachVariant(BaseModel):
    type: str
    title: str
    copy: str


class OutreachGenerateReq(BaseModel):
    niche_id: str
    service_id: str
    customization: Optional[str] = None


class OutreachOut(BaseModel):
    id: str
    niche_id: str
    service_id: str
    variants: List[OutreachVariant]
    created_at: str


class LeadCreateReq(BaseModel):
    niche_id: str
    contact_name: str
    contact_phone: str
    outreach_type: str


class LeadUpdateReq(BaseModel):
    status: Literal["sent", "replied", "booked", "closed"]
    deal_value: Optional[float] = None


class LeadOut(BaseModel):
    id: str
    niche_id: str
    contact_name: str
    contact_phone: str
    status: str
    outreach_type: str
    deal_value: Optional[float]
    sent_date: str
    reply_date: Optional[str]
    closed_date: Optional[str]


class UserStatsOut(BaseModel):
    total_sent: int
    total_replied: int
    total_booked: int
    total_closed: int
    total_revenue: float
    reply_rate: float
    close_rate: float


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/niches", response_model=List[NicheOut])
async def list_niches():
    """List all available niches."""
    return NICHES


@router.get("/niches/{niche_id}")
async def get_niche(niche_id: str):
    """Get niche details with services."""
    niche = next((n for n in NICHES if n["id"] == niche_id), None)
    if not niche:
        raise HTTPException(404, "Niche not found")
    return niche


@router.post("/outreach/generate", response_model=OutreachOut)
async def generate_outreach(req: OutreachGenerateReq, user=Depends(current_user)):
    """Generate 8 outreach variants for a service."""
    # Validate niche & service
    niche = next((n for n in NICHES if n["id"] == req.niche_id), None)
    if not niche:
        raise HTTPException(404, "Niche not found")
    
    service = next((s for s in niche["services"] if s["id"] == req.service_id), None)
    if not service:
        raise HTTPException(404, "Service not found")
    
    # Generate outreach variants
    prompt = OUTREACH_TEMPLATE_SYSTEM.format(
        niche=niche["name"],
        service=service["name"],
    )
    
    if req.customization:
        prompt += f"\n\nAdditional context from user: {req.customization}"
    
    try:
        response = await generate_text_with_fallback(prompt, max_tokens=2000)
        import json
        data = json.loads(response)
        variants = [OutreachVariant(**v) for v in data["variants"]]
    except Exception as ex:
        raise HTTPException(500, f"Failed to generate: {str(ex)}")
    
    # Store in DB for tracking
    outreach_id = str(uuid.uuid4())
    await db.outreach_generated.insert_one({
        "id": outreach_id,
        "user_id": user["id"],
        "niche_id": req.niche_id,
        "service_id": req.service_id,
        "variants": [v.dict() for v in variants],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return OutreachOut(
        id=outreach_id,
        niche_id=req.niche_id,
        service_id=req.service_id,
        variants=variants,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/leads", response_model=LeadOut)
async def create_lead(req: LeadCreateReq, user=Depends(current_user)):
    """Log a new outreach/lead."""
    lead_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    lead_doc = {
        "id": lead_id,
        "user_id": user["id"],
        "niche_id": req.niche_id,
        "contact_name": req.contact_name,
        "contact_phone": req.contact_phone,
        "outreach_type": req.outreach_type,
        "status": "sent",
        "deal_value": None,
        "sent_date": now,
        "reply_date": None,
        "booked_date": None,
        "closed_date": None,
        "created_at": now,
    }
    
    await db.leads.insert_one(lead_doc)
    return LeadOut(**{k: v for k, v in lead_doc.items() if k != "_id"})


@router.patch("/leads/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: str, req: LeadUpdateReq, user=Depends(current_user)):
    """Update lead status."""
    lead = await db.leads.find_one({"id": lead_id, "user_id": user["id"]})
    if not lead:
        raise HTTPException(404, "Lead not found")
    
    update_data = {"status": req.status}
    
    if req.status == "replied":
        update_data["reply_date"] = datetime.now(timezone.utc).isoformat()
    elif req.status == "booked":
        update_data["booked_date"] = datetime.now(timezone.utc).isoformat()
    elif req.status == "closed":
        update_data["closed_date"] = datetime.now(timezone.utc).isoformat()
        if req.deal_value:
            update_data["deal_value"] = req.deal_value
    
    await db.leads.update_one({"id": lead_id}, {"$set": update_data})
    updated = await db.leads.find_one({"id": lead_id})
    
    return LeadOut(**{k: v for k, v in updated.items() if k != "_id"})


@router.get("/leads", response_model=List[LeadOut])
async def list_leads(
    niche_id: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(current_user),
):
    """List user's leads with optional filters."""
    query = {"user_id": user["id"]}
    if niche_id:
        query["niche_id"] = niche_id
    if status:
        query["status"] = status
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [LeadOut(**lead) for lead in leads]


@router.get("/stats", response_model=UserStatsOut)
async def get_user_stats(user=Depends(current_user)):
    """Get user's pipeline stats."""
    leads = await db.leads.find({"user_id": user["id"]}, {"_id": 0}).to_list(None)
    
    total_sent = len(leads)
    total_replied = len([l for l in leads if l.get("reply_date")])
    total_booked = len([l for l in leads if l.get("booked_date")])
    total_closed = len([l for l in leads if l.get("closed_date")])
    total_revenue = sum(l.get("deal_value", 0) for l in leads if l.get("closed_date"))
    
    reply_rate = total_replied / total_sent if total_sent > 0 else 0
    close_rate = total_closed / total_booked if total_booked > 0 else 0
    
    return UserStatsOut(
        total_sent=total_sent,
        total_replied=total_replied,
        total_booked=total_booked,
        total_closed=total_closed,
        total_revenue=total_revenue,
        reply_rate=round(reply_rate, 3),
        close_rate=round(close_rate, 3),
    )
