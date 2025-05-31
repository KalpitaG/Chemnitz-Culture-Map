from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional

# Import database and models
from database import init_database, close_database, db_manager
from models import CulturalSite, Category, CategoryType, User, ParkingLot, District

# Lifespan event handler for FastAPI startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Chemnitz Cultural Sites API...")
    await init_database()
    print("Database initialized and ready!")
    
    yield
    
    # Shutdown
    print("Shutting down API...")
    await close_database()
    print("Database connections closed")

# Create FastAPI application
app = FastAPI(
    title="Chemnitz Cultural Sites API",
    description="API for managing cultural sites in Chemnitz, Germany",
    version="1.0.0",
    docs_url="/docs",  # Swagger UI at /docs
    redoc_url="/redoc",  # ReDoc at /redoc
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React default
        "http://localhost:5173",  # Vite default
        "http://127.0.0.1:5173",
        "http://localhost:8080"   # Alternative ports
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    """Welcome endpoint"""
    return {
        "message": "Welcome to Chemnitz Cultural Sites API!",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "operational"
    }

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check with database statistics"""
    try:
        stats = await db_manager.get_database_stats()
        return {
            "status": "healthy",
            "database": "connected",
            "api_version": "1.0.0",
            "statistics": stats
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database health check failed: {str(e)}")

# Category endpoints
@app.get("/api/categories", response_model=List[Category])
async def get_categories():
    """Get all cultural site categories"""
    try:
        categories = await Category.find_all().to_list()
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

@app.get("/api/categories/{category_name}")
async def get_category_by_name(category_name: CategoryType):
    """Get a specific category by name"""
    try:
        category = await Category.find_one(Category.name == category_name)
        if not category:
            raise HTTPException(status_code=404, detail=f"Category '{category_name}' not found")
        return category
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid category name: {category_name}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch category: {str(e)}")

# Districts endpoints for dropdown and filtering
@app.get("/api/districts")
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

@app.get("/api/districts/names")
async def get_district_names():
    """Get district names only for dropdown (performance optimized)"""
    try:
        # Get all districts - the name field is actually "STADTTNAME" based on your data
        districts = await District.find().to_list()
        
        district_names = []
        for d in districts:
            # Check different possible name fields from your GeoJSON
            name = None
            if hasattr(d, 'properties') and d.properties:
                # Try STADTTNAME first (most likely based on your data)
                name = d.properties.get('STADTTNAME') or d.properties.get('name') or d.properties.get('NAME')
            
            # Fallback to direct name field
            if not name and hasattr(d, 'name'):
                name = d.name
                
            if name:
                district_names.append({
                    "id": str(d.id),
                    "name": name
                })
        
        # Remove duplicates and sort
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

# Enhanced Cultural Sites endpoint 
@app.get("/api/cultural-sites")
async def get_cultural_sites(
    category: Optional[CategoryType] = None,
    source: Optional[str] = None,
    district: Optional[str] = None, 
    limit: int = Query(default=100, le=100000),  # Default to 100 for performance
    skip: int = 0,
    search: Optional[str] = None,
    include_parking: bool = Query(default=False), 
    include_districts: bool = Query(default=False) 
):
    """
    Get cultural sites with optional filtering - Performance Optimized
    
    - **category**: Filter by category (theatre, museum, restaurant, artwork)
    - **source**: Filter by data source (chemnitz_geojson, sachsen_geojson)
    - **district**: Filter by district name
    - **limit**: Maximum number of results (default 100, max 100000)
    - **skip**: Number of results to skip for pagination
    - **search**: Search in name, description, and address
    - **include_parking**: Include parking lots in response
    - **include_districts**: Include district boundaries in response
    """
    try:
        query = {"is_active": True}
        
        if category:
            query["category"] = category

        if source:
            query["source"] = source
            
        #District filtering via geospatial query
        if district:
            # Find the district first
           district_doc = None  # Store the district for later use
        if district:
            # Find the district first
            district_doc = await District.find_one({"properties.STADTTNAME": district})
            if district_doc:
                # Use geospatial query to find sites within district
                query["location"] = {
                    "$geoWithin": {
                        "$geometry": district_doc.geometry
                    }
                }
            
        if search:
            query["$text"] = {"$search": search}
        
        # Execute query with limit for performance
        sites = await CulturalSite.find(query).skip(skip).limit(limit).to_list()
        
        # Prepare response
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
        
        if include_parking:
            parking_query = {"is_active": True}
            if district and district_doc:
                parking_query["location"] = {
                    "$geoWithin": {
                        "$geometry": district_doc.geometry
                    }
                }
            
            parking_lots = await ParkingLot.find(parking_query).limit(50).to_list()
            response["parking_lots"] = parking_lots
        
        # Optionally include district boundaries
        if include_districts:
            if district and district_doc:
                # Only return the specific district
                response["districts"] = [district_doc]
            else:
                # Return all districts
                districts = await District.find().to_list()
                response["districts"] = districts
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cultural sites: {str(e)}")

# Parking endpoints
@app.get("/api/parking-lots")
async def get_parking_lots(
    parking_type: Optional[str] = None,
    district: Optional[str] = None,  # District filtering
    limit: int = 50
):
    """Get parking lots with optional filtering"""
    try:
        query = {"is_active": True}
        
        if parking_type:
            query["parking_type"] = parking_type
            
        # District filtering for parking
        if district:
            district_doc = await District.find_one({"name": district})
            if district_doc:
                query["location"] = {
                    "$geoWithin": {
                        "$geometry": district_doc.geometry
                    }
                }
        
        parking_lots = await ParkingLot.find(query).limit(limit).to_list()
        
        return {
            "parking_lots": parking_lots,
            "total": len(parking_lots),
            "filters": {
                "parking_type": parking_type,
                "district": district
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch parking lots: {str(e)}")

@app.get("/api/parking-lots/near")
async def get_parking_near_location(
    lng: float,
    lat: float,
    max_distance: int = 2000,  # 2km default for parking
    parking_type: Optional[str] = None
):
    """Find parking lots near coordinates"""
    try:
        geo_query = {
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat]
                    },
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

# Geospatial endpoints for "10 Minute City" feature
@app.get("/api/cultural-sites/near")
async def get_sites_near_location(
    lng: float,
    lat: float,
    max_distance: int = 1000,  # meters
    category: Optional[CategoryType] = None
):
    """
    Find cultural sites within specified distance of coordinates
    
    - **lng**: Longitude (-180 to 180)
    - **lat**: Latitude (-90 to 90)  
    - **max_distance**: Maximum distance in meters (default 1000m = 1km)
    - **category**: Optional category filter
    """
    try:
        # Validate coordinates
        if not (-180 <= lng <= 180):
            raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")
        if not (-90 <= lat <= 90):
            raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
        
        # Build geospatial query
        geo_query = {
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat]
                    },
                    "$maxDistance": max_distance
                }
            },
            "is_active": True
        }
        
        if category:
            geo_query["category"] = category
        
        # Execute query
        sites = await CulturalSite.find(geo_query).to_list()
        
        return {
            "sites": sites,
            "total": len(sites),
            "search_center": {"longitude": lng, "latitude": lat},
            "max_distance_meters": max_distance,
            "category_filter": category
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to find nearby sites: {str(e)}")

@app.get("/api/cultural-sites/{site_id}")
async def get_cultural_site_by_id(site_id: str):
    """Get a specific cultural site by ID"""
    try:
        site = await CulturalSite.get(site_id)
        if not site:
            raise HTTPException(status_code=404, detail=f"Cultural site with ID '{site_id}' not found")
        return site
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cultural site: {str(e)}")

#Performance endpoint for quick counts
@app.get("/api/stats/quick")
async def get_quick_stats():
    """Get quick statistics for UI components (optimized for speed)"""
    try:
        total_sites = await CulturalSite.count({"is_active": True})
        chemnitz_sites = await CulturalSite.count({"is_active": True, "source": "chemnitz_geojson"})
        sachsen_sites = await CulturalSite.count({"is_active": True, "source": "sachsen_geojson"})
        total_parking = await ParkingLot.count({"is_active": True})
        total_districts = await District.count()
        
        # Quick category counts
        category_stats = {}
        for category in CategoryType:
            count = await CulturalSite.count({"category": category, "is_active": True})
            category_stats[category.value] = count
        
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


# Statistics endpoint for admin dashboard
@app.get("/api/stats/overview")
async def get_overview_statistics():
    """Get overview statistics for admin dashboard"""
    try:
        # Get basic counts
        total_sites = await CulturalSite.count()
        active_sites = await CulturalSite.find({"is_active": True}).count()
        total_users = await User.count() if 'User' in globals() else 0
        
        # Count by category
        category_stats = {}
        for category in CategoryType:
            count = await CulturalSite.find({"category": category, "is_active": True}).count()
            category_stats[category.value] = count
        
        return {
            "total_sites": total_sites,
            "active_sites": active_sites,
            "inactive_sites": total_sites - active_sites,
            "total_users": total_users,
            "sites_by_category": category_stats,
            "database_stats": await db_manager.get_database_stats()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch statistics: {str(e)}")

# Test endpoint to create sample data
@app.post("/api/test/create-sample-site")
async def create_sample_site():
    """Create a sample cultural site for testing (remove in production)"""
    try:
        sample_site = CulturalSite(
            name="Sample Chemnitz Opera House",
            category=CategoryType.THEATRE,
            description="A beautiful opera house in the heart of Chemnitz",
            address="Theaterplatz 2, 09111 Chemnitz",
            location={
                "type": "Point",
                "coordinates": [12.9214, 50.8279]  # [longitude, latitude]
            },
            website="https://example.com/opera",
            source="manual"
        )
        
        await sample_site.save()
        
        return {
            "message": "Sample site created successfully",
            "site_id": str(sample_site.id),
            "site": sample_site
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create sample site: {str(e)}")

# Development server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )