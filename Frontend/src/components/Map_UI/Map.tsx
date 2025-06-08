/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CulturalSite,
  ParkingLot,
  District,
  CategoryType,
  ParkingType,
  FilterState,
  SourceType,
  MapLayerToggles
} from '../../types';
import { geoUtils } from '../../services/api';

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ChemnitzMapProps {
  // Map data
  culturalSites: CulturalSite[];
  parkingLots: ParkingLot[];
  districts: District[];
  loading: boolean;
  selectedDistrict?: string;

  // Filter state and handlers
  filterState: FilterState;
  onFilterUpdate: (updates: Partial<FilterState>) => void;
  onClearAllFilters: () => void;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onRefresh: () => void;

  // Additional data for filters
  categories?: CategoryType[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  districtNames?: Array<{ id: string; name: string }>;
  districtsLoading: boolean;
  districtsError: string | null;

  // Search state
  searchResults: CulturalSite[];
  searchLoading: boolean;

  // Errors
  mapError: string | null;

  // Loading states
  loadingState: {
    sites: boolean;
    parking: boolean;
    districts: boolean;
  };
}

const ChemnitzMap: React.FC<ChemnitzMapProps> = ({
  culturalSites,
  parkingLots,
  districts,
  loading,
  selectedDistrict,
  filterState,
  onFilterUpdate,
  onClearAllFilters,
  onSearch,
  onRefresh,
  categoriesError,
  districtNames,
  districtsLoading,
  districtsError,
  searchResults,
  searchLoading,
  mapError

}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const districtsLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // ⇦ Added for “Menu” dropdown

  // Enhanced category colors with better contrast
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

    const icon = isParking ? '🚌' : category ? categoryIcons[category] : '📍';

    return L.divIcon({
      html: `
        <div style="
          background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: transform 0.2s ease;
          font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
        " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">${icon}</div>
      `,
      className: 'custom-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  };

  // Initialize map with enhanced styling
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map with better initial settings
    const map = L.map(mapRef.current, {
      center: [50.8279, 12.9214], // Chemnitz coordinates
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      maxZoom: 18,
      minZoom: 8
    });

    // Add custom zoom control in top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add beautiful map tiles with retina support
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
      detectRetina: true
    }).addTo(map);

    // Create layers group for markers and districts
    const markersLayer = L.layerGroup().addTo(map);
    const districtsLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;
    districtsLayerRef.current = districtsLayer;
    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        districtsLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Add district boundaries
  useEffect(() => {
    if (!mapReady || !districtsLayerRef.current) return;

    // Clear existing districts
    districtsLayerRef.current.clearLayers();

    if (districts && districts.length > 0) {
      districts.forEach((district) => {
        try {
          if (district.geometry) {
            // Determine if this is the selected district
            const isSelected = selectedDistrict && district.properties?.STADTTNAME === selectedDistrict;

            // Different styles for selected vs all districts
            const style = isSelected
              ? {
                  // Selected district - more prominent
                  color: '#1d4ed8',
                  weight: 3,
                  opacity: 1,
                  fillColor: '#3b82f6',
                  fillOpacity: 0.2,
                  dashArray: '0' // Solid line
                }
              : {
                  // All districts view - subtle
                  color: '#6366f1',
                  weight: 2,
                  opacity: 0.8,
                  fillColor: '#6366f1',
                  fillOpacity: 0.1,
                  dashArray: '5, 5' // Dashed line
                };

            const geoJsonLayer = L.geoJSON(district.geometry, { style });

            // Enhanced popup with different content
            const popupContent = isSelected
              ? `<div class="p-3">
                   <h3 class="font-bold text-lg text-blue-800">${
                     district.properties?.STADTTNAME || district.name
                   }</h3>
                   <p class="text-sm text-blue-600 mt-1">🎯 Selected District</p>
                   <p class="text-xs text-gray-500 mt-2">
                     Showing sites within this district boundary
                   </p>
                 </div>`
              : `<div class="p-3">
                   <h3 class="font-bold text-lg text-indigo-800">${
                     district.properties?.STADTTNAME || district.name
                   }</h3>
                   <p class="text-sm text-gray-600 mt-1">District Boundary</p>
                 </div>`;

            geoJsonLayer.bindPopup(popupContent);
            districtsLayerRef.current!.addLayer(geoJsonLayer);
          }
        } catch (error) {
          console.error('Error adding district boundary:', error, district);
        }
      });
    }
  }, [districts, mapReady, selectedDistrict]);

  // Update markers with popups
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    const sitesArray = Array.isArray(culturalSites) ? culturalSites : [];
    const parkingArray = Array.isArray(parkingLots) ? parkingLots : [];

    console.log('Adding markers:', { sites: sitesArray.length, parking: parkingArray.length });

    // Add cultural sites markers with smaller popups
    sitesArray.forEach((site) => {
      try {
        const [lat, lng] = geoUtils.mongoLocationToLeaflet(site.location);
        const color = getCategoryColor(site.category);
        const marker = createColoredMarker(color, site.category, false);

        const leafletMarker = L.marker([lat, lng], { icon: marker });

        const popupContent = `
          <div style="min-width: 200px; max-width: 300px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, ${color}, ${color}dd); color: white; padding: 8px 12px; margin: -10px -10px 8px -10px; border-radius: 4px 4px 0 0;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 600; line-height: 1.3;">${site.name}</h3>
              <span style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 500; margin-top: 4px; display: inline-block;">
                ${site.category.charAt(0).toUpperCase() + site.category.slice(1)}
              </span>
            </div>

            <!-- Content -->
            <div style="font-size: 12px; line-height: 1.4;">
              ${site.description ? `
                <div style="margin-bottom: 6px; color: #374151;">
                  <strong>ℹ️</strong> ${site.description.length > 80 ? site.description.substring(0, 80) + '...' : site.description}
                </div>` : ''}

              ${site.address ? `
                <div style="margin-bottom: 6px; color: #6b7280;">
                  <strong>📍</strong> ${site.address}
                </div>` : ''}

              ${site.phone ? `
                <div style="margin-bottom: 6px;">
                  <strong>📞</strong> <a href="tel:${site.phone}" style="color: #2563eb; text-decoration: none;">${site.phone}</a>
                </div>` : ''}

              ${site.opening_hours ? `
                <div style="margin-bottom: 6px; color: #6b7280;">
                  <strong>🕒</strong> ${site.opening_hours}
                </div>` : ''}

              ${site.website ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                  <a href="${site.website}" target="_blank" rel="noopener noreferrer"
                     style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: ${color}; color: white; text-decoration: none; border-radius: 4px; font-size: 11px; font-weight: 500;">
                    🌐 Website
                  </a>
                </div>` : ''}
            </div>
          </div>
        `;

        leafletMarker.bindPopup(popupContent, {
          maxWidth: 300,
          minWidth: 200,
          className: 'custom-popup-fixed',
          closeButton: true,
          offset: [0, -5]
        });

        markersLayerRef.current!.addLayer(leafletMarker);
      } catch (error) {
        console.error('Error adding cultural site marker:', error, site);
      }
    });

    // Add parking lots markers with smaller popups
    parkingArray.forEach((parking) => {
      try {
        const [lat, lng] = geoUtils.mongoLocationToLeaflet(parking.location);
        const color = getParkingColor(parking.parking_type);
        const marker = createColoredMarker(color, undefined, true);

        const leafletMarker = L.marker([lat, lng], { icon: marker });

        // Smaller parking popup
        const popupContent = `
          <div style="min-width: 180px; max-width: 250px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, ${color}, ${color}dd); color: white; padding: 8px 12px; margin: -10px -10px 8px -10px; border-radius: 4px 4px 0 0;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 600; line-height: 1.3;">${parking.name}</h3>
              <span style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 500; margin-top: 4px; display: inline-block;">
                ${parking.parking_type.charAt(0).toUpperCase() + parking.parking_type.slice(1)} Parking
              </span>
            </div>

            <!-- Content -->
            <div style="font-size: 12px; line-height: 1.4;">
              ${parking.capacity ? `
                <div style="margin-bottom: 6px; color: #374151;">
                  <strong>🚗</strong> Capacity: <span style="font-weight: 600;">${parking.capacity} spaces</span>
                </div>` : ''}

              ${parking.address ? `
                <div style="margin-bottom: 6px; color: #6b7280;">
                  <strong>📍</strong> ${parking.address}
                </div>` : ''}

              ${parking.description ? `
                <div style="margin-bottom: 6px; color: #6b7280;">
                  <strong>ℹ️</strong> ${parking.description}
                </div>` : ''}
            </div>
          </div>
        `;

        leafletMarker.bindPopup(popupContent, {
          maxWidth: 250,
          minWidth: 180,
          className: 'custom-popup-fixed',
          closeButton: true,
          offset: [0, -5]
        });

        markersLayerRef.current!.addLayer(leafletMarker);
      } catch (error) {
        console.error('Error adding parking marker:', error, parking);
      }
    });

    // Auto-fit map to markers if we have data
    if (sitesArray.length > 0 || parkingArray.length > 0) {
      try {
        const allLayers = [...markersLayerRef.current.getLayers()];
        if (districts.length > 0 && districtsLayerRef.current) {
          allLayers.push(...(districtsLayerRef.current.getLayers() as L.Layer[]));
        }

        if (allLayers.length > 0) {
          const group = L.featureGroup(allLayers);
          if (group.getBounds().isValid()) {
            mapInstanceRef.current!.fitBounds(group.getBounds(), {
              padding: [20, 20],
              maxZoom: 15
            });
          }
        }
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }
  }, [culturalSites, parkingLots, mapReady, districts]);

  // Update map layers handler
  const updateMapLayers = (updates: Partial<MapLayerToggles>) => {
    onFilterUpdate({
      mapLayers: { ...filterState.mapLayers, ...updates }
    });
  };

  // Calculate active filter count for UI
  const activeFilterCount = [
    filterState.category,
    filterState.source !== SourceType.CHEMNITZ ? filterState.source : null,
    filterState.district,
    filterState.search
  ].filter(Boolean).length;

  // Emoji map for categories
  const categoryEmojis: Record<CategoryType, string> = {
    [CategoryType.THEATRE]: '🎭',
    [CategoryType.MUSEUM]: '🏛️',
    [CategoryType.RESTAURANT]: '🍽️',
    [CategoryType.ARTWORK]: '🎨'
  };

  return (
    <>
      {/* ─── NAVBAR ─── */}
      <nav className="bg-white shadow-md z-50 relative">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* ─── LEFT COLUMN ─── */}
          <div className="relative flex items-center gap-2">
            {/* Menu Toggle Button */}
            <button
              onClick={() => {
                console.log("🗂️ Menu toggled! Current menuOpen:", menuOpen);
                setMenuOpen((open) => !open);
              }}
              className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 text-sm font-medium focus:outline-none"
            >
              {/* Hamburger icon */}
              <svg
                className="w-5 h-5 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <span>Menu</span>
            </button>

            {/* ── Submenu: Region + District (shown when menuOpen is true) ── */}
            {menuOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="px-4 py-3 space-y-3">
                  {/* Region Filter */}
                  <div className="flex flex-col">
                    <label htmlFor="region-select" className="text-sm font-medium text-gray-700 mb-1">
                      Region
                    </label>
                    <select
                      id="region-select"
                      value={filterState.source}
                      onChange={(e) =>
                        onFilterUpdate({ source: e.target.value as SourceType })
                      }
                      className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={SourceType.CHEMNITZ}>🏛️ Chemnitz</option>
                      <option value={SourceType.SACHSEN}>🏰 Saxony</option>
                    </select>
                  </div>

                  {/* District Filter */}
                  <div className="flex flex-col">
                    <label htmlFor="district-select" className="text-sm font-medium text-gray-700 mb-1">
                      District
                    </label>
                    <select
                      id="district-select"
                      value={filterState.district || ''}
                      onChange={(e) =>
                        onFilterUpdate({ district: e.target.value || undefined })
                      }
                      disabled={districtsLoading}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="">
                        All Districts {districtNames ? `(${districtNames.length})` : ''}
                      </option>
                      {districtNames?.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    {districtsError && (
                      <span className="text-xs text-red-600 mt-1">⚠️ Error loading districts</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── MIDDLE COLUMN ─── */}
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-gray-800">Chemnitz Cultural Explorer</h1>
          </div>

          {/* ─── RIGHT COLUMN ─── */}
          <div className="flex items-center gap-6">
            {/* ── Search Bar ── */}
            <div className={`relative transition-all duration-300 ${isSearchFocused ? 'transform scale-105' : ''} w-64`}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             
              </div>
              <input
                type="text"
                placeholder="Search cultural sites..."
                value={filterState.search}
                onChange={(e) => onSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="w-full pl-10 pr-10 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
              />
              {filterState.search && (
                <button
                  onClick={() => onSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-200 rounded-r-lg transition-colors duration-200"
                >
                  
                </button>
              )}
            </div>

            {/* ── Category Filter Chips ── */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => onFilterUpdate({ category: undefined })}
                className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200
                  ${!filterState.category ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                All
              </button>
              {Object.values(CategoryType).map((category) => {
                const isSelected = filterState.category === category;
                return (
                  <button
                    key={category}
                    onClick={() => onFilterUpdate({ category: isSelected ? undefined : category })}
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 whitespace-nowrap transition-all duration-200
                      ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'}`}
                  >
                    <span>{categoryEmojis[category]}</span>
                    <span className="capitalize">{category}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Layer Toggles ── */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterState.mapLayers.showParking}
                  onChange={(e) => updateMapLayers({ showParking: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">🚌 Parking</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterState.mapLayers.showDistricts}
                  onChange={(e) => updateMapLayers({ showDistricts: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">🗺️ Districts</span>
              </label>
            </div>

            {/* ── Clear Filters Button ── */}
            {activeFilterCount > 0 && (
              <button
                onClick={onClearAllFilters}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1"
              >
               
                Clear ({activeFilterCount})
              </button>
            )}

            {/* ── Refresh Button ── */}
           

            {/* ── USER SECTION (placeholder) ── */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-sm font-medium">
                U
              </div>
              <span className="text-sm text-gray-700">Username</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── PERFORMANCE NOTICE ─── */}
      {filterState.source === SourceType.SACHSEN && culturalSites.length > 1000 && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-6 py-2">
            <div className="flex items-center gap-2 text-sm text-amber-800">
          
              <span>
                <strong>Performance Notice:</strong> Displaying {culturalSites.length.toLocaleString()} sites. Consider filtering by region or district for better performance.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── ERROR MESSAGES ─── */}
      {(mapError || categoriesError || districtsError) && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
          
              <h3 className="font-semibold text-red-800">Connection Issues</h3>
            </div>
            <div className="text-sm text-red-700 space-y-1">
              {mapError && <p>• Map Data: {mapError}</p>}
              {categoriesError && <p>• Categories: {categoriesError}</p>}
              {districtsError && <p>• Districts: {districtsError}</p>}
            </div>
            <button
              onClick={onRefresh}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Retry Loading
            </button>
          </div>
        </div>
      )}

      {/* ─── SEARCH STATUS ─── */}
      {filterState.search && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
               
                <span className="text-blue-800 font-medium">
                  Search Results for "{filterState.search}"
                </span>
                {searchLoading && (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="text-sm text-blue-700">
                {searchLoading ? 'Searching...' : `${searchResults.length} sites found`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAP CONTAINER ─── */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200/50">
          <div className="relative w-full h-full" style={{ height: '700px' }}>
            {/* Better loading overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-[1000]">
                <div className="text-center">
                  <div className="relative mb-4">
                    <div className="w-12 h-12 border-3 border-blue-200 rounded-full animate-spin border-t-blue-600 mx-auto"></div>
                    <div className="absolute inset-0 w-12 h-12 border-3 border-transparent rounded-full animate-ping border-t-blue-400 mx-auto"></div>
                  </div>
                  <p className="text-gray-700 font-medium">Loading map data...</p>
                </div>
              </div>
            )}

            {/* Map container */}
            <div ref={mapRef} className="w-full h-full rounded-xl" style={{ height: '700px' }} />

            {/* Enhanced Floating Legend */}
            <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-200/50 z-[1000] max-w-xs">
              <div className="flex items-center gap-2 mb-3">
             
                <h4 className="font-bold text-gray-800 text-sm">Map Legend</h4>
              </div>
              <div className="space-y-2 text-xs">
                {/* Cultural Sites */}
                {culturalSites.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-gray-700 mb-1 text-xs">Cultural Sites</h5>
                    <div className="space-y-1">
                      {Object.values(CategoryType).map((category) => {
                        const color = getCategoryColor(category);
                        return (
                          <div key={category} className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px]"
                              style={{ backgroundColor: color }}
                            >
                              {categoryEmojis[category]}
                            </div>
                            <span className="text-gray-700 text-xs capitalize">{category}</span>
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
                      <h5 className="font-semibold text-gray-700 mb-1 text-xs">Parking</h5>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px]"
                            style={{ backgroundColor: '#059669' }}
                          >
                            🚌
                          </div>
                          <span className="text-gray-700 text-xs">Bus Parking</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-white shadow-sm flex items-center justify-center text-[8px]"
                            style={{ backgroundColor: '#374151' }}
                          >
                            🚐
                          </div>
                          <span className="text-gray-700 text-xs">Caravan Parking</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Districts */}
                {districts.length > 0 && (
                  <>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1 text-xs">Districts</h5>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-indigo-600 bg-indigo-600/10 rounded"></div>
                        <span className="text-gray-700 text-xs">Boundaries</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

  

            {/* Map Controls Info */}
            <div className="absolute bottom-6 left-6 bg-black/80 text-white px-3 py-2 rounded-lg text-xs z-[1000]">
              <p>Click markers for details • Zoom with mouse wheel • Drag to pan</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChemnitzMap;
