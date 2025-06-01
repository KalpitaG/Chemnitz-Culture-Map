# Backend/routers/stats.py

from fastapi import APIRouter, HTTPException
from typing import Dict
from models import CulturalSite, ParkingLot, District, CategoryType, User
from auth import get_current_user

router = APIRouter(
    prefix="/api/stats",
    tags=["stats"]
)

@router.get("/quick")
async def get_quick_stats():
    """Get quick statistics for UI components (optimized for speed)"""
    try:
        total_sites = await CulturalSite.count({"is_active": True})
        chemnitz_sites = await CulturalSite.count({"is_active": True, "source": "chemnitz_geojson"})
        sachsen_sites = await CulturalSite.count({"is_active": True, "source": "sachsen_geojson"})
        total_parking = await ParkingLot.count({"is_active": True})
        total_districts = await District.count()

        category_stats: Dict[str, int] = {}
        for category in CategoryType:
            cnt = await CulturalSite.count({"category": category, "is_active": True})
            category_stats[category.value] = cnt

        return {
            "total_sites": total_sites,
            "chemnitz_sites": chemnitz_sites,
            "sachsen_sites": sachsen_sites,
            "total_parking": total_parking,
            "total_districts": total_districts,
            "sites_by_category": category_stats,
            "performance_note": "This endpoint uses counts only for speed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch quick statistics: {str(e)}")

@router.get("/overview")
async def get_overview_statistics():
    """Get overview statistics for admin dashboard"""
    try:
        total_sites = await CulturalSite.count()
        active_sites = await CulturalSite.find({"is_active": True}).count()
        total_users = await User.count() if 'User' in globals() else 0

        category_stats = {}
        for category in CategoryType:
            cnt = await CulturalSite.find({"category": category, "is_active": True}).count()
            category_stats[category.value] = cnt

        return {
            "total_sites": total_sites,
            "active_sites": active_sites,
            "inactive_sites": total_sites - active_sites,
            "total_users": total_users,
            "sites_by_category": category_stats,
            "database_stats": await db_manager.get_database_stats()  # if you want DB stats here
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch statistics: {str(e)}")
