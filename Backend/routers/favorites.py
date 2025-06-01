# Backend/routers/favorites.py

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from models import CulturalSite, User, UserActivity, ActivityType
from pydantic import BaseModel
from auth import get_current_user

router = APIRouter(
    prefix="/api/favorites",
    tags=["favorites"]
)

class FavoriteResponse(BaseModel):
    site_id: str
    site_name: str
    site_category: str
    site_address: Optional[str]
    favorited_at: datetime
    is_favorite: bool = True

class UserFavoritesResponse(BaseModel):
    user_id: str
    favorites: List[FavoriteResponse]
    total_favorites: int

@router.post("/{site_id}")
async def add_to_favorites(site_id: str, current_user: User = Depends(get_current_user)):
    """Add a cultural site to user's favorites"""
    try:
        site = await CulturalSite.get(site_id)
        if not site:
            raise HTTPException(status_code=404, detail="Cultural site not found")
        if not site.is_active:
            raise HTTPException(status_code=400, detail="Cannot favorite inactive site")
        if site_id in current_user.favorite_sites:
            raise HTTPException(status_code=400, detail="Site already in favorites")

        current_user.favorite_sites.append(site_id)
        current_user.updated_at = datetime.utcnow()
        await current_user.save()

        site.favorite_count += 1
        await site.save()

        activity = UserActivity(
            user_id=str(current_user.id),
            site_id=site_id,
            activity_type=ActivityType.FAVORITE,
            metadata={"site_name": site.name, "site_category": site.category}
        )
        await activity.save()

        return {
            "message": "Site added to favorites",
            "site_id": site_id,
            "site_name": site.name,
            "total_favorites": len(current_user.favorite_sites),
            "site_favorite_count": site.favorite_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add to favorites: {str(e)}")


@router.delete("/{site_id}")
async def remove_from_favorites(site_id: str, current_user: User = Depends(get_current_user)):
    """Remove a cultural site from user's favorites"""
    try:
        site = await CulturalSite.get(site_id)
        if not site:
            raise HTTPException(status_code=404, detail="Cultural site not found")
        if site_id not in current_user.favorite_sites:
            raise HTTPException(status_code=400, detail="Site not in favorites")

        current_user.favorite_sites.remove(site_id)
        current_user.updated_at = datetime.utcnow()
        await current_user.save()

        if site.favorite_count > 0:
            site.favorite_count -= 1
            await site.save()

        activity = UserActivity(
            user_id=str(current_user.id),
            site_id=site_id,
            activity_type=ActivityType.UNFAVORITE,
            metadata={"site_name": site.name, "site_category": site.category}
        )
        await activity.save()

        return {
            "message": "Site removed from favorites",
            "site_id": site_id,
            "site_name": site.name,
            "total_favorites": len(current_user.favorite_sites),
            "site_favorite_count": site.favorite_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove from favorites: {str(e)}")


@router.get("", response_model=UserFavoritesResponse)
async def get_user_favorites(current_user: User = Depends(get_current_user), include_inactive: bool = False):
    """Get user's favorite cultural sites"""
    try:
        if not current_user.favorite_sites:
            return UserFavoritesResponse(user_id=str(current_user.id), favorites=[], total_favorites=0)

        valid_object_ids = []
        for sid in current_user.favorite_sites:
            if ObjectId.is_valid(sid):
                valid_object_ids.append(ObjectId(sid))

        if not valid_object_ids:
            return UserFavoritesResponse(user_id=str(current_user.id), favorites=[], total_favorites=0)

        query = {"_id": {"$in": valid_object_ids}}
        if not include_inactive:
            query["is_active"] = True

        favorite_sites = await CulturalSite.find(query).to_list()
        activities = await UserActivity.find({
            "user_id": str(current_user.id),
            "activity_type": ActivityType.FAVORITE,
            "site_id": {"$in": current_user.favorite_sites}
        }).sort([("timestamp", -1)]).to_list()

        activity_lookup = {activity.site_id: activity.timestamp for activity in activities}
        favorites = []
        for site in favorite_sites:
            fav = FavoriteResponse(
                site_id=str(site.id),
                site_name=site.name,
                site_category=site.category,
                site_address=site.address,
                favorited_at=activity_lookup.get(str(site.id), site.created_at)
            )
            favorites.append(fav)

        favorites.sort(key=lambda x: x.favorited_at, reverse=True)
        return UserFavoritesResponse(user_id=str(current_user.id), favorites=favorites, total_favorites=len(favorites))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get favorites: {str(e)}")


@router.get("/check/{site_id}")
async def check_favorite_status(site_id: str, current_user: User = Depends(get_current_user)):
    """Check if a site is in user's favorites"""
    try:
        is_favorite = site_id in current_user.favorite_sites
        return {"site_id": site_id, "is_favorite": is_favorite, "user_id": str(current_user.id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check favorite status: {str(e)}")


@router.post("/bulk")
async def bulk_favorite_operations(operations: List[dict], current_user: User = Depends(get_current_user)):
    """Bulk add/remove favorites"""
    try:
        results = []
        for operation in operations:
            action = operation.get("action")
            site_id = operation.get("site_id")
            if not action or not site_id:
                results.append({"site_id": site_id, "action": action, "success": False, "error": "Missing action or site_id"})
                continue

            try:
                if action == "add":
                    if site_id not in current_user.favorite_sites:
                        site = await CulturalSite.get(site_id)
                        if site and site.is_active:
                            current_user.favorite_sites.append(site_id)
                            site.favorite_count += 1
                            await site.save()

                            activity = UserActivity(user_id=str(current_user.id), site_id=site_id, activity_type=ActivityType.FAVORITE)
                            await activity.save()

                            results.append({"site_id": site_id, "action": action, "success": True})
                        else:
                            results.append({"site_id": site_id, "action": action, "success": False, "error": "Site not found or inactive"})
                    else:
                        results.append({"site_id": site_id, "action": action, "success": False, "error": "Already in favorites"})

                elif action == "remove":
                    if site_id in current_user.favorite_sites:
                        current_user.favorite_sites.remove(site_id)

                        site = await CulturalSite.get(site_id)
                        if site and site.favorite_count > 0:
                            site.favorite_count -= 1
                            await site.save()

                        activity = UserActivity(user_id=str(current_user.id), site_id=site_id, activity_type=ActivityType.UNFAVORITE)
                        await activity.save()

                        results.append({"site_id": site_id, "action": action, "success": True})
                    else:
                        results.append({"site_id": site_id, "action": action, "success": False, "error": "Not in favorites"})
            except Exception as e:
                results.append({"site_id": site_id, "action": action, "success": False, "error": str(e)})

        current_user.updated_at = datetime.utcnow()
        await current_user.save()

        successful_ops = sum(1 for r in results if r["success"])
        return {"message": f"Bulk operation completed: {successful_ops}/{len(operations)} successful", "results": results, "total_favorites": len(current_user.favorite_sites)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk operation failed: {str(e)}")
