import { useState, useEffect } from 'react'
import './App.css'
import ChemnitzMap from './components/Chemnitz_Map/Chemnitz_Map'
import { 
  useDistrictNames, 
  useCategories, 
  useSearch, 
  useQuickStats,
  useMapData 
} from './hooks/useApi'
import { SourceType, FilterState } from './types'
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
  
  // Quick stats for header (optimized endpoint)
  const { data: quickStats } = useQuickStats();
  
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

  // Clear all filters
  const clearAllFilters = () => {
    setFilterState({
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
    clearSearch();
  };

  // Determine what sites to display
  const displaySites = filterState.search ? searchResults : sites;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Enhanced Hero Header with Quick Stats */}
      <header className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
   
      </header>

      {/* ChemnitzMap Component with all props */}
      <ChemnitzMap 
        // Map data
        culturalSites={displaySites}
        parkingLots={filterState.mapLayers.showParking ? parking : []}
        districts={filterState.mapLayers.showDistricts ? districts : []}
        loading={loadingState.sites || searchLoading}
        selectedDistrict={filterState.district}
        
        // Filter state and handlers
        filterState={filterState}
        onFilterUpdate={updateFilter}
        onClearAllFilters={clearAllFilters}
        onSearch={handleSearch}
        onClearSearch={clearSearch}
        onRefresh={refetchMapData}
        
        // Additional data for filters
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        districtNames={districtNames}
        districtsLoading={districtsLoading}
        districtsError={districtsError}
        
        // Search state
        searchResults={searchResults}
        searchLoading={searchLoading}
        
        // Errors
        mapError={mapError}
        
        // Loading states
        loadingState={loadingState}
      />

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