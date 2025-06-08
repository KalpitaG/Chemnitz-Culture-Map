/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// components/Map/MapContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CulturalSite,
  ParkingLot,
  District,
  CategoryType,
  ParkingType
} from '../../types';
import { geoUtils } from '../../services/api';
import MapLegend from './MapLegend';

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapContainerProps {
  culturalSites: CulturalSite[];
  parkingLots: ParkingLot[];
  districts: District[];
  loading: boolean;
  selectedDistrict?: string;
  mapError?: string | null;
}

const MapContainer: React.FC<MapContainerProps> = ({
  culturalSites,
  parkingLots,
  districts,
  loading,
  selectedDistrict,
  mapError
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const districtsLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Enhanced category colors with proper contrast
  const getCategoryColor = (category: CategoryType): string => {
    switch (category) {
      case CategoryType.THEATRE:
        return '#dc2626'; // Red-600
      case CategoryType.MUSEUM:
        return '#2563eb'; // Blue-600
      case CategoryType.RESTAURANT:
        return '#ea580c'; // Orange-600
      case CategoryType.ARTWORK:
        return '#9333ea'; // Purple-600
      default:
        return '#6b7280'; // Gray-500
    }
  };

  const getParkingColor = (type: ParkingType): string => {
    switch (type) {
      case ParkingType.BUS:
        return '#059669'; // Emerald-600
      case ParkingType.CARAVAN:
        return '#374151'; // Gray-700
      default:
        return '#6b7280'; // Gray-500
    }
  };

  // Create enhanced custom markers with emoji rendering
  const createColoredMarker = (color: string, category?: CategoryType, isParking: boolean = false) => {
    const categoryIcons: Record<CategoryType, string> = {
      [CategoryType.THEATRE]: '🎭',
      [CategoryType.MUSEUM]: '🏛️',
      [CategoryType.RESTAURANT]: '🍽️',
      [CategoryType.ARTWORK]: '🎨'
    };

    const parkingIcons: Record<ParkingType, string> = {
      [ParkingType.BUS]: '🚌',
      [ParkingType.CARAVAN]: '🚐'
    };

    let icon = '📍';
    if (isParking) {
      // For parking, we need to determine the type from color
      if (color === '#059669') icon = parkingIcons[ParkingType.BUS];
      else if (color === '#374151') icon = parkingIcons[ParkingType.CARAVAN];
      else icon = '🅿️';
    } else if (category) {
      icon = categoryIcons[category];
    }

    return L.divIcon({
      html: `
        <div style="
          background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
          position: relative;
          z-index: 1000;
        " 
        onmouseover="this.style.transform='scale(1.3)'; this.style.zIndex='1001';" 
        onmouseout="this.style.transform='scale(1)'; this.style.zIndex='1000';"
        >${icon}</div>
      `,
      className: 'custom-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
  };

  // Initialize map with enhanced settings
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    console.log('🗺️ Initializing Leaflet map...');

    // Create map with better initial settings
    const map = L.map(mapRef.current, {
      center: [50.8279, 12.9214], // Chemnitz coordinates
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      maxZoom: 18,
      minZoom: 8,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true
    });

    // Add custom zoom control in top-right
    L.control.zoom({ 
      position: 'topright',
      zoomInTitle: 'Zoom in',
      zoomOutTitle: 'Zoom out'
    }).addTo(map);

    // Add beautiful map tiles with retina support
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 18,
      detectRetina: true,
      crossOrigin: true
    }).addTo(map);

    // Create layers group for markers and districts
    const markersLayer = L.layerGroup().addTo(map);
    const districtsLayer = L.layerGroup().addTo(map);

    // Store references
    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;
    districtsLayerRef.current = districtsLayer;
    setMapReady(true);

    console.log('✅ Map initialized successfully');

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up map...');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        districtsLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Add district boundaries with enhanced styling
  useEffect(() => {
    if (!mapReady || !districtsLayerRef.current) return;

    console.log('🏘️ Adding district boundaries...', districts.length);

    // Clear existing districts
    districtsLayerRef.current.clearLayers();

    if (districts && districts.length > 0) {
      districts.forEach((district, index) => {
        try {
          if (district.geometry) {
            // Determine if this is the selected district
            const isSelected = selectedDistrict && (
              district.properties?.STADTTNAME === selectedDistrict ||
              district.name === selectedDistrict
            );

            // Enhanced styles for selected vs all districts
            const style = isSelected
              ? {
                  // Selected district - more prominent
                  color: '#1d4ed8',
                  weight: 4,
                  opacity: 1,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.25,
                  dashArray: '0', // Solid line
                  lineJoin: 'round' as const,
                  lineCap: 'round' as const
                }
              : {
                  // All districts view - subtle
                  color: '#6366f1',
                  weight: 2,
                  opacity: 0.7,
                  fillColor: '#6366f1',
                  fillOpacity: 0.08,
                  dashArray: '5, 5', // Dashed line
                  lineJoin: 'round' as const,
                  lineCap: 'round' as const
                };

            const geoJsonLayer = L.geoJSON(district.geometry, { 
              style,
              onEachFeature: (_feature, layer) => {
                // Add hover effects
                layer.on({
                  mouseover: (e) => {
                    const layer = e.target;
                    layer.setStyle({
                      weight: isSelected ? 5 : 3,
                      opacity: 1,
                      fillOpacity: isSelected ? 0.35 : 0.15
                    });
                  },
                  mouseout: (e) => {
                    const layer = e.target;
                    layer.setStyle(style);
                  }
                });
              }
            });

            // Enhanced popup with better styling
            const districtName = district.properties?.STADTTNAME || district.name || `District ${index + 1}`;
            const popupContent = `
              <div style="
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                min-width: 180px;
                text-align: center;
              ">
                <div style="
                  background: linear-gradient(135deg, ${isSelected ? '#1d4ed8' : '#6366f1'}, ${isSelected ? '#3b82f6' : '#8b5cf6'});
                  color: white;
                  padding: 10px 15px;
                  margin: -10px -10px 10px -10px;
                  border-radius: 6px 6px 0 0;
                ">
                  <h3 style="
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    line-height: 1.3;
                  ">${districtName}</h3>
                </div>
                <div style="padding: 5px 0;">
                  <p style="
                    margin: 0;
                    font-size: 13px;
                    color: ${isSelected ? '#1d4ed8' : '#6366f1'};
                    font-weight: 500;
                  ">
                    ${isSelected ? '🎯 Selected District' : '🗺️ District Boundary'}
                  </p>
                  ${isSelected ? `
                    <p style="
                      margin: 8px 0 0 0;
                      font-size: 11px;
                      color: #6b7280;
                      line-height: 1.4;
                    ">
                      Showing sites within this district
                    </p>
                  ` : ''}
                </div>
              </div>
            `;

            geoJsonLayer.bindPopup(popupContent, {
              className: 'district-popup',
              closeButton: true,
              offset: [0, -10]
            });

            districtsLayerRef.current!.addLayer(geoJsonLayer);
          }
        } catch (error) {
          console.error('❌ Error adding district boundary:', error, district);
        }
      });
      
      console.log('✅ District boundaries added successfully');
    }
  }, [districts, mapReady, selectedDistrict]);

  // Add markers with enhanced popups and error handling
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current) return;

    console.log('📍 Adding markers...', {
      culturalSites: culturalSites.length,
      parkingLots: parkingLots.length
    });

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    const sitesArray = Array.isArray(culturalSites) ? culturalSites : [];
    const parkingArray = Array.isArray(parkingLots) ? parkingLots : [];

    let addedSites = 0;
    let addedParking = 0;

    // Add cultural sites markers with enhanced popups
    sitesArray.forEach((site, _index) => {
      try {
        if (!site.location || !site.location.coordinates) {
          console.warn('⚠️ Site missing location data:', site.name);
          return;
        }

        const [lat, lng] = geoUtils.mongoLocationToLeaflet(site.location);
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.warn('⚠️ Invalid coordinates for site:', site.name, { lat, lng });
          return;
        }

        const color = getCategoryColor(site.category);
        const marker = createColoredMarker(color, site.category, false);
        const leafletMarker = L.marker([lat, lng], { icon: marker });

        // Enhanced popup content with better styling
        const popupContent = `
          <div style="
            min-width: 220px;
            max-width: 320px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.4;
          ">
            <!-- Header with gradient background -->
            <div style="
              background: linear-gradient(135deg, ${color}, ${color}dd);
              color: white;
              padding: 12px 15px;
              margin: -10px -10px 12px -10px;
              border-radius: 6px 6px 0 0;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              <h3 style="
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.3;
              ">${site.name}</h3>
              <span style="
                background: rgba(255,255,255,0.25);
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 500;
                display: inline-block;
                backdrop-filter: blur(10px);
              ">
                ${site.category.charAt(0).toUpperCase() + site.category.slice(1)}
              </span>
            </div>

            <!-- Content with better spacing -->
            <div style="
              font-size: 13px;
              line-height: 1.5;
              color: #374151;
            ">
              ${site.description ? `
                <div style="
                  margin-bottom: 10px;
                  padding: 8px;
                  background: #f8fafc;
                  border-radius: 4px;
                  border-left: 3px solid ${color};
                ">
                  <div style="display: flex; align-items: flex-start; gap: 6px;">
                    <span style="font-size: 14px;">ℹ️</span>
                    <span style="font-size: 12px; line-height: 1.4; color: #4b5563;">
                      ${site.description.length > 100 ? site.description.substring(0, 100) + '...' : site.description}
                    </span>
                  </div>
                </div>
              ` : ''}

              ${site.address ? `
                <div style="
                  margin-bottom: 8px;
                  display: flex;
                  align-items: flex-start;
                  gap: 6px;
                ">
                  <span style="font-size: 14px; margin-top: 1px;">📍</span>
                  <span style="font-size: 12px; color: #6b7280; line-height: 1.4;">
                    ${site.address}
                  </span>
                </div>
              ` : ''}

              ${site.phone ? `
                <div style="
                  margin-bottom: 8px;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                ">
                  <span style="font-size: 14px;">📞</span>
                  <a href="tel:${site.phone}" style="
                    color: ${color};
                    text-decoration: none;
                    font-size: 12px;
                    font-weight: 500;
                  ">${site.phone}</a>
                </div>
              ` : ''}

              ${site.opening_hours ? `
                <div style="
                  margin-bottom: 8px;
                  display: flex;
                  align-items: flex-start;
                  gap: 6px;
                ">
                  <span style="font-size: 14px; margin-top: 1px;">🕒</span>
                  <span style="font-size: 12px; color: #6b7280; line-height: 1.4;">
                    ${site.opening_hours}
                  </span>
                </div>
              ` : ''}

              ${site.website ? `
                <div style="
                  margin-top: 12px;
                  padding-top: 12px;
                  border-top: 1px solid #e5e7eb;
                  text-align: center;
                ">
                  <a href="${site.website}" target="_blank" rel="noopener noreferrer" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    background: ${color};
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)';">
                    <span style="font-size: 14px;">🌐</span>
                    Visit Website
                  </a>
                </div>
              ` : ''}
            </div>
          </div>
        `;

        leafletMarker.bindPopup(popupContent, {
          maxWidth: 320,
          minWidth: 220,
          className: 'cultural-site-popup',
          closeButton: true,
          offset: [0, -5],
          autoPan: true,
          keepInView: true
        });

        markersLayerRef.current!.addLayer(leafletMarker);
        addedSites++;

      } catch (error) {
        console.error('❌ Error adding cultural site marker:', error, site);
      }
    });

    // Add parking lots markers with enhanced popups
    parkingArray.forEach((parking, _index) => {
      try {
        if (!parking.location || !parking.location.coordinates) {
          console.warn('⚠️ Parking lot missing location data:', parking.name);
          return;
        }

        const [lat, lng] = geoUtils.mongoLocationToLeaflet(parking.location);
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.warn('⚠️ Invalid coordinates for parking:', parking.name, { lat, lng });
          return;
        }

        const color = getParkingColor(parking.parking_type);
        const marker = createColoredMarker(color, undefined, true);
        const leafletMarker = L.marker([lat, lng], { icon: marker });

        // Enhanced parking popup
        const popupContent = `
          <div style="
            min-width: 200px;
            max-width: 280px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.4;
          ">
            <!-- Header -->
            <div style="
              background: linear-gradient(135deg, ${color}, ${color}dd);
              color: white;
              padding: 12px 15px;
              margin: -10px -10px 12px -10px;
              border-radius: 6px 6px 0 0;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              <h3 style="
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.3;
              ">${parking.name}</h3>
              <span style="
                background: rgba(255,255,255,0.25);
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 500;
                display: inline-block;
                backdrop-filter: blur(10px);
              ">
                ${parking.parking_type.charAt(0).toUpperCase() + parking.parking_type.slice(1)} Parking
              </span>
            </div>

            <!-- Content -->
            <div style="
              font-size: 13px;
              line-height: 1.5;
              color: #374151;
            ">
              ${parking.capacity ? `
                <div style="
                  margin-bottom: 10px;
                  padding: 8px;
                  background: #f0fdf4;
                  border-radius: 4px;
                  border-left: 3px solid ${color};
                ">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 14px;">🚗</span>
                    <span style="font-size: 12px; color: #374151;">
                      Capacity: <strong style="color: ${color};">${parking.capacity} spaces</strong>
                    </span>
                  </div>
                </div>
              ` : ''}

              ${parking.address ? `
                <div style="
                  margin-bottom: 8px;
                  display: flex;
                  align-items: flex-start;
                  gap: 6px;
                ">
                  <span style="font-size: 14px; margin-top: 1px;">📍</span>
                  <span style="font-size: 12px; color: #6b7280; line-height: 1.4;">
                    ${parking.address}
                  </span>
                </div>
              ` : ''}

              ${parking.description ? `
                <div style="
                  margin-bottom: 8px;
                  display: flex;
                  align-items: flex-start;
                  gap: 6px;
                ">
                  <span style="font-size: 14px; margin-top: 1px;">ℹ️</span>
                  <span style="font-size: 12px; color: #6b7280; line-height: 1.4;">
                    ${parking.description}
                  </span>
                </div>
              ` : ''}

              <div style="
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
              ">
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  padding: 4px 8px;
                  background: ${color}15;
                  color: ${color};
                  border-radius: 4px;
                  font-size: 11px;
                  font-weight: 500;
                ">
                  🅿️ Parking Available
                </span>
              </div>
            </div>
          </div>
        `;

        leafletMarker.bindPopup(popupContent, {
          maxWidth: 280,
          minWidth: 200,
          className: 'parking-popup',
          closeButton: true,
          offset: [0, -5],
          autoPan: true,
          keepInView: true
        });

        markersLayerRef.current!.addLayer(leafletMarker);
        addedParking++;

      } catch (error) {
        console.error('❌ Error adding parking marker:', error, parking);
      }
    });

    console.log('✅ Markers added successfully:', {
      sites: addedSites,
      parking: addedParking
    });

    // Auto-fit map to markers if we have data
    if (addedSites > 0 || addedParking > 0) {
      try {
        const allLayers = [...markersLayerRef.current.getLayers()];
        
        // Include district boundaries in bounds calculation
        if (districts.length > 0 && districtsLayerRef.current) {
          allLayers.push(...(districtsLayerRef.current.getLayers() as L.Layer[]));
        }

        if (allLayers.length > 0) {
          const group = L.featureGroup(allLayers);
          const bounds = group.getBounds();
          
          if (bounds.isValid()) {
            mapInstanceRef.current!.fitBounds(bounds, {
              padding: [30, 30],
              maxZoom: 15
            });
            console.log('✅ Map bounds fitted to markers');
          }
        }
      } catch (error) {
        console.error('❌ Error fitting bounds:', error);
      }
    } else {
      // No markers, center on Chemnitz
      mapInstanceRef.current!.setView([50.8279, 12.9214], 12);
      console.log('ℹ️ No markers found, centered on Chemnitz');
    }

  }, [culturalSites, parkingLots, mapReady, districts]);

  return (
    <div className="relative w-full h-full bg-white">
      {/* Loading Overlay with enhanced animation */}
      {loading && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-[1000]">
          <div className="text-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600 mx-auto"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-t-blue-400 mx-auto"></div>
            </div>
            <p className="text-gray-700 font-medium text-lg">Loading map data...</p>
            <p className="text-gray-500 text-sm mt-2">Please wait while we fetch the cultural sites</p>
          </div>
        </div>
      )}

      {/* Error Message with retry button */}
      {mapError && (
        <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg z-[1000]">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <i className="fas fa-exclamation-triangle text-red-600 text-lg"></i>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-red-800 mb-1">Map Loading Error</h4>
              <p className="text-red-700 text-sm">{mapError}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Container with proper height */}
      <div 
        ref={mapRef} 
        className="w-full h-full min-h-[600px]" 
        style={{ 
          height: 'calc(100vh - 80px)',
          background: '#f8fafc'
        }}
      />

      {/* Map Legend Component */}
      <MapLegend 
        culturalSites={culturalSites}
        parkingLots={parkingLots}
        districts={districts}
      />

      {/* Enhanced Map Controls Info */}
      <div className="absolute bottom-4 left-4 bg-black/85 text-white px-4 py-2 rounded-lg text-xs z-[1000] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <i className="fas fa-info-circle text-blue-400"></i>
          <span>Click markers for details • Zoom with mouse wheel • Drag to pan</span>
        </div>
      </div>

      {/* Data Statistics (when not loading) */}
      {!loading && (culturalSites.length > 0 || parkingLots.length > 0) && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-600 z-[1000] shadow-sm">
          <div className="flex items-center gap-4">
            {culturalSites.length > 0 && (
              <span className="flex items-center gap-1">
                <i className="fas fa-map-marker-alt text-blue-600"></i>
                {culturalSites.length} sites
              </span>
            )}
            {parkingLots.length > 0 && (
              <span className="flex items-center gap-1">
                <i className="fas fa-parking text-green-600"></i>
                {parkingLots.length} parking
              </span>
            )}
            {districts.length > 0 && (
              <span className="flex items-center gap-1">
                <i className="fas fa-map text-purple-600"></i>
                {districts.length} districts
              </span>
            )}
          </div>
        </div>
      )}

      {/* No Data Message */}
      {!loading && culturalSites.length === 0 && parkingLots.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[999]">
          <div className="text-center bg-white/90 backdrop-blur-sm rounded-lg p-8 shadow-lg">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Data Available</h3>
            <p className="text-gray-600 mb-4">
              No cultural sites or parking lots found for the current filters.
            </p>
            <div className="text-sm text-gray-500">
              Try adjusting your location or filter settings.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;