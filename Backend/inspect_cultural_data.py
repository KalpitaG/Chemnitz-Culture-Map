import json
from collections import Counter

def inspect_chemnitz_data():
    """Inspect Chemnitz cultural data for category mapping"""
    print("CHEMNITZ CULTURAL SITES CATEGORY ANALYSIS")
    print("=" * 60)
    
    with open('data/Chemnitz.geojson', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Analyze properties for category mapping
    tourism_values = []
    landuse_values = []
    museum_values = []
    amenity_values = []
    historic_values = []
    
    sample_sites = []
    
    for feature in data['features']:
        props = feature.get('properties', {})
        
        # Collect values for mapping
        if 'tourism' in props:
            tourism_values.append(props['tourism'])
        if 'landuse' in props:
            landuse_values.append(props['landuse'])
        if 'museum' in props:
            museum_values.append(props['museum'])
        if 'amenity' in props:
            amenity_values.append(props['amenity'])
        if 'historic' in props:
            historic_values.append(props['historic'])
            
        # Collect sample sites
        if len(sample_sites) < 10:
            sample_sites.append({
                'name': props.get('name', 'Unnamed'),
                'tourism': props.get('tourism'),
                'landuse': props.get('landuse'), 
                'museum': props.get('museum'),
                'amenity': props.get('amenity'),
                'historic': props.get('historic')
            })
    
    # Show category distributions
    print(f"\nTOURISM values ({len(tourism_values)} sites):")
    for value, count in Counter(tourism_values).most_common():
        print(f"   {value}: {count}")
    
    print(f"\nLANDUSE values ({len(landuse_values)} sites):")
    for value, count in Counter(landuse_values).most_common():
        print(f"   {value}: {count}")
        
    print(f"\nMUSEUM values ({len(museum_values)} sites):")
    for value, count in Counter(museum_values).most_common():
        print(f"   {value}: {count}")
        
    print(f"\nAMENITY values ({len(amenity_values)} sites):")
    for value, count in Counter(amenity_values).most_common():
        print(f"   {value}: {count}")
        
    print(f"\nHISTORIC values ({len(historic_values)} sites):")
    for value, count in Counter(historic_values).most_common():
        print(f"   {value}: {count}")
    
    print(f"\nSAMPLE SITES:")
    print("-" * 50)
    for site in sample_sites:
        print(f" {site['name']}")
        for key, value in site.items():
            if key != 'name' and value:
                print(f"   {key}: {value}")
        print()

if __name__ == "__main__":
    inspect_chemnitz_data()