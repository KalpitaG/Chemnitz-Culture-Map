import { useState, useEffect } from 'react'
import './App.css'
import ChemnitzMap from './Components/Chemnitz_Map/Chemnitz_Map'
import { 
  useSmartCulturalSites, 
  useDistrictNames, 
  useCategories, 
  useSearch, 
  useQuickStats,
  useMapData 
} from './hooks/useApi'
import { CategoryType, SourceType, FilterState, MapLayerToggles } from './types'
import './custom.css';

function App() {
  const [filterState, setFilterState] = useState<FilterState>({
    category: undefined,
    source: SourceType.CHEMNITZ, 
    district: undefined,
    search: '',
    mapLayers: {
      showCulturalSites: true,
      showParking: false,
      showDistricts: false 
    }
  });

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Quick stats for header (optimized endpoint)
  const { data: quickStats, loading: statsLoading, error: statsError } = useQuickStats();
  
  // District names for dropdown (optimized - names only)
  const { 
    data: districtNames, 
    loading: districtsLoading, 
    error: districtsError 
  } = useDistrictNames();

  // DEBUG: Add debugging for districts
  useEffect(() => {
    console.log('🏘️ Districts Debug:', { 
      districtNames, 
      loading: districtsLoading, 
      error: districtsError,
      count: districtNames?.length || 0
    });
  }, [districtNames, districtsLoading, districtsError]);

  // Categories
  const { 
    data: categories, 
    loading: categoriesLoading, 
    error: categoriesError 
  } = useCategories();

  // Enhanced map data hook - fetches everything optimally
  const {
    sites,
    parking,
    districts,
    loadingState,
    error: mapError,
    refetch: refetchMapData
  } = useMapData({
    source: filterState.source === SourceType.ALL ? undefined : filterState.source,
    district: filterState.district,
    category: filterState.category,
    includeParking: filterState.mapLayers.showParking,
    includeDistricts: filterState.mapLayers.showDistricts || !!filterState.district,
    limit: filterState.source === SourceType.SACHSEN ? 500 : 200 // Smart limits
  });

  // Search functionality
  const { searchResults, loading: searchLoading, search, clearSearch } = useSearch();

  // Handle search with performance optimizations
  const handleSearch = (query: string) => {
    setFilterState(prev => ({ ...prev, search: query }));
    if (query.trim()) {
      search(query, filterState.category, filterState.district);
    } else {
      clearSearch();
    }
  };

  // Update filter handlers
  const updateFilter = (updates: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...updates }));
    if (updates.search === '') {
      clearSearch();
    }
  };

  const updateMapLayers = (updates: Partial<MapLayerToggles>) => {
    setFilterState(prev => ({
      ...prev,
      mapLayers: { ...prev.mapLayers, ...updates }
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilterState({
      category: undefined,
      source: SourceType.CHEMNITZ, // Reset to Chemnitz, not ALL
      district: undefined,
      search: '',
      mapLayers: {
        showCulturalSites: true,
        showParking: false,
        showDistricts: false
      }
    });
    clearSearch();
  };

  // Determine what sites to display
  const displaySites = filterState.search ? searchResults : sites;

  // Calculate active filter count for UI
  const activeFilterCount = [
    filterState.category,
    filterState.source !== SourceType.CHEMNITZ ? filterState.source : null,
    filterState.district,
    filterState.search
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Enhanced Hero Header with Quick Stats */}
      <header className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          {/* Main Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Chemnitz Cultural Explorer
            </h1>
            <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto">
              Discover amazing cultural sites, theaters, museums, and more across Chemnitz and Saxony
            </p>
          </div>

          {/* Enhanced Status Pills with Quick Stats */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <div className={`px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2 transition-all duration-300 ${
              loadingState.sites ? 'bg-amber-500/90' : mapError ? 'bg-red-500/90' : 'bg-emerald-500/90'
            }`}>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                🏛️ Sites: {loadingState.sites ? 'Loading...' : mapError ? 'Error' : `${displaySites?.length || 0}`}
              </span>
            </div>
            
            {filterState.mapLayers.showParking && (
              <div className={`px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2 transition-all duration-300 ${
                loadingState.parking ? 'bg-amber-500/90' : 'bg-emerald-500/90'
              }`}>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  🚌 Parking: {loadingState.parking ? 'Loading...' : `${parking?.length || 0}`}
                </span>
              </div>
            )}
            
            <div className={`px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2 transition-all duration-300 ${
              categoriesLoading ? 'bg-amber-500/90' : categoriesError ? 'bg-red-500/90' : 'bg-emerald-500/90'
            }`}>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                📂 Categories: {categoriesLoading ? 'Loading...' : categoriesError ? 'Error' : `${categories?.length || 0}`}
              </span>
            </div>

            {/* DEBUG: Districts Status Pill */}
            <div className={`px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2 transition-all duration-300 ${
              districtsLoading ? 'bg-amber-500/90' : districtsError ? 'bg-red-500/90' : 'bg-emerald-500/90'
            }`}>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                🏘️ Districts: {districtsLoading ? 'Loading...' : districtsError ? 'Error' : `${districtNames?.length || 0}`}
              </span>
            </div>

            {quickStats && (
              <div className="px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2 bg-indigo-500/90">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-sm font-medium">
                  📊 Total DB: {quickStats.total_sites.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Enhanced Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className={`relative transition-all duration-300 ${isSearchFocused ? 'transform scale-105' : ''}`}>
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search for cultural sites, theaters, museums..."
                value={filterState.search}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="w-full pl-12 pr-12 py-4 bg-white/95 backdrop-blur-sm border border-white/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-white/30 focus:border-white/40 transition-all duration-300 text-lg"
              />
              {filterState.search && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center hover:bg-gray-100/20 rounded-r-2xl transition-colors duration-200"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Filter Controls */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Categories:</span>
              <button
                onClick={() => updateFilter({ category: undefined })}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  !filterState.category 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {Object.values(CategoryType).map((category) => {
                const isSelected = filterState.category === category;
                const categoryEmojis = {
                  [CategoryType.THEATRE]: '🎭',
                  [CategoryType.MUSEUM]: '🏛️',
                  [CategoryType.RESTAURANT]: '🍽️',
                  [CategoryType.ARTWORK]: '🎨'
                };
                
                return (
                  <button
                    key={category}
                    onClick={() => updateFilter({ category: isSelected ? undefined : category })}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                    }`}
                  >
                    <span>{categoryEmojis[category]}</span>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                );
              })}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-4 ml-auto">
              {/* Region Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Region:</span>
                <select 
                  value={filterState.source} 
                  onChange={(e) => updateFilter({ source: e.target.value as SourceType })}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value={SourceType.CHEMNITZ}>🏛️ Chemnitz</option>
                  <option value={SourceType.ALL}>🌍 All Regions</option>
                  <option value={SourceType.SACHSEN}>🏰 Saxony</option>
                </select>
              </div>

              {/* District Filter with Debug Info */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">District:</span>
                <select 
                  value={filterState.district || ''} 
                  onChange={(e) => updateFilter({ district: e.target.value || undefined })}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  disabled={districtsLoading}
                >
                  <option value="">All Districts {districtNames ? `(${districtNames.length})` : ''}</option>
                  {districtNames?.map((district) => (
                    <option key={district.id} value={district.name}>
                      {district.name}
                    </option>
                  ))}
                </select>
                {districtsError && (
                  <span className="text-xs text-red-600">⚠️ Error loading districts</span>
                )}
              </div>

              {/* Map Layer Toggles */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Show:</span>
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
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <button 
                  onClick={clearAllFilters}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear ({activeFilterCount})
                </button>
              )}

              {/* Refresh Button */}
              <button 
                onClick={refetchMapData}
                disabled={loadingState.sites}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-600/25"
              >
                <svg className={`w-4 h-4 ${loadingState.sites ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Info Bar */}
      {filterState.source === SourceType.ALL && displaySites.length > 1000 && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-6 py-2">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>
                <strong>Performance Notice:</strong> Displaying {displaySites.length.toLocaleString()} sites. 
                Consider filtering by region or district for better performance.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {(mapError || categoriesError || districtsError) && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-red-800">Connection Issues</h3>
            </div>
            <div className="text-sm text-red-700 space-y-1">
              {mapError && <p>• Map Data: {mapError}</p>}
              {categoriesError && <p>• Categories: {categoriesError}</p>}
              {districtsError && <p>• Districts: {districtsError}</p>}
            </div>
            <button
              onClick={refetchMapData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Retry Loading
            </button>
          </div>
        </div>
      )}

      {/* Search Status */}
      {filterState.search && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
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

      {/* Map Container */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200/50">
          <ChemnitzMap 
            culturalSites={displaySites}
            parkingLots={filterState.mapLayers.showParking ? parking : []}
            districts={filterState.mapLayers.showDistricts ? districts : []}
            loading={loadingState.sites || searchLoading}
            selectedDistrict={filterState.district}
          />
        </div>
      </div>

      {/* Enhanced Footer with Performance Stats */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-center md:text-left">
              <p className="text-gray-300">
                © 2025 Chemnitz Cultural Explorer • Discover the beauty of Saxony's cultural heritage
              </p>
            </div>
            {quickStats && (
              <div className="text-center md:text-right">
                <div className="text-sm text-gray-400">
                  <p>Database: {quickStats.total_sites.toLocaleString()} sites • {quickStats.total_parking} parking lots • {quickStats.total_districts} districts</p>
                  <p>Current view: {displaySites.length} sites displayed</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App