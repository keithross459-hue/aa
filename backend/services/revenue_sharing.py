"""
Revenue sharing service for FiiLTHY.AI platform.
Tracks platform commission on product sales.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from db import db


# Default platform commission percentage (configurable via env)
PLATFORM_COMMISSION_PERCENT = float(os.environ.get("PLATFORM_COMMISSION_PERCENT", "10"))  # 10% default

# Allowed commission percentages (for testing/setup)
ALLOWED_COMMISSION_RATES = [5, 7.5, 10, 12.5, 15, 20]


class RevenueSharing:
    """Platform revenue sharing and commission management."""
    
    @staticmethod
    async def record_sale_commission(
        user_id: str,
        product_id: str,
        sale_amount_usd: float,
        source: str = "product_unlock",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Record a product sale and calculate platform commission.
        
        Args:
            user_id: Product creator's user ID
            product_id: ID of product being sold
            sale_amount_usd: Gross sale amount
            source: "product_unlock", "subscription", "campaign_item", etc.
            metadata: Additional data (customer ID, transaction ID, etc.)
            
        Returns:
            Dict with commission breakdown
        """
        commission_rate = PLATFORM_COMMISSION_PERCENT / 100
        platform_commission = round(sale_amount_usd * commission_rate, 2)
        creator_payout = round(sale_amount_usd - platform_commission, 2)
        
        commission_record = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "product_id": product_id,
            "sale_amount_usd": sale_amount_usd,
            "commission_rate_percent": PLATFORM_COMMISSION_PERCENT,
            "platform_commission_usd": platform_commission,
            "creator_payout_usd": creator_payout,
            "source": source,
            "metadata": metadata or {},
            "status": "pending",  # pending, paid, failed
            "created_at": datetime.now(timezone.utc).isoformat(),
            "paid_at": None,
        }
        
        # Insert into database
        await db.platform_commissions.insert_one(commission_record)
        
        # Update product revenue stats
        await db.products.update_one(
            {"id": product_id, "user_id": user_id},
            {
                "$inc": {
                    "total_revenue_usd": sale_amount_usd,
                    "platform_commission_usd": platform_commission,
                    "creator_payout_usd": creator_payout,
                },
                "$set": {
                    "last_sale_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True
        )
        
        return {
            "commission_id": commission_record["id"],
            "sale_amount_usd": sale_amount_usd,
            "platform_commission_usd": platform_commission,
            "creator_payout_usd": creator_payout,
            "commission_rate_percent": PLATFORM_COMMISSION_PERCENT,
        }
    
    @staticmethod
    async def get_user_commissions(
        user_id: str,
        status: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get all commissions for a user.
        
        Args:
            user_id: User ID
            status: Filter by status (pending, paid, failed)
            limit: Max results
            
        Returns:
            List of commission records
        """
        query = {"user_id": user_id}
        if status:
            query["status"] = status
        
        commissions = await db.platform_commissions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
        return commissions
    
    @staticmethod
    async def get_user_commission_summary(user_id: str) -> Dict[str, Any]:
        """
        Get commission summary for a user (total earned, pending, paid).
        
        Args:
            user_id: User ID
            
        Returns:
            Summary dict with totals
        """
        pipeline = [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": "$status",
                    "total_amount": {"$sum": "$platform_commission_usd"},
                    "count": {"$sum": 1},
                }
            },
        ]
        
        results = await db.platform_commissions.aggregate(pipeline).to_list(10)
        
        summary = {
            "user_id": user_id,
            "total_commission_earned": 0.0,
            "total_pending": 0.0,
            "total_paid": 0.0,
            "total_failed": 0.0,
            "commission_count": 0,
            "pending_count": 0,
            "paid_count": 0,
        }
        
        for result in results:
            status = result["_id"]
            amount = result["total_amount"]
            count = result["count"]
            
            summary["total_commission_earned"] += amount
            summary["commission_count"] += count
            
            if status == "pending":
                summary["total_pending"] += amount
                summary["pending_count"] = count
            elif status == "paid":
                summary["total_paid"] += amount
                summary["paid_count"] = count
            elif status == "failed":
                summary["total_failed"] += amount
        
        return summary
    
    @staticmethod
    async def get_platform_revenue_summary() -> Dict[str, Any]:
        """
        Get platform-wide revenue summary (admin only).
        
        Returns:
            Summary of all commissions
        """
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "total_commission": {"$sum": "$platform_commission_usd"},
                    "total_gross_sales": {"$sum": "$sale_amount_usd"},
                    "total_creator_payout": {"$sum": "$creator_payout_usd"},
                    "transaction_count": {"$sum": 1},
                }
            },
        ]
        
        results = await db.platform_commissions.aggregate(pipeline).to_list(10)
        
        summary = {
            "total_commission_earned": 0.0,
            "total_gross_sales": 0.0,
            "total_creator_payout": 0.0,
            "transaction_count": 0,
            "by_status": {},
        }
        
        for result in results:
            status = result["_id"]
            summary["total_commission_earned"] += result["total_commission"]
            summary["total_gross_sales"] += result["total_gross_sales"]
            summary["total_creator_payout"] += result["total_creator_payout"]
            summary["transaction_count"] += result["transaction_count"]
            
            summary["by_status"][status] = {
                "commission": result["total_commission"],
                "gross_sales": result["total_gross_sales"],
                "count": result["transaction_count"],
            }
        
        return summary
    
    @staticmethod
    async def mark_commission_paid(commission_id: str, payment_method: str = "stripe") -> bool:
        """
        Mark a commission as paid (called after successful payout).
        
        Args:
            commission_id: Commission record ID
            payment_method: How it was paid (stripe, bank_transfer, etc.)
            
        Returns:
            True if updated, False if not found
        """
        result = await db.platform_commissions.update_one(
            {"id": commission_id},
            {
                "$set": {
                    "status": "paid",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "payment_method": payment_method,
                }
            }
        )
        
        return result.modified_count > 0


async def record_product_sale_with_commission(
    user_id: str,
    product_id: str,
    sale_amount_usd: float,
    transaction_id: str = None,
) -> Dict[str, Any]:
    """
    Public API: Record a product sale and auto-calculate commission.
    """
    return await RevenueSharing.record_sale_commission(
        user_id=user_id,
        product_id=product_id,
        sale_amount_usd=sale_amount_usd,
        source="product_sale",
        metadata={"transaction_id": transaction_id} if transaction_id else None,
    )


async def get_creator_earnings(user_id: str) -> Dict[str, Any]:
    """Public API: Get creator's commission earnings."""
    return await RevenueSharing.get_user_commission_summary(user_id)
