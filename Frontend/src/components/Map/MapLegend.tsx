// components/Map/MapLegend.tsx
import React from 'react';
import { CulturalSite, ParkingLot, District, CategoryType, ParkingType } from '../../types';

interface MapLegendProps {
  culturalSites: CulturalSite[];
  parkingLots: ParkingLot[];
  districts: District[];
  // NEW: Add these props for nearby parking
  showNearbyParking?: boolean;
  isNearbyParking?: boolean;
}

const MapLegend: React.FC<MapLegendProps> = ({ 
  culturalSites, 
  parkingLots, 
  districts,
  // NEW: Add these props
  showNearbyParking,
  isNearbyParking
}) => {
  // Category colors and emojis
  const getCategoryColor = (category: CategoryType): string => {
    switch (category) {
      case CategoryType.THEATRE: return '#dc2626';
      case CategoryType.MUSEUM: return '#2563eb';
      case CategoryType.RESTAURANT: return '#ea580c';
      case CategoryType.ARTWORK: return '#9333ea';
      default: return '#6b7280';
    }
  };

  const categoryEmojis: Record<CategoryType, string> = {
    [CategoryType.THEATRE]: '🎭',
    [CategoryType.MUSEUM]: '🏛️',
    [CategoryType.RESTAURANT]: '🍽️',
    [CategoryType.ARTWORK]: '🎨'
  };

  const getParkingColor = (type: ParkingType): string => {
    switch (type) {
      case ParkingType.BUS: return '#059669';
      case ParkingType.CARAVAN: return '#374151';
      default: return '#6b7280';
    }
  };

  const parkingEmojis: Record<ParkingType, string> = {
    [ParkingType.BUS]: '🚌',
    [ParkingType.CARAVAN]: '🚐'
  };

  return (
    <div className="legend-container">
      <div className="legend-header">
        <i className="fas fa-map legend-icon"></i>
        <h4 className="legend-title">Map Legend</h4>
      </div>
      
      <div className="legend-content">
        {/* Cultural Sites */}
        {culturalSites.length > 0 && (
          <div>
            <h5 className="legend-section-title">
              Cultural Sites ({culturalSites.length})
            </h5>
            <div className="legend-items">
              {Object.values(CategoryType).map((category) => {
                const color = getCategoryColor(category);
                const count = culturalSites.filter(site => site.category === category).length;
                
                if (count === 0) return null;
                
                return (
                  <div key={category} className="legend-item">
                    <div
                      className="legend-marker"
                      style={{ backgroundColor: color }}
                    >
                      {categoryEmojis[category]}
                    </div>
                    <span className="legend-item-text">
                      {category} ({count})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Parking - UPDATED to show nearby parking status */}
        {parkingLots.length > 0 && (
          <>
            <div className="legend-divider"></div>
            <div>
              <h5 className="legend-section-title">
                {isNearbyParking ? 'Nearby Parking' : 'Parking'} ({parkingLots.length})
                {isNearbyParking && (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 'normal',
                    color: '#6366f1',
                    marginLeft: '0.5rem'
                  }}>
                    <i className="fas fa-link" style={{ fontSize: '0.7rem' }}></i> Connected
                  </span>
                )}
              </h5>
              <div className="legend-items">
                {Object.values(ParkingType).map((parkingType) => {
                  const color = getParkingColor(parkingType);
                  const count = parkingLots.filter(lot => lot.parking_type === parkingType).length;
                  
                  if (count === 0) return null;
                  
                  return (
                    <div key={parkingType} className="legend-item">
                      <div
                        className="legend-marker"
                        style={{ backgroundColor: color }}
                      >
                        {parkingEmojis[parkingType]}
                      </div>
                      <span className="legend-item-text">
                        {parkingType} ({count})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Districts */}
        {districts.length > 0 && (
          <>
            <div className="legend-divider"></div>
            <div>
              <h5 className="legend-section-title">
                Districts ({districts.length})
              </h5>
              <div className="legend-item">
                <div className="legend-district-marker"></div>
                <span className="legend-item-text">Boundaries</span>
              </div>
            </div>
          </>
        )}

        {/* No data message */}
        {culturalSites.length === 0 && parkingLots.length === 0 && districts.length === 0 && (
          <div className="legend-no-data">
            <i className="fas fa-info-circle legend-no-data-icon"></i>
            <p className="legend-no-data-text">No data to display</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapLegend;