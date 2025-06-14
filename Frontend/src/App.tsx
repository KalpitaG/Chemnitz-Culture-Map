// App.tsx - UPDATED WITH SEARCH AND NEARBY PARKING
import React, { useState, useCallback } from 'react'; // ADD useCallback
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/App.css';

// Import new components
import Layout from './components/Layout/Layout';
import MapContainer from './components/Map/MapContainer';

// Import authentication components
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth/Auth';

import {
  FilterState,
  SourceType,
  ParkingType,
  CategoryType
} from './types';

import {
  useDistrictNames,
  useMapData,
  useAdvancedSearch,
  useNearbyParking // ADD: Import nearby parking hook
} from './hooks/useApi';

// Your existing main app component with SEARCH AND NEARBY PARKING ADDED
const MainApp: React.FC = () => {
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    source: SourceType.CHEMNITZ,
    district: undefined,
    categories: Object.values(CategoryType),
    parkingTypes: [],
    mapLayers: {
      showParking: true,
      showDistricts: true,
      showCulturalSites: true,
    },
  });

  // ADD: Search hook
  const {
    searchResults,
    isSearching,
    searchError,
    searchQuery,
    searchStats,
    clearSearch,
    searchByQuery,
    hasSearchResults,
    isSearchActive
  } = useAdvancedSearch();

  // ADD: Nearby parking hook
  const {
    nearbyParking,
    parkingConnections,
    isSearchingParking,
    parkingError,
    searchNearbyParking,
    clearNearbyParking,
    hasNearbyParking
  } = useNearbyParking();

  // ADD: State for parking toggle
  const [showNearbyParking, setShowNearbyParking] = useState(false);

  const onFilterUpdate = (updates: Partial<FilterState>) => {
    console.log('🔄 Filter Update:', updates);
    setFilterState((prev) => {
      const newState = { ...prev, ...updates };
      console.log('📊 New Filter State:', newState);
      return newState;
    });
  };

  // API hooks - only destructure what we actually use
  const {
    data: districtNames,
    loading: districtsLoading
  } = useDistrictNames();

  // Your existing useMapData hook (unchanged)
  const {
    sites,
    parking,
    districts,
    loadingState,
    error: mapError
  } = useMapData({
    source: filterState.source,
    district: filterState.district,
    categories: filterState.categories,
    parkingTypes: filterState.parkingTypes,
    includeParking: filterState.mapLayers.showParking && filterState.parkingTypes && filterState.parkingTypes.length > 0,
    includeDistricts: filterState.mapLayers.showDistricts,
    limit: 2000,
    includeChemnitzWhenSaxony: filterState.source === SourceType.SACHSEN
  });

  // ADD: Search handlers
  const handleSearch = useCallback((query: string) => {
    console.log('🔍 App: Starting search for:', query);

    // Only search if query has at least 2 characters
    if (query.length < 2) {
      console.log('⚠️ Query too short, not searching');
      return;
    }

    setFilterState(prev => ({ ...prev, search: query }));
    searchByQuery(query, {
      categories: filterState.categories,
      district: filterState.district,
      source: filterState.source,
      sort_by: 'name',
      sort_order: 'asc'
    });
  }, [searchByQuery, filterState.categories, filterState.district, filterState.source]);

  const handleSearchSuggestionSelect = useCallback((suggestion: any) => {
    console.log('🎯 App: Selected suggestion:', suggestion);
    setFilterState(prev => ({ ...prev, search: suggestion.name }));
    searchByQuery(suggestion.name, {
      categories: filterState.categories,
      district: filterState.district,
      source: filterState.source
    });
  }, [searchByQuery, filterState.categories, filterState.district, filterState.source]);

  const handleClearSearch = useCallback(() => {
    console.log('🧹 App: Clearing search');
    setFilterState(prev => ({ ...prev, search: '' }));
    clearSearch();
    // Also clear nearby parking when clearing search
    setShowNearbyParking(false);
    clearNearbyParking();
  }, [clearSearch, clearNearbyParking]);

  // ADD: Handler for parking button toggle
  const handleToggleNearbyParking = useCallback(() => {
    const newState = !showNearbyParking;
    setShowNearbyParking(newState);

    if (newState) {
      // Show parking - search for nearby parking
      const sitesToSearch = hasSearchResults ? searchResults : sites;
      if (sitesToSearch.length > 0) {
        console.log('🅿️ Searching for parking near', sitesToSearch.length, 'sites');

        // Convert ParkingType enum to string array for API
        const parkingTypeStrings = filterState.parkingTypes?.map(type => type.toString()) || [];
        searchNearbyParking(sitesToSearch, parkingTypeStrings);
      }
    } else {
      // Hide parking - clear results
      console.log('🅿️ Hiding nearby parking');
      clearNearbyParking();
    }
  }, [showNearbyParking, hasSearchResults, searchResults, sites, searchNearbyParking, clearNearbyParking, filterState.parkingTypes]);

  // MODIFY: Determine what data to show (search results vs normal data)
  const displayData = hasSearchResults ? {
    sites: searchResults,
    parking: showNearbyParking ? nearbyParking : [], // Search only returns cultural sites, use nearby parking if toggled
    districts: districts
  } : {
    sites: sites,
    parking: showNearbyParking ? nearbyParking : parking, // Use nearby OR regular parking
    districts: districts
  };

  // ADD: Determine loading state
  const isLoading = isSearchActive ? isSearching : loadingState.sites;

  console.log('📊 App Debug:', {
    filterState,
    isSearchActive,
    hasSearchResults,
    searchResultsCount: searchResults.length,
    normalSitesCount: sites.length,
    displaySitesCount: displayData.sites.length,
    loading: isLoading,
    showNearbyParking,
    nearbyParkingCount: nearbyParking.length
  });

  return (
   <Layout
  filterState={filterState}
  onFilterUpdate={onFilterUpdate}
  districtNames={districtNames || []}
  districtsLoading={districtsLoading}
  onSearch={handleSearch}
  onSearchSuggestionSelect={handleSearchSuggestionSelect}
  onClearSearch={handleClearSearch}
  isSearching={isSearching}
  searchQuery={searchQuery}
  isSearchActive={isSearchActive}
>
      <MapContainer
        culturalSites={displayData.sites} // CHANGED: Use displayData instead of sites
        parkingLots={displayData.parking} // CHANGED: Use displayData instead of parking
        districts={displayData.districts}
        loading={isLoading} // CHANGED: Use isLoading instead of loadingState.sites
        selectedDistrict={filterState.district}
        mapError={searchError || mapError} // CHANGED: Show search errors too
        focusedSiteId={undefined} // Keep existing prop
        // NEW: Add parking connection props
        parkingConnections={showNearbyParking ? parkingConnections : undefined}
        showNearbyParking={showNearbyParking}
      />

      {/* UPDATED: Search status display with parking button */}
      {isSearchActive && searchQuery.length >= 2 && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(37, 99, 235, 0.9)',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: '500',
          zIndex: 1200,
          backdropFilter: 'blur(4px)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          {isSearching ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Searching for "{searchQuery}"...
            </>
          ) : hasSearchResults ? (
            <>
              <i className="fas fa-search"></i>
              Found {searchStats.total} results for "{searchQuery}"

              <button
                onClick={handleClearSearch}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                <i className="fas fa-times" style={{ marginRight: '0.25rem' }}></i>
                Clear
              </button>
            </>
          ) : (
            <>
              <i className="fas fa-exclamation-circle"></i>
              No results found for "{searchQuery}"
              <button onClick={handleClearSearch}>Clear</button>
            </>
          )}
        </div>
      )}

      {/* NEW: Separate Floating Parking Button */}
      {isSearchActive && searchQuery.length >= 2 && hasSearchResults && filterState.source === SourceType.CHEMNITZ && (
        <div style={{
          position: 'absolute',
          top: '4.5rem', // Below the search bar
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200
        }}>
          <button
            onClick={handleToggleNearbyParking}
            disabled={isSearchingParking}
            style={{
              background: showNearbyParking
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg,rgb(16, 137, 52) 0%, rgb(16, 137, 52) 100%)',
              border: '3px solid rgba(255, 255, 255, 0.4)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '2rem',
              fontSize: '0.775rem',
              fontWeight: '700',
              cursor: isSearchingParking ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 12px 24px -6px rgba(0, 0, 0, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0, 0, 0, 0.4)';
            }}
          >
            🅿️ {/* Emoji makes it super noticeable */}
            {isSearchingParking ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                FINDING...
              </>
            ) : showNearbyParking ? (
              <>
                <i className="fas fa-eye-slash"></i>
                HIDE ({nearbyParking.length})
              </>
            ) : (
              <>
                Show Nearby Parking
              </>
            )}
          </button>
        </div>
      )}

    </Layout>
  );
};

// Main App Component with Authentication Wrapper (UNCHANGED)
const App: React.FC = () => {
  const authState = useAuth();
  const { isAuthenticated, isLoading, user } = authState;

  // Create a unique key based on auth state to force re-renders
  const appKey = `app-${isAuthenticated ? 'auth' : 'noauth'}-${user?.id || 'nouser'}`;

  // Debug logging with more details
  console.log('🔍 App Debug - Authentication State:', {
    isAuthenticated,
    isLoading,
    user: user?.email || 'null',
    userId: user?.id || 'null',
    token: localStorage.getItem('auth_token') ? 'exists' : 'missing',
    userStorage: localStorage.getItem('auth_user') ? 'exists' : 'missing',
    timestamp: new Date().toLocaleTimeString(),
    appKey
  });

  // Show loading spinner on initial auth check
  if (isLoading) {
    console.log('🕐 App: Showing loading state');
    return (
      <div key={`${appKey}-loading`} className="d-flex justify-content-center align-items-center bg-gray-50" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-gray-600">Initializing Chemnitz Cultural Explorer...</p>
        </div>
      </div>
    );
  }

  // Show auth forms if not authenticated
  if (!isAuthenticated) {
    console.log('🔐 App: User not authenticated, showing auth forms');
    return (
      <div key={`${appKey}-auth`}>
        <Auth
          onAuthSuccess={() => {
            console.log('✅ Auth Success Callback: User authenticated, forcing re-render...');

            // Check auth state immediately
            console.log('🔍 Immediate post-login check:', {
              currentAuthState: authState.isAuthenticated,
              currentUser: authState.user?.email,
              localStorage: {
                token: localStorage.getItem('auth_token') ? 'exists' : 'missing',
                user: localStorage.getItem('auth_user') ? 'exists' : 'missing'
              }
            });

            // Force a small delay to ensure state is fully updated
            setTimeout(() => {
              console.log('🔄 Delayed post-login state check:', {
                isAuthenticated: authState.isAuthenticated,
                user: authState.user?.email,
                shouldShowMap: authState.isAuthenticated && authState.user
              });

              // If state hasn't updated, force a page reload as backup
              if (!authState.isAuthenticated) {
                console.log('⚠️ Auth state not updated, forcing page reload...');
                window.location.reload();
              }
            }, 500);
          }}
        />
      </div>
    );
  }

  // Show your new map UI immediately after authentication
  console.log('🗺️ App: User authenticated, showing map interface for:', user?.email);
  return (
    <div key={`${appKey}-main`}>
      <MainApp />
    </div>
  );
};

export default App;