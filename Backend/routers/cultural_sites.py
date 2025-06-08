# Backend/routers/cultural_sites.py

from fastapi import APIRouter, HTTPException, Query, Depends, status
from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime

from bson import ObjectId

# Import models & authentication dependency
from models import CulturalSite, CategoryType, District, User
from auth import get_current_user

router = APIRouter(
    prefix="/api/cultural-sites",
    tags=["cultural_sites"]
)

# --- Pydantic schemas for create/update ------------

class CulturalSiteCreate(BaseModel):
    name: str
    category: CategoryType
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: float
    longitude: float
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    opening_hours: Optional[str] = None

class CulturalSiteUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[CategoryType] = None
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    opening_hours: Optional[str] = None

# --- GET /api/cultural-sites (with filters) ------

@router.get("")
async def get_cultural_sites(
    category: Optional[CategoryType] = None,
    source: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = Query(default=100, le=100000),
    skip: int = 0,
    search: Optional[str] = None,
    include_parking: bool = Query(default=False),
    include_districts: bool = Query(default=False)
):
    """
    Get cultural sites with optional filtering
    """
    try:
        query: Dict = {"is_active": True}
        district_doc = None

        if category:
            query["category"] = category
        if source:
            query["source"] = source

        if district:
            district_doc = await District.find_one({"properties.STADTTNAME": district})
            if district_doc:
                query["location"] = {"$geoWithin": {"$geometry": district_doc.geometry}}

        if search:
            query["$text"] = {"$search": search}

        sites = await CulturalSite.find(query).skip(skip).limit(limit).to_list()

        response = {
            "sites": sites,
            "total": len(sites),
            "filters": {
                "category": category,
                "source": source,
                "district": district,
                "search": search,
                "limit": limit,
                "skip": skip
            }
        }

        # include_parking and include_districts logic omitted here – 
        # move that to Parking router / District router as needed.

        if include_parking:
            from models import ParkingLot
            parking_query = {"is_active": True}
            if district and district_doc:
                parking_query["location"] = {"$geoWithin": {"$geometry": district_doc.geometry}}
            parking_lots = await ParkingLot.find(parking_query).limit(50).to_list()
            response["parking_lots"] = parking_lots

        if include_districts:
            if district and district_doc:
                response["districts"] = [district_doc]
            else:
                districts = await District.find().to_list()
                response["districts"] = districts

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cultural sites: {str(e)}")


# --- GET /api/cultural-sites/{site_id} -----------------

@router.get("/{site_id}")
async def get_cultural_site_by_id(site_id: str):
    """Get a specific cultural site by ID"""
    try:
        site = await CulturalSite.get(site_id)
        if not site:
            raise HTTPException(status_code=404, detail=f"Cultural site with ID '{site_id}' not found")
        return site
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cultural site: {str(e)}")


# --- POST /api/cultural-sites (Create) -------------------

@router.post("", response_model=dict)
async def create_cultural_site(
    site_data: CulturalSiteCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new cultural site (authenticated users only)"""
    try:
        cultural_site = CulturalSite(
            name=site_data.name,
            category=site_data.category,
            description=site_data.description,
            address=site_data.address,
            location={
                "type": "Point",
                "coordinates": [site_data.longitude, site_data.latitude]
            },
            website=site_data.website,
            phone=site_data.phone,
            email=site_data.email,
            opening_hours=site_data.opening_hours,
            source="user_created",
            properties={
                "created_by": str(current_user.id),
                "created_by_name": f"{current_user.first_name} {current_user.last_name}"
            }
        )
        await cultural_site.save()

        return {
            "message": "Cultural site created successfully",
            "site_id": str(cultural_site.id),
            "site": {
                "id": str(cultural_site.id),
                "name": cultural_site.name,
                "category": cultural_site.category,
                "description": cultural_site.description,
                "address": cultural_site.address,
                "location": cultural_site.location,
                "website": cultural_site.website,
                "phone": cultural_site.phone,
                "email": cultural_site.email,
                "opening_hours": cultural_site.opening_hours,
                "created_at": cultural_site.created_at,
                "created_by": f"{current_user.first_name} {current_user.last_name}"
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create cultural site: {str(e)}"
        )


# --- PUT /api/cultural-sites/{site_id} (Update) -----------

@router.put("/{site_id}")
async def update_cultural_site(
    site_id: str,
    site_data: CulturalSiteUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a cultural site (authenticated users only)"""
    try:
        cultural_site = await CulturalSite.get(site_id)
        if not cultural_site:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cultural site not found")

        created_by = cultural_site.properties.get("created_by") if cultural_site.properties else None
        if not current_user.is_admin and created_by != str(current_user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit sites you created")

        update_data = site_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field == "latitude":
                if hasattr(cultural_site, "location") and cultural_site.location:
                    cultural_site.location["coordinates"][1] = value
                else:
                    cultural_site.location = {"type": "Point", "coordinates": [0, value]}
            elif field == "longitude":
                if hasattr(cultural_site, "location") and cultural_site.location:
                    cultural_site.location["coordinates"][0] = value
                else:
                    cultural_site.location = {"type": "Point", "coordinates": [value, 0]}
            else:
                setattr(cultural_site, field, value)

        cultural_site.updated_at = datetime.utcnow()
        if not cultural_site.properties:
            cultural_site.properties = {}
        cultural_site.properties["last_updated_by"] = str(current_user.id)
        cultural_site.properties["last_updated_by_name"] = f"{current_user.first_name} {current_user.last_name}"

        await cultural_site.save()
        return {"message": "Cultural site updated successfully", "site_id": str(cultural_site.id), "updated_fields": list(update_data.keys())}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update cultural site: {str(e)}"
        )


# --- DELETE /api/cultural-sites/{site_id} (Soft delete) ---

@router.delete("/{site_id}")
async def delete_cultural_site(
    site_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a cultural site (soft delete)"""
    try:
        cultural_site = await CulturalSite.get(site_id)
        if not cultural_site:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cultural site not found")

        created_by = cultural_site.properties.get("created_by") if cultural_site.properties else None
        if not current_user.is_admin and created_by != str(current_user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete sites you created")

        cultural_site.is_active = False
        cultural_site.updated_at = datetime.utcnow()
        if not cultural_site.properties:
            cultural_site.properties = {}
        cultural_site.properties["deleted_by"] = str(current_user.id)
        cultural_site.properties["deleted_by_name"] = f"{current_user.first_name} {current_user.last_name}"
        cultural_site.properties["deleted_at"] = datetime.utcnow().isoformat()

        await cultural_site.save()
        return {"message": "Cultural site deleted successfully", "site_id": str(cultural_site.id), "deleted_by": f"{current_user.first_name} {current_user.last_name}"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete cultural site: {str(e)}"
        )


# --- PATCH /api/cultural-sites/{site_id}/restore (Admin only) ---

@router.patch("/{site_id}/restore")
async def restore_cultural_site(
    site_id: str,
    current_user: User = Depends(get_current_user)
):
    """Restore a deleted cultural site (admin only)"""
    try:
        if not current_user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can restore deleted sites")

        cultural_site = await CulturalSite.get(site_id)
        if not cultural_site:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cultural site not found")

        cultural_site.is_active = True
        cultural_site.updated_at = datetime.utcnow()
        if not cultural_site.properties:
            cultural_site.properties = {}
        cultural_site.properties["restored_by"] = str(current_user.id)
        cultural_site.properties["restored_by_name"] = f"{current_user.first_name} {current_user.last_name}"
        cultural_site.properties["restored_at"] = datetime.utcnow().isoformat()

        await cultural_site.save()
        return {"message": "Cultural site restored successfully", "site_id": str(cultural_site.id), "restored_by": f"{current_user.first_name} {current_user.last_name}"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore cultural site: {str(e)}"
        )


# --- GET /api/cultural-sites/my-sites ------------------------

@router.get("/my-sites")
async def get_my_cultural_sites(
    current_user: User = Depends(get_current_user),
    include_deleted: bool = False
):
    """Get cultural sites created by the current user"""
    try:
        query = {"properties.created_by": str(current_user.id)}
        if not include_deleted:
            query["is_active"] = True

        my_sites = await CulturalSite.find(query).to_list()
        return {
            "sites": my_sites,
            "total": len(my_sites),
            "user": f"{current_user.first_name} {current_user.last_name}",
            "include_deleted": include_deleted
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch user sites: {str(e)}")
