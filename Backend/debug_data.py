# debug_data.py - Run this in your Backend directory
import asyncio
from database import init_database, close_database
from models import CulturalSite, ParkingLot, CategoryType, ParkingType

async def debug_database():
    print("🔍 DEBUGGING DATABASE CONTENT...")
    print("=" * 50)
    
    await init_database()
    
    # Check total counts
    total_sites = await CulturalSite.find().count()
    total_parking = await ParkingLot.find().count()
    
    print(f"📊 TOTAL COUNTS:")
    print(f"   Cultural Sites: {total_sites}")
    print(f"   Parking Lots: {total_parking}")
    print()
    
    # Check by source
    chemnitz_count = await CulturalSite.find({"source": "chemnitz_geojson"}).count()
    sachsen_count = await CulturalSite.find({"source": "sachsen_geojson"}).count()
    
    print(f"📍 BY SOURCE:")
    print(f"   Chemnitz sites: {chemnitz_count}")
    print(f"   Sachsen sites: {sachsen_count}")
    print()
    
    # Check by category
    print(f"🎭 BY CATEGORY:")
    for category in CategoryType:
        count = await CulturalSite.find({"category": category}).count()
        print(f"   {category.value}: {count}")
    print()
    
    # Check by parking type
    print(f"🚗 BY PARKING TYPE:")
    for parking_type in ParkingType:
        count = await ParkingLot.find({"parking_type": parking_type}).count()
        print(f"   {parking_type.value}: {count}")
    print()
    
    # Sample data
    print(f"📋 SAMPLE CULTURAL SITES:")
    sample_sites = await CulturalSite.find().limit(3).to_list()
    for site in sample_sites:
        print(f"   {site.name} ({site.category}) - Source: {site.source}")
    
    await close_database()
    print("\n✅ Database check complete!")

if __name__ == "__main__":
    asyncio.run(debug_database())