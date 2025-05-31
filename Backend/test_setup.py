"""
Test script to verify MongoDB and FastAPI setup is working correctly
Run this after setting up MongoDB and installing dependencies
"""

import asyncio
import sys
from database import test_database_connection

async def main():
    """Run all setup tests"""
    print("Testing Chemnitz Cultural Sites Backend Setup")
    print("=" * 50)
    
    try:
        # Test 1: Database Connection
        print("\nTesting MongoDB Connection...")
        await test_database_connection()
        
        print("\nAll tests passed!")
        print("\nYour backend setup is working correctly!")
        print("\nNext steps:")
        print("1. Run 'python main.py' to start the API server")
        print("2. Visit http://localhost:8000/docs to see API documentation")
        print("3. Test endpoints with your React frontend")
        
    except Exception as e:
        print(f"\nSetup test failed: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure MongoDB is running (check MongoDB Compass connection)")
        print("2. Verify all dependencies are installed: pip install -r requirements.txt")
        print("3. Check your .env file configuration")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())