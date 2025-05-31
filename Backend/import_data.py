import json
import csv
import asyncio
from typing import Dict, Any, Optional
from database import init_database, close_database
from models import CulturalSite, ParkingLot, District, CategoryType, ParkingType

class ChemnitzDataImporter:
    """Import Chemnitz cultural sites and parking data"""
    
    def __init__(self):
        self.imported_sites = 0
        self.imported_parking = 0
        self.imported_districts = 0
        self.skipped_sites = 0
    
    def map_to_category(self, properties: Dict[str, Any]) -> Optional[CategoryType]:
        """Map GeoJSON properties to our CategoryType enum"""
        
        # Theatre mapping
        if properties.get('amenity') == 'theatre':
            return CategoryType.THEATRE
        
        # Museum mapping  
        if properties.get('tourism') == 'museum':
            return CategoryType.MUSEUM
        if properties.get('tourism') == 'gallery':
            return CategoryType.MUSEUM
            
        # Restaurant mapping
        if properties.get('amenity') == 'restaurant':
            return CategoryType.RESTAURANT
            
        # Artwork mapping
        if properties.get('tourism') == 'artwork':
            return CategoryType.ARTWORK
        if properties.get('amenity') == 'clock':
            return CategoryType.ARTWORK
        if properties.get('historic'):
            return CategoryType.ARTWORK
            
        # Skip non-cultural sites
        return None
    
    def extract_coordinates(self, geometry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract coordinates from GeoJSON geometry"""
        try:
            if geometry.get('type') == 'Point':
                coords = geometry.get('coordinates', [])
                if len(coords) >= 2:
                    return {
                        "type": "Point",
                        "coordinates": [float(coords[0]), float(coords[1])]  # [lng, lat]
                    }
        except (ValueError, TypeError):
            pass
        return None
    
    def extract_coordinates_enhanced(self, geometry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract coordinates from various geometry types"""
        try:
            geom_type = geometry.get('type')
            coords = geometry.get('coordinates', [])
            
            if geom_type == 'Point' and len(coords) >= 2:
                return {
                    "type": "Point",
                    "coordinates": [float(coords[0]), float(coords[1])]
                }
            elif geom_type == 'LineString' and len(coords) > 0:
                # Use first point of LineString
                first_point = coords[0]
                if len(first_point) >= 2:
                    return {
                        "type": "Point", 
                        "coordinates": [float(first_point[0]), float(first_point[1])]
                    }
        except (ValueError, TypeError, IndexError):
            pass
        return None
    
    def convert_coordinates(self, x: float, y: float) -> tuple:
        """Convert projected coordinates to WGS84 longitude/latitude"""
        try:
            # These coordinates are in ETRS89 / UTM zone 33N (EPSG:25833)
            # Based on your data: X ~1437000, Y ~6592000
            
            # More accurate conversion for Saxony/Chemnitz UTM Zone 33N
            # UTM Zone 33N covers 12°E to 18°E
            
            # Convert UTM to lat/lng (simplified approximation)
            # UTM Zone 33N parameters
            central_meridian = 15.0  # Central meridian for Zone 33N
            false_easting = 500000.0
            false_northing = 0.0
            
            # Calculate approximate longitude
            lng = central_meridian + ((x - false_easting) / 111320.0)
            
            # Calculate approximate latitude (more complex due to UTM projection)
            # Simplified approximation for the Chemnitz area
            lat = (y - false_northing) / 111320.0
            
            # Apply correction for UTM zone 33N in Saxony region
            lat_corrected = lat - 59.0  # Approximate correction for this UTM zone
            
            # Fine-tune for Chemnitz area (50.8°N, 12.9°E)
            if 11.5 <= lng <= 14.5 and 50.0 <= lat_corrected <= 52.0:
                return lng, lat_corrected
            else:
                # Alternative calculation if first method fails
                # Use empirical adjustment for your coordinate range
                lng_alt = 12.9 + (x - 1437000) / 100000.0  # Empirical scaling
                lat_alt = 50.8 + (y - 6592000) / 110000.0  # Empirical scaling
                
                print(f"Converted coordinates: ({x}, {y}) -> ({lng_alt:.6f}, {lat_alt:.6f})")
                return lng_alt, lat_alt
                
        except Exception as e:
            print(f"Coordinate conversion error: {e}")
            return 12.9214, 50.8279  # Fallback to Chemnitz center

    async def import_cultural_sites(self):
        """Import cultural sites from Chemnitz.geojson"""
        print("\nImporting Cultural Sites from Chemnitz.geojson...")
        print("-" * 50)
        
        try:
            with open('data/Chemnitz.geojson', 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            features = data.get('features', [])
            print(f"Found {len(features)} features to process")
            
            for feature in features:
                try:
                    properties = feature.get('properties', {})
                    geometry = feature.get('geometry', {})
                    
                    # Map to category
                    category = self.map_to_category(properties)
                    if not category:
                        self.skipped_sites += 1
                        continue
                    
                    # Extract coordinates
                    location = self.extract_coordinates(geometry)
                    if not location:
                        self.skipped_sites += 1
                        continue
                    
                    # Extract site information
                    name = properties.get('name', 'Unnamed Site')
                    if not name or name == 'Unnamed Site':
                        # Try alternative name fields
                        name = properties.get('operator', 'Unnamed Site')
                    
                    # Create cultural site
                    site = CulturalSite(
                        name=name,
                        category=category,
                        description=self.build_description(properties),
                        address=self.extract_address(properties),
                        location=location,
                        website=properties.get('website'),
                        phone=properties.get('phone'),
                        opening_hours=properties.get('opening_hours'),
                        properties=properties,  # Store original data
                        source="chemnitz_geojson",
                        source_id=properties.get('@id')
                    )
                    
                    await site.save()
                    self.imported_sites += 1
                    
                    if self.imported_sites % 50 == 0:
                        print(f"Imported {self.imported_sites} sites...")
                        
                except Exception as e:
                    print(f"Error processing feature: {e}")
                    self.skipped_sites += 1
                    continue
            
            print(f"Cultural sites import completed!")
            print(f"   Imported: {self.imported_sites}")
            print(f"   Skipped: {self.skipped_sites}")
            
        except Exception as e:
            print(f"Error importing cultural sites: {e}")

    async def import_sachsen_sites(self):
        """Import cultural sites from Sachsen.geojson"""
        print("\nImporting Cultural Sites from Sachsen.geojson...")
        print("-" * 50)
    
        try:
            with open('data/Sachsen.geojson', 'r', encoding='utf-8') as f:
                data = json.load(f)
        
            features = data.get('features', [])
            print(f"Found {len(features)} features to process")
        
            sachsen_imported = 0
        
            for feature in features:
                try:
                    properties = feature.get('properties', {})
                    geometry = feature.get('geometry', {})
                
                    # Map to category
                    category = self.map_to_category(properties)
                    if not category:
                        self.skipped_sites += 1
                        continue
                
                    # Extract coordinates (handle LineString geometry too)
                    location = self.extract_coordinates_enhanced(geometry)
                    if not location:
                        self.skipped_sites += 1
                        continue
                
                    # Extract site information
                    name = properties.get('name', 'Unnamed Site')
                    if not name or name == 'Unnamed Site':
                        name = properties.get('operator', 'Unnamed Site')
                    
                    if name == 'Unnamed Site':
                        self.skipped_sites += 1
                        continue
                
                    # Create cultural site
                    site = CulturalSite(
                        name=name,
                        category=category,
                        description=self.build_description(properties),
                        address=self.extract_address(properties),
                        location=location,
                        website=properties.get('website'),
                        phone=properties.get('phone'),
                        opening_hours=properties.get('opening_hours'),
                        properties=properties,
                        source="sachsen_geojson",
                        source_id=properties.get('@id')
                    )
                
                    await site.save()
                    sachsen_imported += 1
                    
                    if sachsen_imported % 100 == 0:
                        print(f"Imported {sachsen_imported} sites from Sachsen...")
                    
                except Exception as e:
                    self.skipped_sites += 1
                    continue
        
            print(f"Sachsen sites import completed!")
            print(f"   Imported: {sachsen_imported}")
            return sachsen_imported
        
        except Exception as e:
            print(f"Error importing Sachsen sites: {e}")
            return 0

    def build_description(self, properties: Dict[str, Any]) -> str:
        """Build description from available properties"""
        desc_parts = []
        
        if properties.get('tourism'):
            desc_parts.append(f"Type: {properties['tourism']}")
        if properties.get('amenity'):
            desc_parts.append(f"Amenity: {properties['amenity']}")
        if properties.get('museum'):
            desc_parts.append(f"Museum type: {properties['museum']}")
        if properties.get('operator'):
            desc_parts.append(f"Operated by: {properties['operator']}")
        if properties.get('historic'):
            desc_parts.append(f"Historic: {properties['historic']}")
            
        return " | ".join(desc_parts) if desc_parts else None
    
    def extract_address(self, properties: Dict[str, Any]) -> Optional[str]:
        """Extract address information from properties"""
        # OSM data might have addr:* fields or location description
        addr_parts = []
        
        if properties.get('addr:street'):
            addr_parts.append(properties['addr:street'])
        if properties.get('addr:housenumber'):
            addr_parts.append(properties['addr:housenumber'])
        if properties.get('addr:city'):
            addr_parts.append(properties['addr:city'])
        if properties.get('addr:postcode'):
            addr_parts.append(properties['addr:postcode'])
            
        if addr_parts:
            return " ".join(addr_parts)
        
        # Fallback to general location or name-based address
        return "Chemnitz, Germany"
    
    def parse_capacity(self, capacity_str: str) -> Optional[int]:
        """Parse capacity string to integer"""
        if not capacity_str:
            return None
        try:
            # Handle different formats
            capacity_str = str(capacity_str).strip()
            if capacity_str.isdigit():
                return int(capacity_str)
            # Extract numbers from string like "10 Plätze"
            import re
            numbers = re.findall(r'\d+', capacity_str)
            if numbers:
                return int(numbers[0])
        except:
            pass
        return None
    
    async def import_parking_lots(self):
        """Import parking lots from CSV files"""
        print("\nImporting Parking Lots from CSV files...")
        print("-" * 50)
        
        # Import bus parking (FIXED: with umlaut ä)
        await self.import_parking_csv('data/Parkplatze_Reisebus.csv', ParkingType.BUS)
        
        # Import caravan parking (FIXED: with umlaut ä)
        await self.import_parking_csv('data/Parkplatze_Wohnmobil.csv', ParkingType.CARAVAN)
        
        print(f"Parking lots import completed!")
        print(f"   Imported: {self.imported_parking} parking lots")
    
    async def import_parking_csv(self, filename: str, parking_type: ParkingType):
        """Import parking data from specific CSV file"""
        try:
            with open(filename, 'r', encoding='utf-8-sig') as f:  # utf-8-sig removes BOM
                reader = csv.DictReader(f)
                
                for row in reader:
                    try:
                        # Handle BOM character by trying multiple column names
                        x_val = None
                        y_val = None
                        
                        # Try to find X coordinate (handle BOM)
                        for key in row.keys():
                            if 'X' in key:  # Matches both 'X' and '\ufeffX'
                                x_val = row[key]
                            if key == 'Y':
                                y_val = row[key]
                        
                        if not x_val or not y_val:
                            print(f"Missing coordinates in row: {row}")
                            continue
                        
                        # Convert projected coordinates to WGS84
                        lng, lat = self.convert_coordinates(float(x_val), float(y_val))
                        
                        if lng == 0 or lat == 0:
                            print(f"Invalid coordinates: {x_val}, {y_val}")
                            continue
                        
                        # Create parking lot
                        parking = ParkingLot(
                            name=f"{parking_type.value.title()} Parking - {row.get('LAGE', 'Unknown')}",
                            location={
                                "type": "Point", 
                                "coordinates": [lng, lat]
                            },
                            parking_type=parking_type,
                            capacity=self.parse_capacity(row.get('KAPAZITAET')),
                            address=row.get('LAGE', 'Chemnitz, Germany'),
                            description=row.get('BEMERKUNG'),
                            properties=dict(row)
                        )
                        
                        await parking.save()
                        self.imported_parking += 1
                        
                    except Exception as e:
                        print(f"Error processing parking row: {e}")
                        continue
                        
        except Exception as e:
            print(f"Error importing {filename}: {e}")

    async def import_districts(self):
        """Import district boundaries from Stadtteile.geojson"""
        print("\nImporting District Boundaries...")
        print("-" * 50)
        
        try:
            with open('data/Stadtteile.geojson', 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            features = data.get('features', [])
            
            for feature in features:
                try:
                    properties = feature.get('properties', {})
                    geometry = feature.get('geometry', {})
                    
                    district = District(
                        name=properties.get('STADTTNAME', 'Unknown District'),
                        geometry=geometry,
                        properties=properties
                    )
                    
                    await district.save()
                    self.imported_districts += 1
                    
                except Exception as e:
                    print(f"Error processing district: {e}")
                    continue
            
            print(f"Districts import completed!")
            print(f"   Imported: {self.imported_districts} districts")
            
        except Exception as e:
            print(f"Error importing districts: {e}")
    
    async def print_summary(self):
        """Print import summary and database statistics"""
        print("\nIMPORT SUMMARY")
        print("=" * 50)
        print(f"Cultural Sites: {self.imported_sites}")
        print(f"Parking Lots: {self.imported_parking}")
        print(f"Districts: {self.imported_districts}")
        print(f"Skipped: {self.skipped_sites}")
        
        # Show category breakdown
        print(f"\nCultural Sites by Category:")
        for category in CategoryType:
            count = await CulturalSite.find({"category": category}).count()
            print(f"   {category.value}: {count}")

async def main():
    """Main import function"""
    print("COMPLETE CHEMNITZ + SACHSEN DATA IMPORT")
    print("=" * 60)
    
    # Initialize database
    await init_database()
    
    # Clear existing data (optional)
    print("\n🧹 Clearing existing cultural data...")
    await CulturalSite.delete_all()
    await ParkingLot.delete_all()
    await District.delete_all()
    
    # Create importer and run imports
    importer = ChemnitzDataImporter()
    
    # Import all data
    await importer.import_cultural_sites()  # Chemnitz sites
    sachsen_count = await importer.import_sachsen_sites()  # Sachsen sites
    await importer.import_parking_lots()  # Parking 
    await importer.import_districts()  # Districts
    
    # Enhanced summary
    print("\nCOMPLETE IMPORT SUMMARY")
    print("=" * 50)
    print(f"Chemnitz Cultural Sites: {importer.imported_sites}")
    print(f"Sachsen Cultural Sites: {sachsen_count}")
    print(f"Parking Lots: {importer.imported_parking}")
    print(f"Districts: {importer.imported_districts}")
    print(f"Skipped: {importer.skipped_sites}")
    print(f"TOTAL CULTURAL SITES: {importer.imported_sites + sachsen_count}")
    
    # Show category breakdown
    print(f"\nFinal Category Distribution:")
    for category in CategoryType:
        count = await CulturalSite.find({"category": category}).count()
        print(f"   {category.value}: {count}")
    
    # Close database
    await close_database()
    print("\nComplete data import finished successfully!")

if __name__ == "__main__":
    asyncio.run(main())