# Backend/routers/geospatial.py

from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any
from datetime import datetime
import math
from bson import ObjectId

from models import CulturalSite, CategoryType, District

from pydantic import BaseModel

router = APIRouter(
    prefix="/api/geospatial",
    tags=["geospatial"]
)

# Pydantic response models
class ProximitySite(BaseModel):
    site: dict
    distance_meters: float
    distance_km: float
    walking_time_minutes: int
    driving_time_minutes: int

class ProximitySearchResponse(BaseModel):
    sites: List[ProximitySite]
    search_center: Dict[str, float]
    search_radius_meters: int
    total_found: int
    statistics: Dict[str, Any]

class GeospatialCluster(BaseModel):
    center_lat: float
    center_lng: float
    sites_count: int
    categories: List[str]
    sites: List[str]

# --- GET /api/geospatial/proximity ----------------------

@router.get("/proximity", response_model=ProximitySearchResponse)
async def proximity_search(
    lat: float,
    lng: float,
    radius: int = 1000,
    category: Optional[CategoryType] = None,
    max_results: int = 50,
    include_inactive: bool = False,
    sort_by: str = "distance"
):
    """Enhanced proximity search with distance calculations and travel times"""
    try:
        if not (-90 <= lat <= 90):
            raise HTTPException(status_code=400, detail="Invalid latitude")
        if not (-180 <= lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid longitude")
        if radius <= 0 or radius > 50000:
            raise HTTPException(status_code=400, detail="Radius must be between 1 and 50000 meters")

        pipeline = [
            {
                "$geoNear": {
                    "near": {"type": "Point", "coordinates": [lng, lat]},
                    "distanceField": "distance",
                    "maxDistance": radius,
                    "spherical": True,
                    "query": {"is_active": True} if not include_inactive else {"is_active": {"$in": [True, False]}}
                }
            }
        ]
        if category:
            pipeline.append({"$match": {"category": category}})
        if sort_by == "popularity":
            pipeline.append({"$sort": {"favorite_count": -1, "view_count": -1, "distance": 1}})
        elif sort_by == "name":
            pipeline.append({"$sort": {"name": 1}})
        else:
            pipeline.append({"$sort": {"distance": 1}})
        pipeline.append({"$limit": max_results})

        results = await CulturalSite.aggregate(pipeline).to_list()

        proximity_sites: List[ProximitySite] = []
        for result in results:
            distance_meters = result["distance"]
            distance_km = distance_meters / 1000

            walking_time_min = int((distance_km / 5) * 60)
            driving_time_min = max(1, int((distance_km / 30) * 60))

            site_data = {k: v for k, v in result.items() if k not in ["distance"]}
            if "_id" in site_data:
                site_data["id"] = str(site_data.pop("_id"))

            proximity_sites.append(
                ProximitySite(
                    site=site_data,
                    distance_meters=round(distance_meters, 2),
                    distance_km=round(distance_km, 3),
                    walking_time_minutes=walking_time_min,
                    driving_time_minutes=driving_time_min
                )
            )

        if proximity_sites:
            distances = [p.distance_meters for p in proximity_sites]
            categories_found = list({p.site.get("category") for p in proximity_sites})
            statistics = {
                "avg_distance_meters": round(sum(distances) / len(distances), 2),
                "min_distance_meters": min(distances),
                "max_distance_meters": max(distances),
                "categories_found": categories_found,
                "category_counts": {cat: sum(1 for p in proximity_sites if p.site.get("category") == cat) for cat in categories_found}
            }
        else:
            statistics = {"avg_distance_meters": 0, "min_distance_meters": 0, "max_distance_meters": 0, "categories_found": [], "category_counts": {}}

        return ProximitySearchResponse(
            sites=proximity_sites,
            search_center={"lat": lat, "lng": lng},
            search_radius_meters=radius,
            total_found=len(proximity_sites),
            statistics=statistics
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proximity search failed: {str(e)}")


# --- GET /api/geospatial/clusters ------------------------

@router.get("/clusters")
async def get_site_clusters(
    ne_lat: float,
    ne_lng: float,
    sw_lat: float,
    sw_lng: float,
    zoom_level: int = 10,
    category: Optional[CategoryType] = None
):
    """Get clustered sites within a bounding box for map visualization"""
    try:
        if not (-90 <= sw_lat <= ne_lat <= 90):
            raise HTTPException(status_code=400, detail="Invalid latitude bounds")
        if not (-180 <= sw_lng <= ne_lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid longitude bounds")

        cluster_size_degrees = 0.1 / (2 ** (zoom_level - 10))
        match_stage = {
            "location": {"$geoWithin": {"$box": [[sw_lng, sw_lat], [ne_lng, ne_lat]]}},
            "is_active": True
        }
        if category:
            match_stage["category"] = category

        pipeline = [
            {"$match": match_stage},
            {"$addFields": {
                "lng": {"$arrayElemAt": ["$location.coordinates", 0]},
                "lat": {"$arrayElemAt": ["$location.coordinates", 1]}
            }},
            {"$addFields": {
                "cluster_lng": {
                    "$multiply": [
                        {"$floor": {"$divide": ["$lng", cluster_size_degrees]}},
                        cluster_size_degrees
                    ]
                },
                "cluster_lat": {
                    "$multiply": [
                        {"$floor": {"$divide": ["$lat", cluster_size_degrees]}},
                        cluster_size_degrees
                    ]
                }
            }},
            {"$group": {
                "_id": {"cluster_lng": "$cluster_lng", "cluster_lat": "$cluster_lat"},
                "sites": {"$push": {"id": "$_id", "name": "$name", "category": "$category"}},
                "categories": {"$addToSet": "$category"},
                "count": {"$sum": 1},
                "avg_lng": {"$avg": "$lng"},
                "avg_lat": {"$avg": "$lat"}
            }},
            {"$sort": {"count": -1}}
        ]

        clusters_data = await CulturalSite.aggregate(pipeline).to_list()
        clusters = []
        for cd in clusters_data:
            clusters.append(GeospatialCluster(
                center_lat=cd["avg_lat"],
                center_lng=cd["avg_lng"],
                sites_count=cd["count"],
                categories=cd["categories"],
                sites=[str(site["id"]) for site in cd["sites"]]
            ))

        return {
            "clusters": clusters,
            "total_clusters": len(clusters),
            "bounding_box": {"ne_lat": ne_lat, "ne_lng": ne_lng, "sw_lat": sw_lat, "sw_lng": sw_lng},
            "zoom_level": zoom_level,
            "cluster_size_degrees": cluster_size_degrees
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


# --- GET /api/geospatial/route ---------------------------

@router.get("/route")
async def calculate_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    waypoints: Optional[List[str]] = None
):
    """Calculate route between points with optional waypoints (basic)"""
    try:
        def haversine_distance(lat1, lng1, lat2, lng2):
            R = 6371  
            dlat = math.radians(lat2 - lat1)
            dlng = math.radians(lng2 - lng1)
            a = (math.sin(dlat/2) ** 2 +
                 math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
                 math.sin(dlng/2) ** 2)
            c = 2 * math.asin(math.sqrt(a))
            return R * c

        direct_distance = haversine_distance(start_lat, start_lng, end_lat, end_lng)
        route_points = [{"lat": start_lat, "lng": start_lng, "type": "start"}]

        total_distance = 0
        current_lat, current_lng = start_lat, start_lng

        waypoint_sites = []
        if waypoints:
            valid_waypoint_ids = [ObjectId(wp) for wp in waypoints if ObjectId.is_valid(wp)]
            if valid_waypoint_ids:
                waypoint_sites = await CulturalSite.find({"_id": {"$in": valid_waypoint_ids}, "is_active": True}).to_list()

        for site in waypoint_sites:
            site_lat = site.location["coordinates"][1]
            site_lng = site.location["coordinates"][0]
            segment_distance = haversine_distance(current_lat, current_lng, site_lat, site_lng)
            total_distance += segment_distance
            route_points.append({
                "lat": site_lat,
                "lng": site_lng,
                "type": "waypoint",
                "site_id": str(site.id),
                "site_name": site.name,
                "distance_from_previous": segment_distance
            })
            current_lat, current_lng = site_lat, site_lng

        final_distance = haversine_distance(current_lat, current_lng, end_lat, end_lng)
        total_distance += final_distance
        route_points.append({"lat": end_lat, "lng": end_lng, "type": "end", "distance_from_previous": final_distance})

        walking_time = int((total_distance / 5) * 60)
        cycling_time = int((total_distance / 15) * 60)
        driving_time = int((total_distance / 30) * 60)

        return {
            "route": route_points,
            "total_distance_km": round(total_distance, 3),
            "direct_distance_km": round(direct_distance, 3),
            "estimated_times": {
                "walking_minutes": walking_time,
                "cycling_minutes": cycling_time,
                "driving_minutes": driving_time
            },
            "waypoints_count": len(waypoints) if waypoints else 0,
            "note": "Simplified route. For production, integrate with a routing service."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Route calculation failed: {str(e)}")


# --- GET /api/geospatial/within-district/{district_name} --

@router.get("/within-district/{district_name}")
async def get_sites_within_district(
    district_name: str,
    category: Optional[CategoryType] = None,
    sort_by: str = "name",
    limit: int = 100
):
    """Get all sites within a specific district"""
    try:
        district = await District.find_one({"properties.STADTTNAME": district_name})
        if not district:
            raise HTTPException(status_code=404, detail=f"District '{district_name}' not found")

        query = {"location": {"$geoWithin": {"$geometry": district.geometry}}, "is_active": True}
        if category:
            query["category"] = category

        if sort_by == "name":
            sort_criteria = [("name", 1)]
        elif sort_by == "category":
            sort_criteria = [("category", 1), ("name", 1)]
        elif sort_by == "popularity":
            sort_criteria = [("favorite_count", -1), ("view_count", -1)]
        else:
            sort_criteria = [("created_at", -1)]

        sites = await CulturalSite.find(query).sort(sort_criteria).limit(limit).to_list()

        category_breakdown = {}
        for s in sites:
            c = s.category
            category_breakdown[c] = category_breakdown.get(c, 0) + 1

        return {
            "district": {"name": district_name, "id": str(district.id)},
            "sites": sites,
            "statistics": {
                "total_sites": len(sites),
                "category_breakdown": category_breakdown,
                "most_common_category": max(category_breakdown.items(), key=lambda x: x[1])[0] if category_breakdown else None
            },
            "filters": {"category": category, "sort_by": sort_by, "limit": limit}
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"District search failed: {str(e)}")
