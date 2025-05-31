import csv
import os

def debug_parking_files():
    """Debug what's happening with parking CSV files"""
    
    csv_files = ['data/Parkplatze_Reisebus.csv', 'data/Parkplatze_Wohnmobil.csv']
    
    for filename in csv_files:
        print(f"\nDebugging {filename}")
        print("-" * 50)
        
        # Check if file exists
        if not os.path.exists(filename):
            print(f"File does not exist: {filename}")
            continue
        else:
            print(f"File exists: {filename}")
        
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                
                print(f"Headers: {reader.fieldnames}")
                print(f"Total rows: {len(rows)}")
                
                if rows:
                    print(f"\nFirst row sample:")
                    first_row = rows[0]
                    for key, value in first_row.items():
                        print(f"   {key}: '{value}'")
                    
                    # Check coordinates
                    x_val = first_row.get('X', 'MISSING')
                    y_val = first_row.get('Y', 'MISSING')
                    print(f"\nCoordinate check:")
                    print(f"   X (longitude): '{x_val}' (type: {type(x_val)})")
                    print(f"   Y (latitude): '{y_val}' (type: {type(y_val)})")
                    
                    # Try to convert to float
                    try:
                        lng = float(x_val) if x_val != 'MISSING' else 0
                        lat = float(y_val) if y_val != 'MISSING' else 0
                        print(f"   Converted: lng={lng}, lat={lat}")
                        
                        if lng == 0 or lat == 0:
                            print("   Coordinates are zero - this would be skipped!")
                        else:
                            print("   Coordinates look valid")
                            
                    except ValueError as e:
                        print(f"   Cannot convert to float: {e}")
                
        except Exception as e:
            print(f"Error reading {filename}: {e}")

if __name__ == "__main__":
    debug_parking_files()