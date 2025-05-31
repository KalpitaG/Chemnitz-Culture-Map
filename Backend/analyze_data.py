import json
import csv
import os

def analyze_geojson(filename):
    """Analyze GeoJSON file structure"""
    print(f"\nAnalyzing {filename}")
    print("=" * 50)
    
    try:
        with open(f'data/{filename}', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Type: {data.get('type', 'Unknown')}")
        print(f"Features count: {len(data.get('features', []))}")
        
        if data.get('features'):
            first_feature = data['features'][0]
            print(f"Feature type: {first_feature.get('type', 'Unknown')}")
            print(f"Geometry type: {first_feature.get('geometry', {}).get('type', 'Unknown')}")
            print(f"Properties keys: {list(first_feature.get('properties', {}).keys())}")
            
            # First feature details
            print(f"\nSample feature properties:")
            for key, value in list(first_feature.get('properties', {}).items())[:5]:
                print(f"   {key}: {value}")
                
    except Exception as e:
        print(f"Error reading {filename}: {e}")

def analyze_csv(filename):
    """Analyze CSV file structure"""
    print(f"\nAnalyzing {filename}")
    print("=" * 50)
    
    try:
        with open(f'data/{filename}', 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader)
            rows = list(reader)
        
        print(f"Headers: {headers}")
        print(f"Rows count: {len(rows)}")
        
        if rows:
            print(f"\nSample row:")
            for i, header in enumerate(headers[:5]):
                print(f"   {header}: {rows[0][i] if i < len(rows[0]) else 'N/A'}")
                
    except Exception as e:
        print(f"Error reading {filename}: {e}")

def main():
    """Analyze all data files"""
    print("CHEMNITZ CULTURAL DATA ANALYSIS")
    print("=" * 60)
    
    # Analyze GeoJSON files
    geojson_files = ['Chemnitz.geojson', 'Sachsen.geojson', 'Stadtteile.geojson']
    for file in geojson_files:
        if os.path.exists(f'data/{file}'):
            analyze_geojson(file)
    
    # Analyze CSV files  
    csv_files = ['Parkplatze_Reisebus.csv', 'Parkplatze_Wohnmobil.csv']
    for file in csv_files:
        if os.path.exists(f'data/{file}'):
            analyze_csv(file)

if __name__ == "__main__":
    main()