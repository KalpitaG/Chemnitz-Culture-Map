from beanie import Document, Indexed
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

# GeoJSON Point structure for MongoDB geospatial data
class GeoPoint(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]

# Category enumeration for validation
class CategoryType(str, Enum):
    THEATRE = "theatre"
    MUSEUM = "museum" 
    RESTAURANT = "restaurant"
    ARTWORK = "artwork"

# Category Model
class Category(Document):
    name: CategoryType
    display_name: str  # Human-readable name
    description: Optional[str] = None
    icon: Optional[str] = None  # Icon name for frontend
    color: Optional[str] = "#3498db"  # Hex color for map markers
    
    class Settings:
        name = "categories"
        indexes = ["name"]

# Main Cultural Site Model
class CulturalSite(Document):
    # Basic information
    name: str = Field(..., index=True)  # Indexed for fast text searches
    category: CategoryType
    description: Optional[str] = None
    address: Optional[str] = None
    
    # Geospatial data
    location: GeoPoint
    
    # Contact information
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    opening_hours: Optional[str] = None
    
    # Original data from GeoJSON/API
    properties: Optional[Dict[str, Any]] = {}
    
    # Metadata
    source: str = "local"  # "local", "overpass", "manual"
    source_id: Optional[str] = None  # Original ID from source
    
    # System fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True  # For soft delete
    
    # Statistics
    view_count: int = 0
    favorite_count: int = 0
    
    class Settings:
        name = "cultural_sites"
        indexes = [
            [("location", "2dsphere")],  # Geospatial index for location queries
            "category",  # Filter by category
            "is_active",  # Active sites only
            "source",    # Group by data source
            [("name", "text"), ("description", "text"), ("address", "text")]  # Text search
        ]

# User Model for Authentication
class User(Document):
    # Authentication
    #email: Indexed(EmailStr, unique=True)
    email: str = Field(..., unique=True, index=True)
    password_hash: str
    
    # Profile information
    first_name: str
    last_name: str
    
    # Optional user location for "10 Minute City" feature
    current_location: Optional[GeoPoint] = None
    
    # User preferences and data
    favorite_sites: List[str] = []  # References to CulturalSite documents
    preferred_categories: List[CategoryType] = []
    
    # Account management
    is_active: bool = True
    is_admin: bool = False
    is_verified: bool = False
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
    class Settings:
        name = "users"
        indexes = [
            "email",
            "is_active",
            "is_admin"
        ]

# Parking Lot Model (from CSV data)
class ParkingType(str, Enum):
    BUS = "bus"
    CARAVAN = "caravan" 
    CAR = "car"
    BICYCLE = "bicycle"

class ParkingLot(Document):
    name: str
    location: GeoPoint
    parking_type: ParkingType
    
    # Capacity information
    capacity: Optional[int] = None
    available_spots: Optional[int] = None
    
    # Additional information
    address: Optional[str] = None
    description: Optional[str] = None
    hourly_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    
    # Original CSV properties
    properties: Optional[Dict[str, Any]] = {}
    
    # System fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    
    class Settings:
        name = "parking_lots"
        indexes = [
            [("location", "2dsphere")],
            "parking_type",
            "is_active"
        ]

# User Activity Tracking (for Interactive Features)
class ActivityType(str, Enum):
    VIEW = "view"
    FAVORITE = "favorite"
    UNFAVORITE = "unfavorite"
    VISIT = "visit"
    REVIEW = "review"

class UserActivity(Document):
    user_id: str  # Reference to User
    site_id: str  # Reference to CulturalSite
    activity_type: ActivityType
    
    # Activity metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_location: Optional[GeoPoint] = None  # Where user was when activity occurred
    
    # Flexible data field for different activity types
    metadata: Optional[Dict[str, Any]] = {}
    
    class Settings:
        name = "user_activities"
        indexes = [
            "user_id",
            "site_id", 
            "activity_type",
            "timestamp"
        ]

# Review Model (Optional for Interactive Part)
class Review(Document):
    user_id: str
    site_id: str
    
    # Review content
    rating: int = Field(..., ge=1, le=5)  # 1-5 stars
    title: Optional[str] = None
    comment: Optional[str] = None
    
    # Review metadata
    visit_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Moderation
    is_active: bool = True
    is_featured: bool = False
    
    class Settings:
        name = "reviews"
        indexes = [
            "site_id",
            "user_id",
            "rating",
            "is_active"
        ]

# District/Region Model (from Stadtteile.geojson)
class District(Document):
    name: str
    
    # GeoJSON geometry (could be Polygon or MultiPolygon)
    geometry: Dict[str, Any]  # Full GeoJSON geometry
    
    # District properties
    properties: Optional[Dict[str, Any]] = {}
    
    # Statistics
    cultural_sites_count: int = 0
    
    class Settings:
        name = "districts"
        indexes = [
            [("geometry", "2dsphere")],
            "name"
        ]