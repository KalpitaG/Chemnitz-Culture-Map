import os
import motor.motor_asyncio
from beanie import init_beanie
from typing import Optional
import asyncio

# Import all models
from models import (
    CulturalSite, 
    User, 
    Category, 
    ParkingLot,
    UserActivity,
    Review,
    District,
    CategoryType
)

class DatabaseManager:
    """MongoDB connection and management class"""
    
    def __init__(self):
        self.client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
        self.database = None
        
    async def connect_to_database(self, database_url: str = None, database_name: str = "chemnitz_culture_db"):
        """Initialize MongoDB connection and Beanie ODM"""
        
        if not database_url:
            database_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        
        try:
            # Create Motor client
            self.client = motor.motor_asyncio.AsyncIOMotorClient(database_url)
            self.database = self.client[database_name]
            
            # Test connection
            await self.client.admin.command('ping')
            print(f"Connected to MongoDB at {database_url}")
            
            # Initialize Beanie with all document models
            await init_beanie(
                database=self.database,
                document_models=[
                    CulturalSite,
                    User,
                    Category, 
                    ParkingLot,
                    UserActivity,
                    Review,
                    District
                ]
            )
            
            print("Beanie ODM initialized with all models")
            print("Database indexes created automatically")
            
            # Create default data
            await self.create_default_categories()
            
        except Exception as e:
            print(f"Failed to connect to MongoDB: {e}")
            raise
    
    async def close_database_connection(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            print("MongoDB connection closed")
    
    async def create_default_categories(self):
        """Create the 4 required categories if they don't exist"""
        
        default_categories = [
            {
                "name": CategoryType.THEATRE,
                "display_name": "Theatres & Performance",
                "description": "Theatres, opera houses, and performance venues",
                "icon": "theater_comedy",
                "color": "#e74c3c"  # Red
            },
            {
                "name": CategoryType.MUSEUM,
                "display_name": "Museums & Exhibitions", 
                "description": "Museums, galleries, and exhibition spaces",
                "icon": "museum",
                "color": "#3498db"  # Blue
            },
            {
                "name": CategoryType.RESTAURANT,
                "display_name": "Restaurants & Dining",
                "description": "Restaurants, cafes, and dining establishments",
                "icon": "restaurant",
                "color": "#f39c12"  # Orange
            },
            {
                "name": CategoryType.ARTWORK,
                "display_name": "Art & Monuments",
                "description": "Public art, monuments, and sculptures",
                "icon": "palette",
                "color": "#9b59b6"  # Purple
            }
        ]
        
        for category_data in default_categories:
            # Check if category already exists
            existing = await Category.find_one(Category.name == category_data["name"])
            
            if not existing:
                category = Category(**category_data)
                await category.save()
                print(f"Created category: {category_data['display_name']}")
            else:
                print(f"Category already exists: {category_data['display_name']}")
    
    async def get_database_stats(self):
        """Get database statistics for monitoring"""
        try:
            stats = {}
            
            # Count documents in each collection
            stats["cultural_sites"] = await CulturalSite.count()
            stats["users"] = await User.count()
            stats["categories"] = await Category.count()
            stats["parking_lots"] = await ParkingLot.count()
            stats["reviews"] = await Review.count()
            stats["activities"] = await UserActivity.count()
            
            # Database info
            db_stats = await self.database.command("dbStats")
            stats["database_size_mb"] = round(db_stats["dataSize"] / (1024 * 1024), 2)
            stats["total_collections"] = db_stats["collections"]
            
            return stats
            
        except Exception as e:
            print(f"Error getting database stats: {e}")
            return {}

# Global database manager instance
db_manager = DatabaseManager()

# Convenience functions for FastAPI
async def init_database():
    """Initialize database connection (call this on startup)"""
    await db_manager.connect_to_database()

async def close_database():
    """Close database connection (call this on shutdown)"""
    await db_manager.close_database_connection()

async def test_database_connection():
    """Test database connection and basic operations"""
    try:
        await init_database()
        
        test_site = CulturalSite(
            name="Test Opera House",
            category=CategoryType.THEATRE,
            description="A test opera house",
            location={
                "type": "Point",
                "coordinates": [12.9214, 50.8279]  # Chemnitz coordinates [lng, lat]
            },
            address="Test Address 1, Chemnitz"
        )
        
        await test_site.save()
        print(f"Test site created with ID: {test_site.id}")
        
        # Test geospatial query
        nearby_sites = await CulturalSite.find({
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [12.9214, 50.8279]
                    },
                    "$maxDistance": 1000  # 1km radius
                }
            }
        }).to_list()
        
        print(f"Found {len(nearby_sites)} sites within 1km")
        
        # Clean up test data
        await test_site.delete()
        print("Test site deleted")
        
        # Show database stats
        stats = await db_manager.get_database_stats()
        print(f"Database stats: {stats}")
        
        await close_database()
        print("Database test completed successfully!")
        
    except Exception as e:
        print(f"Database test failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(test_database_connection())