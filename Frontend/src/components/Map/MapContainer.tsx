/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// components/Map/MapContainer.tsx
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapContainer.css'; 
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
   focusedSiteId?: string; //
}

const MapContainer: React.FC<MapContainerProps> = ({
  culturalSites,
  parkingLots,
  districts,
  loading,
  selectedDistrict,
  mapError,
  focusedSiteId
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const districtsLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
    useEffect(() => {
    if (focusedSiteId) {
      // Find the site and focus on it
      const site = culturalSites.find(s => s.id === focusedSiteId);
      if (site) {
        console.log(`🎯 Focusing on site: ${site.name}`);
        // Add your map focusing logic here
        // Example: map.setView([site.latitude, site.longitude], 16);
      }
    }
  }, [focusedSiteId, culturalSites]);

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
        <div class="marker-icon" style="
          --marker-color: ${color};
          --marker-color-fade: ${color}dd;
          background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
        ">${icon}</div>
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
            const districtColor = isSelected ? '#1d4ed8' : '#6366f1';
            const districtColorSecondary = isSelected ? '#3b82f6' : '#8b5cf6';
            
            const popupContent = `
              <div class="district-popup-container">
                <div class="district-popup-header" style="
                  --district-color: ${districtColor};
                  --district-color-secondary: ${districtColorSecondary};
                ">
                  <h3 class="district-popup-title">${districtName}</h3>
                </div>
                <div class="district-popup-content">
                  <p class="district-popup-status" style="--district-color: ${districtColor};">
                    ${isSelected ? '🎯 Selected District' : '🗺️ District Boundary'}
                  </p>
                  ${isSelected ? `
                    <p class="district-popup-subtitle">
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

        // Enhanced popup content with CSS classes
        const popupContent = `
          <div class="popup-container">
            <div class="popup-header" style="
              --popup-color: ${color};
              --popup-color-fade: ${color}dd;
            ">
              <h3 class="popup-title">${site.name}</h3>
              <span class="popup-category">
                ${site.category.charAt(0).toUpperCase() + site.category.slice(1)}
              </span>
            </div>

            <div class="popup-content">
              ${site.description ? `
                <div class="popup-description" style="--popup-color: ${color};">
                  <div class="popup-description-content">
                    <span class="popup-description-icon">ℹ️</span>
                    <span class="popup-description-text">
                      ${site.description.length > 100 ? site.description.substring(0, 100) + '...' : site.description}
                    </span>
                  </div>
                </div>
              ` : ''}

              ${site.address ? `
                <div class="popup-info-item">
                  <span class="popup-info-icon">📍</span>
                  <span class="popup-info-text">${site.address}</span>
                </div>
              ` : ''}

              ${site.phone ? `
                <div class="popup-info-item">
                  <span class="popup-info-icon">📞</span>
                  <a href="tel:${site.phone}" class="popup-phone-link" style="--popup-color: ${color};">${site.phone}</a>
                </div>
              ` : ''}

              ${site.opening_hours ? `
                <div class="popup-info-item">
                  <span class="popup-info-icon">🕒</span>
                  <span class="popup-info-text">${site.opening_hours}</span>
                </div>
              ` : ''}

              ${site.website ? `
                <div class="popup-website-section">
                  <a href="${site.website}" target="_blank" rel="noopener noreferrer" class="popup-website-btn" style="--popup-color: ${color};">
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
          <div class="parking-popup-container">
            <div class="popup-header" style="
              --popup-color: ${color};
              --popup-color-fade: ${color}dd;
            ">
              <h3 class="popup-title">${parking.name}</h3>
              <span class="popup-category">
                ${parking.parking_type.charAt(0).toUpperCase() + parking.parking_type.slice(1)} Parking
              </span>
            </div>

            <div class="popup-content">
              ${parking.capacity ? `
                <div class="parking-capacity-info" style="--popup-color: ${color};">
                  <div class="parking-capacity-content">
                    <span class="popup-info-icon">🚗</span>
                    <span class="parking-capacity-text">
                      Capacity: <span class="parking-capacity-number" style="--popup-color: ${color};">${parking.capacity} spaces</span>
                    </span>
                  </div>
                </div>
              ` : ''}

              ${parking.address ? `
                <div class="popup-info-item">
                  <span class="popup-info-icon">📍</span>
                  <span class="popup-info-text">${parking.address}</span>
                </div>
              ` : ''}

              ${parking.description ? `
                <div class="popup-info-item">
                  <span class="popup-info-icon">ℹ️</span>
                  <span class="popup-info-text">${parking.description}</span>
                </div>
              ` : ''}

              <div class="parking-status-section">
                <span class="parking-status-badge" style="
                  --popup-color: ${color};
                  --popup-color-light: ${color}15;
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
    <div className="map-container">
      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner">
              <div className="spinner-main"></div>
              <div className="spinner-ping"></div>
            </div>
            <p className="loading-title">Loading map data...</p>
            <p className="loading-subtitle">Please wait while we fetch the cultural sites</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {mapError && (
        <div className="error-message">
          <div className="error-content">
            <div className="error-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div className="error-body">
              <h4 className="error-title">Map Loading Error</h4>
              <p className="error-text">{mapError}</p>
              <button 
                onClick={() => window.location.reload()}
                className="error-retry-btn"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapRef} className="map-element" />

      {/* Map Legend Component */}
      <MapLegend 
        culturalSites={culturalSites}
        parkingLots={parkingLots}
        districts={districts}
      />

      {/* Map Controls Info */}
      <div className="map-controls-info">
        <div className="map-controls-content">
          <i className="fas fa-info-circle map-controls-icon"></i>
          <span>Click markers for details • Zoom with mouse wheel • Drag to pan</span>
        </div>
      </div>

      {/* Data Statistics */}
      {!loading && (culturalSites.length > 0 || parkingLots.length > 0) && (
        <div className="map-stats">
          <div className="map-stats-content">
            {culturalSites.length > 0 && (
              <span className="map-stats-item">
                <i className="fas fa-map-marker-alt map-stats-sites-icon"></i>
                {culturalSites.length} sites
              </span>
            )}
            {parkingLots.length > 0 && (
              <span className="map-stats-item">
                <i className="fas fa-parking map-stats-parking-icon"></i>
                {parkingLots.length} parking
              </span>
            )}
            {districts.length > 0 && (
              <span className="map-stats-item">
                <i className="fas fa-map map-stats-districts-icon"></i>
                {districts.length} districts
              </span>
            )}
          </div>
        </div>
      )}

      {/* No Data Message */}
      {!loading && culturalSites.length === 0 && parkingLots.length === 0 && (
        <div className="no-data-overlay">
          <div className="no-data-content">
            <div className="no-data-emoji">🗺️</div>
            <h3 className="no-data-title">No Data Available</h3>
            <p className="no-data-description">
              No cultural sites or parking lots found for the current filters.
            </p>
            <div className="no-data-hint">
              Try adjusting your location or filter settings.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapContainer;