# Backend/routers/districts.py

from fastapi import APIRouter, HTTPException
from typing import List, Dict
from models import District

router = APIRouter(
    prefix="/api/districts",
    tags=["districts"]
)

@router.get("")
async def get_districts():
    """Get all district boundaries with geometry"""
    try:
        districts = await District.find().to_list()
        return {
            "districts": districts,
            "total": len(districts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch districts: {str(e)}")

@router.get("/names")
async def get_district_names():
    """Get district names only for dropdown (performance optimized)"""
    try:
        districts = await District.find().to_list()
        district_names = []
        for d in districts:
            name = None
            if hasattr(d, "properties") and d.properties:
                name = d.properties.get("STADTTNAME") or d.properties.get("name") or d.properties.get("NAME")
            if not name and hasattr(d, "name"):
                name = d.name
            if name:
                district_names.append({"id": str(d.id), "name": name})

        unique_districts = {}
        for district in district_names:
            if district["name"] not in unique_districts:
                unique_districts[district["name"]] = district

        sorted_districts = sorted(unique_districts.values(), key=lambda x: x["name"])
        return {
            "districts": sorted_districts,
            "total": len(sorted_districts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch district names: {str(e)}")
