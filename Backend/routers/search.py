# Backend/routers/search.py

from fastapi import APIRouter, HTTPException
from typing import Optional, List
from datetime import datetime
from models import CulturalSite, CategoryType, District, UserActivity

router = APIRouter(
    prefix="/api/search",
    tags=["search"]
)

@router.get("/advanced")
async def advanced_search(
    q: Optional[str] = None,
    category: Optional[CategoryType] = None,
    district: Optional[str] = None,
    source: Optional[str] = None,
    has_website: Optional[bool] = None,
    has_phone: Optional[bool] = None,
    has_opening_hours: Optional[bool] = None,
    created_after: Optional[str] = None,
    created_before: Optional[str] = None,
    sort_by: Optional[str] = "name",
    sort_order: Optional[str] = "asc",
    limit: int = 100,
    skip: int = 0
):
    """Advanced search with multiple filters and sorting"""
    try:
        query = {"is_active": True}

        if q:
    # Use regex for more precise matching
            query["$or"] = [
        {"name": {"$regex": q, "$options": "i"}},  # Case-insensitive name search
        {"description": {"$regex": q, "$options": "i"}},  # Description search
        {"address": {"$regex": q, "$options": "i"}}  # Address search
    ]
        if category:
            query["category"] = category
        if source:
            query["source"] = source

        if district:
            district_doc = await District.find_one({"properties.STADTTNAME": district})
            if district_doc:
                query["location"] = {"$geoWithin": {"$geometry": district_doc.geometry}}

        if has_website is not None:
            if has_website:
                query["website"] = {"$ne": None}
            else:
                query["$or"] = [{"website": None}, {"website": ""}]
        if has_phone is not None:
            if has_phone:
                query["phone"] = {"$ne": None}
            else:
                query["$or"] = [{"phone": None}, {"phone": ""}]
        if has_opening_hours is not None:
            if has_opening_hours:
                query["opening_hours"] = {"$ne": None}
            else:
                query["$or"] = [{"opening_hours": None}, {"opening_hours": ""}]

        if created_after or created_before:
            date_query = {}
            if created_after:
                date_query["$gte"] = datetime.fromisoformat(created_after.replace("Z", "+00:00"))
            if created_before:
                date_query["$lte"] = datetime.fromisoformat(created_before.replace("Z", "+00:00"))
            query["created_at"] = date_query

        sort_direction = 1 if sort_order == "asc" else -1
        sort_criteria = [(sort_by, sort_direction)]

        sites = await CulturalSite.find(query).sort(sort_criteria).skip(skip).limit(limit).to_list()
        total_count = await CulturalSite.find(query).count()

        return {
            "sites": sites,
            "total": len(sites),
            "total_matches": total_count,
            "filters": {
                "q": q,
                "category": category,
                "district": district,
                "source": source,
                "has_website": has_website,
                "has_phone": has_phone,
                "has_opening_hours": has_opening_hours,
                "created_after": created_after,
                "created_before": created_before
            },
            "pagination": {
                "limit": limit,
                "skip": skip,
                "has_more": total_count > (skip + len(sites))
            },
            "sorting": {"sort_by": sort_by, "sort_order": sort_order}
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Advanced search failed: {str(e)}")


@router.get("/nearby")
async def search_nearby_sites(
    lat: float,
    lng: float,
    radius: int = 1000,
    category: Optional[CategoryType] = None,
    limit: int = 50
):
    """Search for cultural sites within a radius of coordinates"""
    try:
        if not (-90 <= lat <= 90):
            raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
        if not (-180 <= lng <= 180):
            raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")

        geo_query = {
            "location": {
                "$near": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "$maxDistance": radius
                }
            },
            "is_active": True
        }
        if category:
            geo_query["category"] = category

        sites = await CulturalSite.find(geo_query).limit(limit).to_list()
        return {
            "sites": sites,
            "total": len(sites),
            "search_params": {
                "latitude": lat,
                "longitude": lng,
                "radius_meters": radius,
                "category": category
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Nearby search failed: {str(e)}")


@router.get("/autocomplete")
async def autocomplete_search(q: str, limit: int = 10):
    """Autocomplete search for site names"""
    try:
        if len(q) < 2:
            return {"suggestions": []}

        regex_query = {"name": {"$regex": f"^{q}", "$options": "i"}, "is_active": True} 
        sites = await CulturalSite.find(regex_query).sort("name").limit(limit * 2).to_list()
        seen_names = set()
        unique_sites = []
        for site in sites:
            if site.name.lower() not in seen_names:
                seen_names.add(site.name.lower())
                unique_sites.append(site)
                if len(unique_sites) >= limit:
                    break
        sites = unique_sites
        suggestions = [
            {"id": str(site.id), "name": site.name, "category": site.category, "address": site.address}
            for site in sites
        ]
        return {"suggestions": suggestions, "query": q, "total": len(suggestions)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Autocomplete search failed: {str(e)}")


@router.get("/filters/values")
async def get_filter_values():
    """Get available values for filters (for UI dropdowns)"""
    try:
        sources = await CulturalSite.distinct("source", {"is_active": True})
        districts_with_sites = await CulturalSite.aggregate([
            {"$match": {"is_active": True}},
            {"$group": {"_id": "$properties.district", "count": {"$sum": 1}}},
            {"$match": {"_id": {"$ne": None}}},
            {"$sort": {"_id": 1}}
        ]).to_list()

        oldest_site = await CulturalSite.find({"is_active": True}).sort([("created_at", 1)]).limit(1).to_list()
        newest_site = await CulturalSite.find({"is_active": True}).sort([("created_at", -1)]).limit(1).to_list()

        return {
            "categories": [cat.value for cat in CategoryType],
            "sources": sources,
            "districts": [d["_id"] for d in districts_with_sites if d["_id"]],
            "date_range": {
                "oldest": oldest_site[0].created_at if oldest_site else None,
                "newest": newest_site[0].created_at if newest_site else None
            },
            "sort_options": ["name", "created_at", "updated_at"],
            "sort_orders": ["asc", "desc"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get filter values: {str(e)}")


@router.get("/popular")
async def get_popular_sites(category: Optional[CategoryType] = None, limit: int = 10):
    """Get popular sites based on view count and favorites"""
    try:
        query = {"is_active": True}
        if category:
            query["category"] = category

        popular_sites = await CulturalSite.find(query).sort([
            ("favorite_count", -1),
            ("view_count", -1),
            ("created_at", -1)
        ]).limit(limit).to_list()

        return {
            "sites": popular_sites,
            "total": len(popular_sites),
            "category": category,
            "criteria": "Based on favorites and views"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get popular sites: {str(e)}")
