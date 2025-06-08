// components/Map/MapLegend.tsx
import React from 'react';
import { CulturalSite, ParkingLot, District, CategoryType, ParkingType } from '../../types';

interface MapLegendProps {
  culturalSites: CulturalSite[];
  parkingLots: ParkingLot[];
  districts: District[];
}

const MapLegend: React.FC<MapLegendProps> = ({ culturalSites, parkingLots, districts }) => {
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
    <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-200/50 z-[1000] max-w-xs">
      <div className="flex items-center gap-2 mb-3">
        <i className="fas fa-map text-blue-600"></i>
        <h4 className="font-bold text-gray-800 text-sm">Map Legend</h4>
      </div>
      
      <div className="space-y-3 text-xs">
        {/* Cultural Sites */}
        {culturalSites.length > 0 && (
          <div>
            <h5 className="font-semibold text-gray-700 mb-2 text-xs">
              Cultural Sites ({culturalSites.length})
            </h5>
            <div className="space-y-1">
              {Object.values(CategoryType).map((category) => {
                const color = getCategoryColor(category);
                const count = culturalSites.filter(site => site.category === category).length;
                
                if (count === 0) return null;
                
                return (
                  <div key={category} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px]"
                      style={{ backgroundColor: color }}
                    >
                      {categoryEmojis[category]}
                    </div>
                    <span className="text-gray-700 text-xs capitalize">
                      {category} ({count})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Parking */}
        {parkingLots.length > 0 && (
          <>
            <div className="border-t border-gray-200 my-2"></div>
            <div>
              <h5 className="font-semibold text-gray-700 mb-2 text-xs">
                Parking ({parkingLots.length})
              </h5>
              <div className="space-y-1">
                {Object.values(ParkingType).map((parkingType) => {
                  const color = getParkingColor(parkingType);
                  const count = parkingLots.filter(lot => lot.parking_type === parkingType).length;
                  
                  if (count === 0) return null;
                  
                  return (
                    <div key={parkingType} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px]"
                        style={{ backgroundColor: color }}
                      >
                        {parkingEmojis[parkingType]}
                      </div>
                      <span className="text-gray-700 text-xs capitalize">
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
            <div className="border-t border-gray-200 my-2"></div>
            <div>
              <h5 className="font-semibold text-gray-700 mb-2 text-xs">
                Districts ({districts.length})
              </h5>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-600 bg-indigo-600/10 rounded"></div>
                <span className="text-gray-700 text-xs">Boundaries</span>
              </div>
            </div>
          </>
        )}

        {/* No data message */}
        {culturalSites.length === 0 && parkingLots.length === 0 && districts.length === 0 && (
          <div className="text-center text-gray-500 py-2">
            <i className="fas fa-info-circle mb-1"></i>
            <p className="text-xs">No data to display</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapLegend;