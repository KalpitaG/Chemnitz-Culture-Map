# Backend/routers/parking.py

from fastapi import APIRouter, HTTPException
from typing import Optional
from models import ParkingLot, District

router = APIRouter(
    prefix="/api/parking-lots",
    tags=["parking"]
)

@router.get("")
async def get_parking_lots(
    parking_type: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = 50
):
    """Get parking lots with optional filtering"""
    try:
        query = {"is_active": True}
        if parking_type:
            query["parking_type"] = parking_type

        if district:
            district_doc = await District.find_one({"properties.STADTTNAME": district})
            if district_doc:
                query["location"] = {"$geoWithin": {"$geometry": district_doc.geometry}}

        parking_lots = await ParkingLot.find(query).limit(limit).to_list()
        return {
            "parking_lots": parking_lots,
            "total": len(parking_lots),
            "filters": {"parking_type": parking_type, "district": district}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parking lots: {str(e)}")

@router.get("/near")
async def get_parking_near_location(
    lng: float,
    lat: float,
    max_distance: int = 2000,
    parking_type: Optional[str] = None
):
    """Find parking lots near coordinates"""
    try:
        geo_query = {
            "location": {
                "$near": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "$maxDistance": max_distance
                }
            },
            "is_active": True
        }
        if parking_type:
            geo_query["parking_type"] = parking_type

        parking_lots = await ParkingLot.find(geo_query).to_list()
        return {
            "parking_lots": parking_lots,
            "total": len(parking_lots),
            "search_center": {"longitude": lng, "latitude": lat},
            "max_distance_meters": max_distance,
            "parking_type_filter": parking_type
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to find nearby parking: {str(e)}")
