from dotenv import load_dotenv
import os
load_dotenv()
from fastapi import FastAPI, HTTPException, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional

# Import database and models
from database import init_database, close_database, db_manager
from models import CulturalSite, Category, CategoryType, User, ParkingLot, District

# Authentication Imports
from auth import AuthService, UserCreate, UserLogin, Token, UserResponse, get_current_user
from datetime import timedelta
from datetime import datetime

# CRUD
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId

# Favourite
from models import UserActivity, ActivityType

# Geospatial operations
from typing import List, Dict, Any
import math

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

# JWT Authentication Endpoints
@app.post("/api/auth/register", response_model=Token)
async def register_user(user_data: UserCreate):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = await User.find_one(User.email == user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Hash password
        hashed_password = AuthService.get_password_hash(user_data.password)
        
        # Create user
        user = User(
            email=user_data.email,
            password_hash=hashed_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            is_active=True,
            is_admin=False
        )
        
        await user.save()
        
        # Create access token
        access_token_expires = timedelta(minutes=30)
        access_token = AuthService.create_access_token(
            data={"sub": str(user.id)}, 
            expires_delta=access_token_expires
        )
        
        # Return token and user info
        user_response = UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register user: {str(e)}"
        )

@app.post("/api/auth/login", response_model=Token)
async def login_user(user_credentials: UserLogin):
    """Login user and return JWT token"""
    try:
        # Find user by email
        user = await User.find_one(User.email == user_credentials.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verify password
        if not AuthService.verify_password(user_credentials.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=30)
        access_token = AuthService.create_access_token(
            data={"sub": str(user.id)}, 
            expires_delta=access_token_expires
        )
        
        # Update last login
        user.last_login = datetime.utcnow()
        await user.save()
        
        # Return token and user info
        user_response = UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at
    )

@app.post("/api/auth/logout")
async def logout_user():
    """Logout user (client should delete token)"""
    return {"message": "Successfully logged out"}

@app.get("/api/auth/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    """Example protected endpoint"""
    return {
        "message": f"Hello {current_user.first_name}! This is a protected route.",
        "user_id": str(current_user.id),
        "email": current_user.email
    }

# Pydantic models for CRUD operations
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

# CULTURAL SITES CRUD ENDPOINTS
@app.post("/api/cultural-sites", response_model=dict)
async def create_cultural_site(
    site_data: CulturalSiteCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new cultural site (authenticated users only)"""
    try:
        # Create the cultural site
        cultural_site = CulturalSite(
            name=site_data.name,
            category=site_data.category,
            description=site_data.description,
            address=site_data.address,
            location={
                "type": "Point",
                "coordinates": [site_data.longitude, site_data.latitude]  # [lng, lat]
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

@app.put("/api/cultural-sites/{site_id}")
async def update_cultural_site(
    site_id: str,
    site_data: CulturalSiteUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a cultural site (authenticated users only)"""
    try:
        # Find the cultural site
        cultural_site = await CulturalSite.get(site_id)
        if not cultural_site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cultural site not found"
            )
        
        # Check if user can edit (site creator or admin)
        created_by = cultural_site.properties.get("created_by") if cultural_site.properties else None
        if not current_user.is_admin and created_by != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit sites you created"
            )
        
        # Update fields that were provided
        update_data = site_data.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            if field == "latitude":
                # Update location coordinates
                if hasattr(cultural_site, 'location') and cultural_site.location:
                    cultural_site.location["coordinates"][1] = value
                else:
                    cultural_site.location = {
                        "type": "Point", 
                        "coordinates": [0, value]
                    }
            elif field == "longitude":
                # Update location coordinates
                if hasattr(cultural_site, 'location') and cultural_site.location:
                    cultural_site.location["coordinates"][0] = value
                else:
                    cultural_site.location = {
                        "type": "Point", 
                        "coordinates": [value, 0]
                    }
            else:
                setattr(cultural_site, field, value)
        
        # Update metadata
        cultural_site.updated_at = datetime.utcnow()
        if not cultural_site.properties:
            cultural_site.properties = {}
        cultural_site.properties["last_updated_by"] = str(current_user.id)
        cultural_site.properties["last_updated_by_name"] = f"{current_user.first_name} {current_user.last_name}"
        
        await cultural_site.save()
        
        return {
            "message": "Cultural site updated successfully",
            "site_id": str(cultural_site.id),
            "updated_fields": list(update_data.keys())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update cultural site: {str(e)}"
        )

@app.delete("/api/cultural-sites/{site_id}")
async def delete_cultural_site(
    site_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a cultural site (soft delete - authenticated users only)"""
    try:
        # Find the cultural site
        cultural_site = await CulturalSite.get(site_id)
        if not cultural_site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cultural site not found"
            )
        
        # Check if user can delete (site creator or admin)
        created_by = cultural_site.properties.get("created_by") if cultural_site.properties else None
        if not current_user.is_admin and created_by != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete sites you created"
            )
        
        # Soft delete (set is_active to False instead of actual deletion)
        cultural_site.is_active = False
        cultural_site.updated_at = datetime.utcnow()
        if not cultural_site.properties:
            cultural_site.properties = {}
        cultural_site.properties["deleted_by"] = str(current_user.id)
        cultural_site.properties["deleted_by_name"] = f"{current_user.first_name} {current_user.last_name}"
        cultural_site.properties["deleted_at"] = datetime.utcnow().isoformat()
        
        await cultural_site.save()
        
        return {
            "message": "Cultural site deleted successfully",
            "site_id": str(cultural_site.id),
            "deleted_by": f"{current_user.first_name} {current_user.last_name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete cultural site: {str(e)}"
        )

@app.patch("/api/cultural-sites/{site_id}/restore")
async def restore_cultural_site(
    site_id: str,
    current_user: User = Depends(get_current_user)
):
    """Restore a deleted cultural site (admin only)"""
    try:
        # Only admins can restore
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can restore deleted sites"
            )
        
        # Find the cultural site
        cultural_site = await CulturalSite.get(site_id)
        if not cultural_site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cultural site not found"
            )
        
        # Restore the site
        cultural_site.is_active = True
        cultural_site.updated_at = datetime.utcnow()
        if not cultural_site.properties:
            cultural_site.properties = {}
        cultural_site.properties["restored_by"] = str(current_user.id)
        cultural_site.properties["restored_by_name"] = f"{current_user.first_name} {current_user.last_name}"
        cultural_site.properties["restored_at"] = datetime.utcnow().isoformat()
        
        await cultural_site.save()
        
        return {
            "message": "Cultural site restored successfully",
            "site_id": str(cultural_site.id),
            "restored_by": f"{current_user.first_name} {current_user.last_name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore cultural site: {str(e)}"
        )

@app.get("/api/cultural-sites/my-sites")
async def get_my_cultural_sites(
    current_user: User = Depends(get_current_user),
    include_deleted: bool = False
):
    """Get cultural sites created by the current user"""
    try:
        query = {
            "properties.created_by": str(current_user.id)
        }
        
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user sites: {str(e)}"
        )

# ENHANCED SEARCH AND FILTER ENDPOINTS
@app.get("/api/search/advanced")
async def advanced_search(
    q: Optional[str] = None,  # General search query
    category: Optional[CategoryType] = None,
    district: Optional[str] = None,
    source: Optional[str] = None,
    has_website: Optional[bool] = None,
    has_phone: Optional[bool] = None,
    has_opening_hours: Optional[bool] = None,
    created_after: Optional[str] = None,  # ISO date string
    created_before: Optional[str] = None,  # ISO date string
    sort_by: Optional[str] = "name",  # name, created_at, updated_at
    sort_order: Optional[str] = "asc",  # asc, desc
    limit: int = 100,
    skip: int = 0
):
    """Advanced search with multiple filters and sorting"""
    try:
        # Build query
        query = {"is_active": True}
        
        # Text search
        if q:
            query["$text"] = {"$search": q}
        
        # Category filter
        if category:
            query["category"] = category
            
        # Source filter
        if source:
            query["source"] = source
            
        # District filter (geospatial)
        if district:
            district_doc = await District.find_one({"properties.STADTTNAME": district})
            if district_doc:
                query["location"] = {
                    "$geoWithin": {
                        "$geometry": district_doc.geometry
                    }
                }
        
        # Field existence filters
        if has_website is not None:
            if has_website:
                query["website"] = {"$ne": None, "$ne": ""}
            else:
                query["$or"] = [{"website": None}, {"website": ""}]
                
        if has_phone is not None:
            if has_phone:
                query["phone"] = {"$ne": None, "$ne": ""}
            else:
                query["$or"] = [{"phone": None}, {"phone": ""}]
                
        if has_opening_hours is not None:
            if has_opening_hours:
                query["opening_hours"] = {"$ne": None, "$ne": ""}
            else:
                query["$or"] = [{"opening_hours": None}, {"opening_hours": ""}]
        
        # Date range filters
        if created_after or created_before:
            date_query = {}
            if created_after:
                date_query["$gte"] = datetime.fromisoformat(created_after.replace('Z', '+00:00'))
            if created_before:
                date_query["$lte"] = datetime.fromisoformat(created_before.replace('Z', '+00:00'))
            query["created_at"] = date_query
        
        # Build sort criteria
        sort_direction = 1 if sort_order == "asc" else -1
        sort_criteria = [(sort_by, sort_direction)]
        
        # Execute query with sorting
        sites = await CulturalSite.find(query).sort(sort_criteria).skip(skip).limit(limit).to_list()
        
        # Get total count for pagination
        total_count = await CulturalSite.count(query)
        
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
            "sorting": {
                "sort_by": sort_by,
                "sort_order": sort_order
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Advanced search failed: {str(e)}"
        )

@app.get("/api/search/nearby")
async def search_nearby_sites(
    lat: float,
    lng: float,
    radius: int = 1000,  # meters
    category: Optional[CategoryType] = None,
    limit: int = 50
):
    """Search for cultural sites within a radius of coordinates"""
    try:
        # Validate coordinates
        if not (-90 <= lat <= 90):
            raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
        if not (-180 <= lng <= 180):
            raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")
        
        # Build geospatial query
        geo_query = {
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat]  # [longitude, latitude]
                    },
                    "$maxDistance": radius
                }
            },
            "is_active": True
        }
        
        if category:
            geo_query["category"] = category
        
        # Execute query
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Nearby search failed: {str(e)}"
        )

@app.get("/api/search/autocomplete")
async def autocomplete_search(
    q: str,
    limit: int = 10
):
    """Autocomplete search for site names"""
    try:
        if len(q) < 2:
            return {"suggestions": []}
        
        # Search for sites that start with the query
        regex_query = {
            "name": {"$regex": f"^{q}", "$options": "i"},
            "is_active": True
        }
        
        sites = await CulturalSite.find(regex_query).limit(limit).to_list()
        
        suggestions = [
            {
                "id": str(site.id),
                "name": site.name,
                "category": site.category,
                "address": site.address
            }
            for site in sites
        ]
        
        return {
            "suggestions": suggestions,
            "query": q,
            "total": len(suggestions)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Autocomplete search failed: {str(e)}"
        )

@app.get("/api/search/filters/values")
async def get_filter_values():
    """Get available values for filters (for UI dropdowns)"""
    try:
        # Get unique sources
        sources = await CulturalSite.distinct("source", {"is_active": True})
        
        # Get districts with sites
        districts_with_sites = await CulturalSite.aggregate([
            {"$match": {"is_active": True}},
            {"$group": {"_id": "$properties.district", "count": {"$sum": 1}}},
            {"$match": {"_id": {"$ne": None}}},
            {"$sort": {"_id": 1}}
        ]).to_list()
        
        # Get date ranges
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get filter values: {str(e)}"
        )

@app.get("/api/search/popular")
async def get_popular_sites(
    category: Optional[CategoryType] = None,
    limit: int = 10
):
    """Get popular sites based on view count and favorites"""
    try:
        query = {"is_active": True}
        if category:
            query["category"] = category
        
        # Sort by view_count and favorite_count (descending)
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get popular sites: {str(e)}"
        )

# Pydantic models for favorites
class FavoriteResponse(BaseModel):
    site_id: str
    site_name: str
    site_category: CategoryType
    site_address: Optional[str]
    favorited_at: datetime
    is_favorite: bool = True

class UserFavoritesResponse(BaseModel):
    user_id: str
    favorites: List[FavoriteResponse]
    total_favorites: int

# USER FAVORITES API ENDPOINTS
@app.post("/api/favorites/{site_id}")
async def add_to_favorites(
    site_id: str,
    current_user: User = Depends(get_current_user)
):
    """Add a cultural site to user's favorites"""
    try:
        # Check if site exists
        site = await CulturalSite.get(site_id)
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cultural site not found"
            )
        
        if not site.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot favorite inactive site"
            )
        
        # Check if already favorited
        if site_id in current_user.favorite_sites:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Site already in favorites"
            )
        
        # Add to user's favorites
        current_user.favorite_sites.append(site_id)
        current_user.updated_at = datetime.utcnow()
        await current_user.save()
        
        # Update site's favorite count
        site.favorite_count += 1
        await site.save()
        
        # Log user activity
        activity = UserActivity(
            user_id=str(current_user.id),
            site_id=site_id,
            activity_type=ActivityType.FAVORITE,
            metadata={
                "site_name": site.name,
                "site_category": site.category
            }
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add to favorites: {str(e)}"
        )
    
@app.delete("/api/favorites/{site_id}")
async def remove_from_favorites(
    site_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a cultural site from user's favorites"""
    try:
        # Check if site exists
        site = await CulturalSite.get(site_id)
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cultural site not found"
            )
        
        # Check if in favorites
        if site_id not in current_user.favorite_sites:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Site not in favorites"
            )
        
        # Remove from user's favorites
        current_user.favorite_sites.remove(site_id)
        current_user.updated_at = datetime.utcnow()
        await current_user.save()
        
        # Update site's favorite count
        if site.favorite_count > 0:
            site.favorite_count -= 1
            await site.save()
        
        # Log user activity
        activity = UserActivity(
            user_id=str(current_user.id),
            site_id=site_id,
            activity_type=ActivityType.UNFAVORITE,
            metadata={
                "site_name": site.name,
                "site_category": site.category
            }
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove from favorites: {str(e)}"
        )

@app.get("/api/favorites", response_model=UserFavoritesResponse)
async def get_user_favorites(
    current_user: User = Depends(get_current_user),
    include_inactive: bool = False
):
    """Get user's favorite cultural sites"""
    try:
        if not current_user.favorite_sites:
            return UserFavoritesResponse(
                user_id=str(current_user.id),
                favorites=[],
                total_favorites=0
            )
        
        # Build query for favorite sites with proper ObjectId handling
        valid_object_ids = []
        for site_id in current_user.favorite_sites:
            try:
                if ObjectId.is_valid(site_id):
                    valid_object_ids.append(ObjectId(site_id))
            except Exception:
                continue  # Skip invalid IDs
        
        if not valid_object_ids:
            return UserFavoritesResponse(
                user_id=str(current_user.id),
                favorites=[],
                total_favorites=0
            )
        
        query = {"_id": {"$in": valid_object_ids}}
        
        if not include_inactive:
            query["is_active"] = True
        
        # Get favorite sites
        favorite_sites = await CulturalSite.find(query).to_list()
        
        # Get activity timestamps for when sites were favorited
        activities = await UserActivity.find({
            "user_id": str(current_user.id),
            "activity_type": ActivityType.FAVORITE,
            "site_id": {"$in": current_user.favorite_sites}
        }).sort([("timestamp", -1)]).to_list()
        
        # Create activity lookup
        activity_lookup = {activity.site_id: activity.timestamp for activity in activities}
        
        # Build response
        favorites = []
        for site in favorite_sites:
            favorite = FavoriteResponse(
                site_id=str(site.id),
                site_name=site.name,
                site_category=site.category,
                site_address=site.address,
                favorited_at=activity_lookup.get(str(site.id), site.created_at)
            )
            favorites.append(favorite)
        
        # Sort by favorited date (most recent first)
        favorites.sort(key=lambda x: x.favorited_at, reverse=True)
        
        return UserFavoritesResponse(
            user_id=str(current_user.id),
            favorites=favorites,
            total_favorites=len(favorites)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get favorites: {str(e)}"
        )

@app.get("/api/favorites/check/{site_id}")
async def check_favorite_status(
    site_id: str,
    current_user: User = Depends(get_current_user)
):
    """Check if a site is in user's favorites"""
    try:
        is_favorite = site_id in current_user.favorite_sites
        
        return {
            "site_id": site_id,
            "is_favorite": is_favorite,
            "user_id": str(current_user.id)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check favorite status: {str(e)}"
        )

@app.post("/api/favorites/bulk")
async def bulk_favorite_operations(
    operations: List[dict],  # [{"action": "add/remove", "site_id": "..."}]
    current_user: User = Depends(get_current_user)
):
    """Bulk add/remove favorites"""
    try:
        results = []
        
        for operation in operations:
            action = operation.get("action")
            site_id = operation.get("site_id")
            
            if not action or not site_id:
                results.append({
                    "site_id": site_id,
                    "action": action,
                    "success": False,
                    "error": "Missing action or site_id"
                })
                continue
            
            try:
                if action == "add":
                    if site_id not in current_user.favorite_sites:
                        # Verify site exists and is active
                        site = await CulturalSite.get(site_id)
                        if site and site.is_active:
                            current_user.favorite_sites.append(site_id)
                            site.favorite_count += 1
                            await site.save()
                            
                            # Log activity
                            activity = UserActivity(
                                user_id=str(current_user.id),
                                site_id=site_id,
                                activity_type=ActivityType.FAVORITE
                            )
                            await activity.save()
                            
                            results.append({
                                "site_id": site_id,
                                "action": action,
                                "success": True
                            })
                        else:
                            results.append({
                                "site_id": site_id,
                                "action": action,
                                "success": False,
                                "error": "Site not found or inactive"
                            })
                    else:
                        results.append({
                            "site_id": site_id,
                            "action": action,
                            "success": False,
                            "error": "Already in favorites"
                        })
                        
                elif action == "remove":
                    if site_id in current_user.favorite_sites:
                        current_user.favorite_sites.remove(site_id)
                        
                        # Update site count
                        site = await CulturalSite.get(site_id)
                        if site and site.favorite_count > 0:
                            site.favorite_count -= 1
                            await site.save()
                        
                        # Log activity
                        activity = UserActivity(
                            user_id=str(current_user.id),
                            site_id=site_id,
                            activity_type=ActivityType.UNFAVORITE
                        )
                        await activity.save()
                        
                        results.append({
                            "site_id": site_id,
                            "action": action,
                            "success": True
                        })
                    else:
                        results.append({
                            "site_id": site_id,
                            "action": action,
                            "success": False,
                            "error": "Not in favorites"
                        })
                        
            except Exception as e:
                results.append({
                    "site_id": site_id,
                    "action": action,
                    "success": False,
                    "error": str(e)
                })
        
        # Save user changes
        current_user.updated_at = datetime.utcnow()
        await current_user.save()
        
        successful_operations = sum(1 for r in results if r["success"])
        
        return {
            "message": f"Bulk operation completed: {successful_operations}/{len(operations)} successful",
            "results": results,
            "total_favorites": len(current_user.favorite_sites)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk operation failed: {str(e)}"
        )

# Pydantic models for geospatial responses
class ProximitySite(BaseModel):
    site: dict  # The cultural site data
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
    sites: List[str]  # site IDs

# ENHANCED GEOSPATIAL API ENDPOINTS
@app.get("/api/geospatial/proximity", response_model=ProximitySearchResponse)
async def proximity_search(
    lat: float,
    lng: float,
    radius: int = 1000,  # meters
    category: Optional[CategoryType] = None,
    max_results: int = 50,
    include_inactive: bool = False,
    sort_by: str = "distance"  # distance, name, popularity
):
    """Enhanced proximity search with distance calculations and travel times"""
    try:
        # Validate coordinates
        if not (-90 <= lat <= 90):
            raise HTTPException(status_code=400, detail="Invalid latitude")
        if not (-180 <= lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid longitude")
        if radius <= 0 or radius > 50000:  # Max 50km
            raise HTTPException(status_code=400, detail="Radius must be between 1 and 50000 meters")
        
        # Build geospatial aggregation pipeline
        pipeline = [
            {
                "$geoNear": {
                    "near": {
                        "type": "Point",
                        "coordinates": [lng, lat]
                    },
                    "distanceField": "distance",
                    "maxDistance": radius,
                    "spherical": True,
                    "query": {
                        "is_active": True if not include_inactive else {"$in": [True, False]}
                    }
                }
            }
        ]
        
        # Add category filter if specified
        if category:
            pipeline.append({
                "$match": {"category": category}
            })
        
        # Add sorting
        if sort_by == "popularity":
            pipeline.append({
                "$sort": {"favorite_count": -1, "view_count": -1, "distance": 1}
            })
        elif sort_by == "name":
            pipeline.append({
                "$sort": {"name": 1}
            })
        else:  # distance (default)
            pipeline.append({
                "$sort": {"distance": 1}
            })
        
        # Limit results
        pipeline.append({"$limit": max_results})
        
        # Execute aggregation
        results = await CulturalSite.aggregate(pipeline).to_list()
        
        # Calculate additional metrics for each site
        proximity_sites = []
        for result in results:
            distance_meters = result["distance"]
            distance_km = distance_meters / 1000
            
            # Estimate travel times (rough calculations)
            walking_speed_kmh = 5  # Average walking speed
            driving_speed_kmh = 30  # Average city driving speed
            
            walking_time_minutes = int((distance_km / walking_speed_kmh) * 60)
            driving_time_minutes = max(1, int((distance_km / driving_speed_kmh) * 60))
            
            # Remove MongoDB-specific fields and prepare site data
            site_data = {k: v for k, v in result.items() if k not in ["distance"]}
            if "_id" in site_data:
                site_data["id"] = str(site_data.pop("_id"))
            
            proximity_site = ProximitySite(
                site=site_data,
                distance_meters=round(distance_meters, 2),
                distance_km=round(distance_km, 3),
                walking_time_minutes=walking_time_minutes,
                driving_time_minutes=driving_time_minutes
            )
            proximity_sites.append(proximity_site)
        
        # Calculate statistics
        if proximity_sites:
            distances = [site.distance_meters for site in proximity_sites]
            categories_found = list(set(site.site.get("category") for site in proximity_sites))
            
            statistics = {
                "avg_distance_meters": round(sum(distances) / len(distances), 2),
                "min_distance_meters": min(distances),
                "max_distance_meters": max(distances),
                "categories_found": categories_found,
                "category_counts": {cat: sum(1 for site in proximity_sites if site.site.get("category") == cat) for cat in categories_found}
            }
        else:
            statistics = {
                "avg_distance_meters": 0,
                "min_distance_meters": 0,
                "max_distance_meters": 0,
                "categories_found": [],
                "category_counts": {}
            }
        
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Proximity search failed: {str(e)}"
        )

@app.get("/api/geospatial/clusters")
async def get_site_clusters(
    ne_lat: float,  # Northeast corner latitude
    ne_lng: float,  # Northeast corner longitude
    sw_lat: float,  # Southwest corner latitude
    sw_lng: float,  # Southwest corner longitude
    zoom_level: int = 10,
    category: Optional[CategoryType] = None
):
    """Get clustered sites within a bounding box for map visualization"""
    try:
        # Validate bounding box
        if not (-90 <= sw_lat <= ne_lat <= 90):
            raise HTTPException(status_code=400, detail="Invalid latitude bounds")
        if not (-180 <= sw_lng <= ne_lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid longitude bounds")
        
        # Calculate cluster size based on zoom level
        cluster_size_degrees = 0.1 / (2 ** (zoom_level - 10))
        
        # Build aggregation pipeline for clustering
        match_stage = {
            "location": {
                "$geoWithin": {
                    "$box": [[sw_lng, sw_lat], [ne_lng, ne_lat]]
                }
            },
            "is_active": True
        }
        
        if category:
            match_stage["category"] = category
        
        pipeline = [
            {"$match": match_stage},
            {
                "$addFields": {
                    "lng": {"$arrayElemAt": ["$location.coordinates", 0]},
                    "lat": {"$arrayElemAt": ["$location.coordinates", 1]}
                }
            },
            {
                "$addFields": {
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
                }
            },
            {
                "$group": {
                    "_id": {
                        "cluster_lng": "$cluster_lng",
                        "cluster_lat": "$cluster_lat"
                    },
                    "sites": {"$push": {"id": "$_id", "name": "$name", "category": "$category"}},
                    "categories": {"$addToSet": "$category"},
                    "count": {"$sum": 1},
                    "avg_lng": {"$avg": "$lng"},
                    "avg_lat": {"$avg": "$lat"}
                }
            },
            {"$sort": {"count": -1}}
        ]
        
        clusters_data = await CulturalSite.aggregate(pipeline).to_list()
        
        clusters = []
        for cluster_data in clusters_data:
            cluster = GeospatialCluster(
                center_lat=cluster_data["avg_lat"],
                center_lng=cluster_data["avg_lng"],
                sites_count=cluster_data["count"],
                categories=cluster_data["categories"],
                sites=[str(site["id"]) for site in cluster_data["sites"]]
            )
            clusters.append(cluster)
        
        return {
            "clusters": clusters,
            "total_clusters": len(clusters),
            "bounding_box": {
                "ne_lat": ne_lat, "ne_lng": ne_lng,
                "sw_lat": sw_lat, "sw_lng": sw_lng
            },
            "zoom_level": zoom_level,
            "cluster_size_degrees": cluster_size_degrees
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clustering failed: {str(e)}"
        )

@app.get("/api/geospatial/route")
async def calculate_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    waypoints: Optional[List[str]] = None  # List of site IDs to visit
):
    """Calculate route between points with optional waypoints (basic version)"""
    try:
        # Validate coordinates
        if not (-90 <= start_lat <= 90 and -90 <= end_lat <= 90):
            raise HTTPException(status_code=400, detail="Invalid latitude")
        if not (-180 <= start_lng <= 180 and -180 <= end_lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid longitude")
        
        # Calculate direct distance
        def haversine_distance(lat1, lng1, lat2, lng2):
            R = 6371  # Earth's radius in kilometers
            dlat = math.radians(lat2 - lat1)
            dlng = math.radians(lng2 - lng1)
            a = (math.sin(dlat/2) ** 2 + 
                 math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
                 math.sin(dlng/2) ** 2)
            c = 2 * math.asin(math.sqrt(a))
            return R * c
        
        direct_distance = haversine_distance(start_lat, start_lng, end_lat, end_lng)
        
        route_points = [
            {"lat": start_lat, "lng": start_lng, "type": "start"}
        ]
        
        total_distance = 0
        current_lat, current_lng = start_lat, start_lng
        
        # Add waypoints if specified
       # Add waypoints if specified
        if waypoints:
            # Filter valid ObjectIds
            valid_waypoint_ids = []
            for wp in waypoints:
                try:
                    if ObjectId.is_valid(wp):
                        valid_waypoint_ids.append(ObjectId(wp))
                except Exception:
                    continue  # Skip invalid IDs
            
            if valid_waypoint_ids:
                waypoint_sites = await CulturalSite.find({
                    "_id": {"$in": valid_waypoint_ids},
                    "is_active": True
                }).to_list()
            
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
        
        # Add final segment to destination
        final_distance = haversine_distance(current_lat, current_lng, end_lat, end_lng)
        total_distance += final_distance
        
        route_points.append({
            "lat": end_lat,
            "lng": end_lng,
            "type": "end",
            "distance_from_previous": final_distance
        })
        
        # Estimate travel times
        walking_time = int((total_distance / 5) * 60)  # 5 km/h walking speed
        cycling_time = int((total_distance / 15) * 60)  # 15 km/h cycling speed
        driving_time = int((total_distance / 30) * 60)  # 30 km/h city driving
        
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
            "note": "This is a simplified route calculation. For production, integrate with a routing service like OpenStreetMap or Google Directions API."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Route calculation failed: {str(e)}"
        )

@app.get("/api/geospatial/within-district/{district_name}")
async def get_sites_within_district(
    district_name: str,
    category: Optional[CategoryType] = None,
    sort_by: str = "name",
    limit: int = 100
):
    """Get all sites within a specific district"""
    try:
        # Find the district
        district = await District.find_one({"properties.STADTTNAME": district_name})
        if not district:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"District '{district_name}' not found"
            )
        
        # Build query for sites within district
        query = {
            "location": {
                "$geoWithin": {
                    "$geometry": district.geometry
                }
            },
            "is_active": True
        }
        
        if category:
            query["category"] = category
        
        # Execute query with sorting
        sort_criteria = []
        if sort_by == "name":
            sort_criteria = [("name", 1)]
        elif sort_by == "category":
            sort_criteria = [("category", 1), ("name", 1)]
        elif sort_by == "popularity":
            sort_criteria = [("favorite_count", -1), ("view_count", -1)]
        else:
            sort_criteria = [("created_at", -1)]
        
        sites = await CulturalSite.find(query).sort(sort_criteria).limit(limit).to_list()
        
        # Calculate district statistics
        total_sites = len(sites)
        category_breakdown = {}
        for site in sites:
            cat = site.category
            category_breakdown[cat] = category_breakdown.get(cat, 0) + 1
        
        return {
            "district": {
                "name": district_name,
                "id": str(district.id)
            },
            "sites": sites,
            "statistics": {
                "total_sites": total_sites,
                "category_breakdown": category_breakdown,
                "most_common_category": max(category_breakdown.items(), key=lambda x: x[1])[0] if category_breakdown else None
            },
            "filters": {
                "category": category,
                "sort_by": sort_by,
                "limit": limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"District search failed: {str(e)}"
        )

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